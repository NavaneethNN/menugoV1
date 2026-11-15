import { Router, Request, Response, NextFunction } from 'express';
import {
  db,
  restaurants,
  cinemaProfiles,
  cinemaPaymentAccounts,
  cinemaPaymentTransactions,
  cinemaRefunds,
  cinemaWebhookEvents,
  orders,
  orderItems,
  orderStatusHistory
} from '@menugo/database';
import { eq, and, sql, desc } from 'drizzle-orm';
import {
  configurePaymentProviderSchema,
  updatePaymentCredentialsSchema,
  initiateCinemaRefundSchema,
  createCinemaPaymentOrderSchema,
  verifyCinemaPaymentSchema,
  CINEMA_PAYMENT_PROVIDERS,
  CinemaPaymentProvider,
  CINEMA_ONBOARDING_STAGES,
  CinemaOnboardingStage
} from '@menugo/shared';
import { requireAuth } from '../middleware/auth';
import { requireCinemaTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import { encryptSecret, decryptSecret, maskSecret } from '../lib/encryption';
import { getPaymentProvider } from '../lib/payment';
import { publishOrderCreated } from '../lib/realtime';

const router = Router();

// Helper to sanitize payment account for client response
function sanitizePaymentAccount(account: typeof cinemaPaymentAccounts.$inferSelect) {
  return {
    id: account.id,
    theatreId: account.theatreId,
    provider: account.provider as CinemaPaymentProvider,
    environment: account.environment,
    keyId: account.keyId,
    maskedKeySecret: account.maskedKeySecret,
    hasWebhookSecret: Boolean(account.encryptedWebhookSecret),
    status: account.status,
    isVerified: account.isVerified,
    verifiedAt: account.verifiedAt,
    lastVerificationError: account.lastVerificationError,
    settings: (account.settings as Record<string, unknown>) || {},
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

// Helper to advance onboarding stage if not already further along
async function advanceOnboardingStage(theatreId: string, targetStage: CinemaOnboardingStage) {
  const [profile] = await db
    .select({ onboardingStage: cinemaProfiles.onboardingStage })
    .from(cinemaProfiles)
    .where(eq(cinemaProfiles.theatreId, theatreId))
    .limit(1);

  if (!profile) return;

  const stageOrder = CINEMA_ONBOARDING_STAGES;
  const currentIdx = stageOrder.indexOf(profile.onboardingStage as CinemaOnboardingStage);
  const targetIdx = stageOrder.indexOf(targetStage);

  if (targetIdx > currentIdx) {
    await db
      .update(cinemaProfiles)
      .set({
        onboardingStage: targetStage,
        updatedAt: new Date()
      })
      .where(eq(cinemaProfiles.theatreId, theatreId));
  }
}

/**
 * GET /api/cinema/payments/settings
 * Returns configured payment gateways and statuses for the authenticated cinema theatre.
 * Raw secrets are NEVER returned; only masked secrets (e.g. ••••••••abcd) are provided.
 */
router.get(
  '/settings',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;

      const accounts = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(eq(cinemaPaymentAccounts.theatreId, theatreId));

      const [theatre] = await db
        .select({
          id: restaurants.id,
          name: restaurants.name,
          currency: restaurants.currency
        })
        .from(restaurants)
        .where(eq(restaurants.id, theatreId))
        .limit(1);

      const [profile] = await db
        .select({
          onboardingStage: cinemaProfiles.onboardingStage
        })
        .from(cinemaProfiles)
        .where(eq(cinemaProfiles.theatreId, theatreId))
        .limit(1);

      res.json({
        success: true,
        theatreId,
        theatreName: theatre?.name,
        currency: theatre?.currency || 'INR',
        onboardingStage: profile?.onboardingStage || 'payment_configured',
        supportedProviders: CINEMA_PAYMENT_PROVIDERS,
        accounts: accounts.map(sanitizePaymentAccount)
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/payments/configure
 * Configures or updates a theatre's own payment gateway account.
 * Encrypts sensitive credentials at rest with AES-256-GCM.
 * Validates connection with the provider before updating active status.
 */
router.post(
  '/configure',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const validatedData = configurePaymentProviderSchema.parse(req.body);

      const providerAdapter = getPaymentProvider(validatedData.provider);

      // Verify credentials with provider adapter
      const verification = await providerAdapter.verifyConnection({
        environment: validatedData.environment,
        keyId: validatedData.keyId,
        keySecret: validatedData.keySecret,
        webhookSecret: validatedData.webhookSecret,
        settings: validatedData.settings
      });

      // Encrypt sensitive secrets
      const encryptedKeySecret = encryptSecret(validatedData.keySecret);
      const encryptedWebhookSecret = validatedData.webhookSecret
        ? encryptSecret(validatedData.webhookSecret)
        : null;
      const maskedKeySecret = maskSecret(validatedData.keySecret);

      const status = verification.success ? 'connected' : 'verification_failed';
      const isVerified = verification.success;
      const verifiedAt = verification.success ? new Date() : null;
      const lastVerificationError = verification.success ? null : verification.message;

      // Check if account already exists for this provider
      const [existing] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreId),
            eq(cinemaPaymentAccounts.provider, validatedData.provider)
          )
        )
        .limit(1);

      let savedAccount: typeof cinemaPaymentAccounts.$inferSelect;

      if (existing) {
        const [updated] = await db
          .update(cinemaPaymentAccounts)
          .set({
            environment: validatedData.environment,
            keyId: validatedData.keyId,
            encryptedKeySecret,
            encryptedWebhookSecret,
            maskedKeySecret,
            status,
            isVerified,
            verifiedAt,
            lastVerificationError,
            settings: validatedData.settings || {},
            updatedAt: new Date()
          })
          .where(eq(cinemaPaymentAccounts.id, existing.id))
          .returning();
        if (!updated) {
          throw new AppError('Failed to update payment account', 500);
        }
        savedAccount = updated;
      } else {
        const [inserted] = await db
          .insert(cinemaPaymentAccounts)
          .values({
            id: crypto.randomUUID(),
            theatreId,
            provider: validatedData.provider,
            environment: validatedData.environment,
            keyId: validatedData.keyId,
            encryptedKeySecret,
            encryptedWebhookSecret,
            maskedKeySecret,
            status,
            isVerified,
            verifiedAt,
            lastVerificationError,
            settings: validatedData.settings || {}
          })
          .returning();
        if (!inserted) {
          throw new AppError('Failed to insert payment account', 500);
        }
        savedAccount = inserted;
      }

      // If connection succeeded, advance cinema onboarding stage
      if (verification.success) {
        await advanceOnboardingStage(theatreId, 'payment_configured');
      }

      res.json({
        success: verification.success,
        verification,
        account: sanitizePaymentAccount(savedAccount)
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/payments/verify/:provider
 * Re-tests the connection for an existing configured payment gateway account.
 */
router.post(
  '/verify/:provider',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const providerParam = req.params.provider as CinemaPaymentProvider;

      if (!CINEMA_PAYMENT_PROVIDERS.includes(providerParam)) {
        throw new AppError(`Invalid payment provider: ${providerParam}`, 400);
      }

      const [account] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreId),
            eq(cinemaPaymentAccounts.provider, providerParam)
          )
        )
        .limit(1);

      if (!account) {
        throw new AppError(`No payment account configured for ${providerParam}`, 404);
      }

      // Decrypt stored key secret
      const decryptedSecret = decryptSecret(account.encryptedKeySecret);
      const decryptedWebhookSecret = account.encryptedWebhookSecret
        ? decryptSecret(account.encryptedWebhookSecret)
        : null;

      const providerAdapter = getPaymentProvider(providerParam);
      const verification = await providerAdapter.verifyConnection({
        environment: account.environment as 'test' | 'live',
        keyId: account.keyId,
        keySecret: decryptedSecret,
        webhookSecret: decryptedWebhookSecret,
        settings: (account.settings as Record<string, unknown>) || {}
      });

      const status = verification.success ? 'connected' : 'verification_failed';
      const isVerified = verification.success;
      const verifiedAt = verification.success ? new Date() : account.verifiedAt;
      const lastVerificationError = verification.success ? null : verification.message;

      const [updated] = await db
        .update(cinemaPaymentAccounts)
        .set({
          status,
          isVerified,
          verifiedAt,
          lastVerificationError,
          updatedAt: new Date()
        })
        .where(eq(cinemaPaymentAccounts.id, account.id))
        .returning();

      if (!updated) {
        throw new AppError('Failed to update verified payment account', 500);
      }

      if (verification.success) {
        await advanceOnboardingStage(theatreId, 'payment_configured');
      }

      res.json({
        success: verification.success,
        verification,
        account: sanitizePaymentAccount(updated)
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/payments/disable/:provider
 * Temporarily disables a payment gateway without removing saved credentials.
 */
router.post(
  '/disable/:provider',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const providerParam = req.params.provider as CinemaPaymentProvider;

      if (!CINEMA_PAYMENT_PROVIDERS.includes(providerParam)) {
        throw new AppError(`Invalid payment provider: ${providerParam}`, 400);
      }

      const [account] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreId),
            eq(cinemaPaymentAccounts.provider, providerParam)
          )
        )
        .limit(1);

      if (!account) {
        throw new AppError(`No payment account configured for ${providerParam}`, 404);
      }

      const [updated] = await db
        .update(cinemaPaymentAccounts)
        .set({
          status: 'disabled',
          updatedAt: new Date()
        })
        .where(eq(cinemaPaymentAccounts.id, account.id))
        .returning();

      if (!updated) {
        throw new AppError('Failed to disable payment account', 500);
      }

      res.json({
        success: true,
        message: `${providerParam.toUpperCase()} gateway disabled`,
        account: sanitizePaymentAccount(updated)
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/payments/enable/:provider
 * Re-enables a previously disabled gateway account.
 */
router.post(
  '/enable/:provider',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const providerParam = req.params.provider as CinemaPaymentProvider;

      if (!CINEMA_PAYMENT_PROVIDERS.includes(providerParam)) {
        throw new AppError(`Invalid payment provider: ${providerParam}`, 400);
      }

      const [account] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreId),
            eq(cinemaPaymentAccounts.provider, providerParam)
          )
        )
        .limit(1);

      if (!account) {
        throw new AppError(`No payment account configured for ${providerParam}`, 404);
      }

      const newStatus = account.isVerified ? 'connected' : 'verification_failed';

      const [updated] = await db
        .update(cinemaPaymentAccounts)
        .set({
          status: newStatus,
          updatedAt: new Date()
        })
        .where(eq(cinemaPaymentAccounts.id, account.id))
        .returning();

      if (!updated) {
        throw new AppError('Failed to enable payment account', 500);
      }

      res.json({
        success: true,
        message: `${providerParam.toUpperCase()} gateway enabled`,
        account: sanitizePaymentAccount(updated)
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/cinema/payments/disconnect/:provider
 * Disconnects and permanently deletes merchant credentials for a gateway provider.
 */
router.delete(
  '/disconnect/:provider',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const providerParam = req.params.provider as CinemaPaymentProvider;

      if (!CINEMA_PAYMENT_PROVIDERS.includes(providerParam)) {
        throw new AppError(`Invalid payment provider: ${providerParam}`, 400);
      }

      const [account] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreId),
            eq(cinemaPaymentAccounts.provider, providerParam)
          )
        )
        .limit(1);

      if (!account) {
        throw new AppError(`No payment account found for ${providerParam}`, 404);
      }

      await db
        .delete(cinemaPaymentAccounts)
        .where(eq(cinemaPaymentAccounts.id, account.id));

      res.json({
        success: true,
        message: `${providerParam.toUpperCase()} gateway disconnected and credentials removed`
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/payments/transactions
 * Returns payment transaction history for the cinema theatre with pagination and status filters.
 */
router.get(
  '/transactions',
  requireAuth,
  requireCinemaTenant(['owner', 'admin', 'staff']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const offset = (page - 1) * limit;

      const transactions = await db
        .select({
          id: cinemaPaymentTransactions.id,
          theatreId: cinemaPaymentTransactions.theatreId,
          orderId: cinemaPaymentTransactions.orderId,
          provider: cinemaPaymentTransactions.provider,
          providerPaymentId: cinemaPaymentTransactions.providerPaymentId,
          providerOrderId: cinemaPaymentTransactions.providerOrderId,
          amount: cinemaPaymentTransactions.amount,
          currency: cinemaPaymentTransactions.currency,
          status: cinemaPaymentTransactions.status,
          refundStatus: cinemaPaymentTransactions.refundStatus,
          refundAmount: cinemaPaymentTransactions.refundAmount,
          createdAt: cinemaPaymentTransactions.createdAt,
          updatedAt: cinemaPaymentTransactions.updatedAt,
          orderNumber: orders.orderNumber
        })
        .from(cinemaPaymentTransactions)
        .leftJoin(orders, eq(cinemaPaymentTransactions.orderId, orders.id))
        .where(eq(cinemaPaymentTransactions.theatreId, theatreId))
        .orderBy(desc(cinemaPaymentTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(cinemaPaymentTransactions)
        .where(eq(cinemaPaymentTransactions.theatreId, theatreId));

      const total = countResult?.count || 0;

      res.json({
        success: true,
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/payments/refunds
 * Admin-authorized refund contract using the theatre's own merchant account.
 */
router.post(
  '/refunds',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const validatedData = initiateCinemaRefundSchema.parse(req.body);

      // 1. Fetch transaction and verify tenant ownership
      const [transaction] = await db
        .select()
        .from(cinemaPaymentTransactions)
        .where(
          and(
            eq(cinemaPaymentTransactions.id, validatedData.transactionId),
            eq(cinemaPaymentTransactions.theatreId, theatreId)
          )
        )
        .limit(1);

      if (!transaction) {
        throw new AppError('Payment transaction not found for this theatre', 404);
      }

      if (transaction.status !== 'CAPTURED') {
        throw new AppError(`Cannot refund transaction with status ${transaction.status}. Only CAPTURED transactions can be refunded.`, 400);
      }

      if (validatedData.amount > transaction.amount - transaction.refundAmount) {
        throw new AppError('Refund amount exceeds remaining non-refunded transaction balance', 400);
      }

      // 2. Fetch theatre's own configured gateway credentials
      const [account] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreId),
            eq(cinemaPaymentAccounts.provider, transaction.provider)
          )
        )
        .limit(1);

      if (!account || !account.isVerified || account.status === 'disabled') {
        throw new AppError(`Theatre's ${transaction.provider} account is not active or verified to process refunds`, 400);
      }

      // 3. Create a refund audit record with REFUND_PENDING status initially
      const refundId = crypto.randomUUID();
      const adminEmail = req.user?.email || 'admin@menugo.in';

      const [refund] = await db
        .insert(cinemaRefunds)
        .values({
          id: refundId,
          theatreId,
          transactionId: transaction.id,
          orderId: transaction.orderId,
          provider: transaction.provider,
          amount: validatedData.amount,
          reason: validatedData.reason || 'Admin authorized refund',
          status: 'REFUND_PENDING',
          initiatedBy: adminEmail,
          metadata: {
            theatreId,
            initiatedAt: new Date().toISOString()
          }
        })
        .returning();

      if (!refund) {
        throw new AppError('Failed to record refund', 500);
      }

      // 4. Decrypt credentials and execute refund directly on theatre merchant account
      const decryptedSecret = decryptSecret(account.encryptedKeySecret);
      const decryptedWebhookSecret = account.encryptedWebhookSecret
        ? decryptSecret(account.encryptedWebhookSecret)
        : null;

      const providerAdapter = getPaymentProvider(transaction.provider as CinemaPaymentProvider);

      const refundResult = await providerAdapter.initiateRefund({
        credentials: {
          environment: account.environment as 'test' | 'live',
          keyId: account.keyId,
          keySecret: decryptedSecret,
          webhookSecret: decryptedWebhookSecret,
          settings: (account.settings as Record<string, unknown>) || {}
        },
        transactionId: transaction.id,
        providerPaymentId: transaction.providerPaymentId || '',
        amount: validatedData.amount,
        reason: validatedData.reason || undefined
      });

      // 5. Update refund record and ledger balances based on gateway response
      const newStatus = refundResult.status;
      const [updatedRefund] = await db
        .update(cinemaRefunds)
        .set({
          status: newStatus,
          providerRefundId: refundResult.providerRefundId || null,
          metadata: {
            theatreId,
            initiatedAt: new Date().toISOString(),
            gatewayResponse: (refundResult.rawResponse as Record<string, unknown>) || null
          },
          updatedAt: new Date()
        })
        .where(eq(cinemaRefunds.id, refund.id))
        .returning();

      if (!updatedRefund) {
        throw new AppError('Failed to update refund record', 500);
      }

      if (newStatus === 'REFUND_PROCESSED') {
        const newRefundTotal = transaction.refundAmount + validatedData.amount;
        const refundStatus = newRefundTotal >= transaction.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
        await db
          .update(cinemaPaymentTransactions)
          .set({
            refundAmount: newRefundTotal,
            refundStatus,
            updatedAt: new Date()
          })
          .where(eq(cinemaPaymentTransactions.id, transaction.id));

        if (refundStatus === 'REFUNDED' && transaction.orderId) {
          await db
            .update(orders)
            .set({
              paymentStatus: 'refunded',
              updatedAt: new Date()
            })
            .where(eq(orders.id, transaction.orderId));
        }
      } else if (newStatus === 'REFUND_PENDING') {
        await db
          .update(cinemaPaymentTransactions)
          .set({
            refundStatus: 'REFUND_PENDING',
            updatedAt: new Date()
          })
          .where(eq(cinemaPaymentTransactions.id, transaction.id));
      } else if (newStatus === 'REFUND_FAILED') {
        throw new AppError(refundResult.message || 'Refund request was rejected by payment gateway', 400);
      }

      res.json({
        success: true,
        message:
          newStatus === 'REFUND_PROCESSED'
            ? 'Refund successfully processed by theatre gateway'
            : 'Refund initiated and awaiting gateway settlement confirmation',
        refund: {
          id: updatedRefund.id,
          transactionId: updatedRefund.transactionId,
          amount: updatedRefund.amount,
          status: updatedRefund.status,
          providerRefundId: updatedRefund.providerRefundId,
          provider: updatedRefund.provider,
          initiatedBy: updatedRefund.initiatedBy,
          createdAt: updatedRefund.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/payments/order
 * Creates a payment order directly on the theatre's active merchant account.
 */
router.post(
  '/order',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = createCinemaPaymentOrderSchema.parse(req.body);

      // 1. Fetch pending order and validate statusToken
      const [order] = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, validatedData.orderId),
            eq(orders.statusToken, validatedData.statusToken)
          )
        )
        .limit(1);

      if (!order) {
        throw new AppError('Cinema order not found or invalid access token', 404);
      }

      if (order.status !== 'pending' || order.paymentStatus !== 'unpaid') {
        throw new AppError(`Order cannot be paid in current status: ${order.status}/${order.paymentStatus}`, 400);
      }

      const theatreId = order.restaurantId;

      // 2. Fetch theatre's active merchant account for the requested provider
      const [account] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreId),
            eq(cinemaPaymentAccounts.provider, validatedData.provider)
          )
        )
        .limit(1);

      if (!account || !account.isVerified || account.status === 'disabled') {
        throw new AppError(`Theatre has not configured an active ${validatedData.provider.toUpperCase()} merchant account`, 400);
      }

      // 3. Decrypt secrets in backend memory
      const decryptedSecret = decryptSecret(account.encryptedKeySecret);
      const decryptedWebhookSecret = account.encryptedWebhookSecret
        ? decryptSecret(account.encryptedWebhookSecret)
        : null;

      const providerAdapter = getPaymentProvider(validatedData.provider);

      // 4. Create payment transaction order on gateway
      const paymentOrderResult = await providerAdapter.createPaymentOrder({
        credentials: {
          environment: account.environment as 'test' | 'live',
          keyId: account.keyId,
          keySecret: decryptedSecret,
          webhookSecret: decryptedWebhookSecret,
          settings: (account.settings as Record<string, unknown>) || {}
        },
        orderId: order.id,
        theatreId,
        amount: order.totalAmount,
        currency: 'INR',
        receipt: order.orderNumber || order.id,
        customer: {
          name: order.customerName || undefined,
          phone: order.customerPhone || undefined
        }
      });

      // 5. Create or update payment transaction record
      const transactionId = crypto.randomUUID();
      const [transaction] = await db
        .insert(cinemaPaymentTransactions)
        .values({
          id: transactionId,
          theatreId,
          orderId: order.id,
          paymentAccountId: account.id,
          provider: validatedData.provider,
          providerOrderId: paymentOrderResult.providerOrderId,
          amount: order.totalAmount,
          currency: 'INR',
          status: 'PENDING',
          metadata: (paymentOrderResult.providerPayload as Record<string, unknown>) || {}
        })
        .returning();

      if (!transaction) {
        throw new AppError('Failed to record payment transaction', 500);
      }

      // Link payment method and provider order reference to the pending order
      await db
        .update(orders)
        .set({
          paymentMethod: validatedData.provider,
          paymentReference: paymentOrderResult.providerOrderId,
          updatedAt: new Date()
        })
        .where(eq(orders.id, order.id));

      res.status(201).json({
        success: true,
        transactionId: transaction.id,
        orderId: order.id,
        provider: validatedData.provider,
        amount: order.totalAmount,
        currency: 'INR',
        providerOrderId: paymentOrderResult.providerOrderId,
        providerPayload: paymentOrderResult.providerPayload
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/payments/verify
 * Performs authoritative server-to-server verification of payment response.
 */
router.post(
  '/verify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = verifyCinemaPaymentSchema.parse(req.body);

      // 1. Fetch order and validate status token
      const [order] = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, validatedData.orderId),
            eq(orders.statusToken, validatedData.statusToken)
          )
        )
        .limit(1);

      if (!order) {
        throw new AppError('Order not found or invalid token', 404);
      }

      const theatreId = order.restaurantId;

      // 2. Fetch payment transaction
      const [transaction] = await db
        .select()
        .from(cinemaPaymentTransactions)
        .where(
          and(
            eq(cinemaPaymentTransactions.id, validatedData.transactionId),
            eq(cinemaPaymentTransactions.theatreId, theatreId),
            eq(cinemaPaymentTransactions.orderId, order.id)
          )
        )
        .limit(1);

      if (!transaction) {
        throw new AppError('Payment transaction record not found', 404);
      }

      // If already captured, return success immediately (idempotency)
      if (transaction.status === 'CAPTURED') {
        return res.json({
          success: true,
          verified: true,
          status: 'CAPTURED',
          orderId: order.id,
          transactionId: transaction.id,
          message: 'Payment already verified and captured'
        });
      }

      // 3. Fetch theatre gateway account and decrypt credentials
      const [account] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreId),
            eq(cinemaPaymentAccounts.provider, validatedData.provider)
          )
        )
        .limit(1);

      if (!account || !account.isVerified) {
        throw new AppError(`Theatre's ${validatedData.provider.toUpperCase()} account is not verified`, 400);
      }

      const decryptedSecret = decryptSecret(account.encryptedKeySecret);
      const decryptedWebhookSecret = account.encryptedWebhookSecret
        ? decryptSecret(account.encryptedWebhookSecret)
        : null;

      const providerAdapter = getPaymentProvider(validatedData.provider);

      // 4. Server-to-server verification with gateway
      const verification = await providerAdapter.verifyPayment({
        credentials: {
          environment: account.environment as 'test' | 'live',
          keyId: account.keyId,
          keySecret: decryptedSecret,
          webhookSecret: decryptedWebhookSecret,
          settings: (account.settings as Record<string, unknown>) || {}
        },
        orderId: order.id,
        providerOrderId: validatedData.providerOrderId || transaction.providerOrderId || order.id,
        providerPaymentId: validatedData.providerPaymentId || transaction.providerPaymentId || '',
        providerSignature: validatedData.providerSignature || undefined,
        expectedAmount: order.totalAmount,
        responsePayload: validatedData.responsePayload
      });

      // 5. Update transaction and order states accordingly
      if (verification.verified && verification.status === 'CAPTURED') {
        await db
          .update(cinemaPaymentTransactions)
          .set({
            status: 'CAPTURED',
            providerPaymentId: verification.providerPaymentId || transaction.providerPaymentId,
            providerOrderId: verification.providerOrderId || transaction.providerOrderId,
            updatedAt: new Date()
          })
          .where(eq(cinemaPaymentTransactions.id, transaction.id));

        await db
          .update(orders)
          .set({
            status: 'confirmed',
            paymentStatus: 'paid',
            paymentMethod: validatedData.provider,
            paymentReference: verification.providerPaymentId || transaction.providerPaymentId || validatedData.providerPaymentId || validatedData.providerOrderId,
            updatedAt: new Date()
          })
          .where(eq(orders.id, order.id));

        await db.insert(orderStatusHistory).values({
          id: crypto.randomUUID(),
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'confirmed',
          changedByRole: 'customer',
          reason: `Payment verified and captured via ${validatedData.provider.toUpperCase()} (${verification.providerPaymentId || 'tx_ok'})`
        });

        // Publish realtime event to cinema kitchen queue
        const paymentRef = verification.providerPaymentId || transaction.providerPaymentId || validatedData.providerPaymentId || validatedData.providerOrderId;
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        await publishOrderCreated(order.restaurantId, {
          ...order,
          status: 'confirmed',
          paymentStatus: 'paid',
          paymentMethod: validatedData.provider,
          paymentReference: paymentRef
        }, items).catch((err) => console.warn('Realtime publish error in payment verify:', err));

        return res.json({
          success: true,
          verified: true,
          status: 'CAPTURED',
          orderId: order.id,
          transactionId: transaction.id,
          message: verification.message || 'Payment successfully verified and captured'
        });
      }

      // If failed or pending
      await db
        .update(cinemaPaymentTransactions)
        .set({
          status: verification.status,
          providerPaymentId: verification.providerPaymentId || transaction.providerPaymentId,
          updatedAt: new Date()
        })
        .where(eq(cinemaPaymentTransactions.id, transaction.id));

      return res.status(verification.status === 'FAILED' ? 400 : 200).json({
        success: verification.status !== 'FAILED',
        verified: false,
        status: verification.status,
        orderId: order.id,
        transactionId: transaction.id,
        message: verification.message
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cinema/payments/webhook/:theatreId/paytm
 * Handles Paytm server-to-server callback notifications with idempotency.
 */
router.post(
  ['/webhook/:theatreId/paytm', '/webhook/:theatreId/:provider'],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = Array.isArray(req.params.theatreId) ? req.params.theatreId[0] : req.params.theatreId;
      const rawProvider = Array.isArray(req.params.provider) ? req.params.provider[0] : (req.params.provider || 'paytm');
      const providerParam = (rawProvider || 'paytm').toLowerCase() as CinemaPaymentProvider;

      if (!theatreId) {
        throw new AppError('Theatre ID is required for webhook route', 400);
      }

      // 1. Extract payload & event identifier
      const payload = req.body || {};
      const providerEventId =
        (payload.TXNID ||
          payload.txnId ||
          payload.ORDERID ||
          payload.orderId ||
          req.headers['x-paytm-event-id'] ||
          req.headers['x-provider-event-id'] ||
          crypto.randomUUID()) as string;

      // 2. Enforce Idempotency
      const [existingEvent] = await db
        .select()
        .from(cinemaWebhookEvents)
        .where(
          and(
            eq(cinemaWebhookEvents.theatreId, theatreId),
            eq(cinemaWebhookEvents.provider, providerParam),
            eq(cinemaWebhookEvents.providerEventId, providerEventId)
          )
        )
        .limit(1);

      if (existingEvent) {
        return res.status(200).json({
          success: true,
          message: 'Webhook event already processed (idempotent)',
          eventId: providerEventId
        });
      }

      // 3. Fetch theatre's gateway account and decrypt secret
      const [account] = await db
        .select()
        .from(cinemaPaymentAccounts)
        .where(
          and(
            eq(cinemaPaymentAccounts.theatreId, theatreId),
            eq(cinemaPaymentAccounts.provider, providerParam)
          )
        )
        .limit(1);

      if (!account || !account.isVerified) {
        throw new AppError(`Theatre ${theatreId} has no verified ${providerParam} gateway account`, 404);
      }

      const decryptedSecret = decryptSecret(account.encryptedKeySecret);
      const decryptedWebhookSecret = account.encryptedWebhookSecret
        ? decryptSecret(account.encryptedWebhookSecret)
        : null;

      const providerAdapter = getPaymentProvider(providerParam);

      const signature =
        (req.headers['x-paytm-signature'] as string) ||
        (req.headers['x-provider-signature'] as string) ||
        payload.CHECKSUMHASH ||
        payload.checksum ||
        (payload.head && (payload.head as any).signature) ||
        '';

      // 4. Verify signature
      const webhookResult = await providerAdapter.processWebhook({
        credentials: {
          environment: account.environment as 'test' | 'live',
          keyId: account.keyId,
          keySecret: decryptedSecret,
          webhookSecret: decryptedWebhookSecret,
          settings: (account.settings as Record<string, unknown>) || {}
        },
        payload,
        signature
      });

      if (!webhookResult.validSignature) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${providerParam.toUpperCase()} webhook checksum or signature`
        });
      }

      // 5. Correlate with transaction
      const targetOrderId = webhookResult.providerOrderId || payload.ORDERID || payload.orderId;
      const targetPaymentId = webhookResult.providerPaymentId || payload.TXNID || payload.txnId;

      let transaction: typeof cinemaPaymentTransactions.$inferSelect | undefined;

      if (targetOrderId) {
        const [found] = await db
          .select()
          .from(cinemaPaymentTransactions)
          .where(
            and(
              eq(cinemaPaymentTransactions.theatreId, theatreId),
              sql`(${cinemaPaymentTransactions.providerOrderId} = ${targetOrderId} OR ${cinemaPaymentTransactions.orderId} = ${targetOrderId})`
            )
          )
          .limit(1);
        transaction = found;
      }

      // 6. Handle delayed webhooks & status transitions
      if (transaction) {
        // Delayed Webhook Safety: never downgrade CAPTURED transaction to FAILED
        if (transaction.status === 'CAPTURED' && webhookResult.status === 'FAILED') {
          await db.insert(cinemaWebhookEvents).values({
            id: crypto.randomUUID(),
            theatreId,
            provider: providerParam,
            providerEventId,
            eventType: 'delayed_failure_ignored',
            providerOrderId: targetOrderId,
            providerPaymentId: targetPaymentId,
            status: 'duplicate_ignored',
            payload
          });

          return res.status(200).json({
            success: true,
            message: 'Delayed failure webhook ignored: transaction is already CAPTURED'
          });
        }

        if (webhookResult.status === 'CAPTURED') {
          await db
            .update(cinemaPaymentTransactions)
            .set({
              status: 'CAPTURED',
              providerPaymentId: targetPaymentId || transaction.providerPaymentId,
              providerOrderId: targetOrderId || transaction.providerOrderId,
              updatedAt: new Date()
            })
            .where(eq(cinemaPaymentTransactions.id, transaction.id));

          if (transaction.orderId) {
            const [order] = await db
              .select()
              .from(orders)
              .where(eq(orders.id, transaction.orderId))
              .limit(1);

            if (order && order.status === 'pending') {
              await db
                .update(orders)
                .set({
                  status: 'confirmed',
                  paymentStatus: 'paid',
                  paymentMethod: providerParam,
                  paymentReference: targetPaymentId || transaction.providerPaymentId || targetOrderId,
                  updatedAt: new Date()
                })
                .where(eq(orders.id, transaction.orderId));

              await db.insert(orderStatusHistory).values({
                id: crypto.randomUUID(),
                orderId: transaction.orderId,
                fromStatus: order.status,
                toStatus: 'confirmed',
                changedByRole: 'webhook',
                reason: `${providerParam.toUpperCase()} webhook confirmed payment capture (${targetPaymentId || 'tx_ok'})`
              });

              // Publish realtime event to cinema kitchen queue
              const webhookItems = await db.select().from(orderItems).where(eq(orderItems.orderId, transaction.orderId));
              await publishOrderCreated(order.restaurantId, {
                ...order,
                status: 'confirmed',
                paymentStatus: 'paid',
                paymentMethod: providerParam,
                paymentReference: targetPaymentId || transaction.providerPaymentId || targetOrderId
              }, webhookItems).catch((err) => console.warn('Realtime publish error in webhook:', err));
            }
          }
        } else if (webhookResult.status === 'FAILED' && transaction.status !== 'CAPTURED') {
          await db
            .update(cinemaPaymentTransactions)
            .set({
              status: 'FAILED',
              providerPaymentId: targetPaymentId || transaction.providerPaymentId,
              updatedAt: new Date()
            })
            .where(eq(cinemaPaymentTransactions.id, transaction.id));
        }
      }

      // 7. Record event in cinemaWebhookEvents for idempotency audit
      await db.insert(cinemaWebhookEvents).values({
        id: crypto.randomUUID(),
        theatreId,
        provider: providerParam,
        providerEventId,
        eventType: webhookResult.eventType,
        providerOrderId: targetOrderId,
        providerPaymentId: targetPaymentId,
        status: 'processed',
        payload
      });

      return res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        eventId: providerEventId
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
