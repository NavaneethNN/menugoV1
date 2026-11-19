import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-auth';
import { AppError } from '../middleware/error-handler';
import {
  getTenantInvoices,
  getTenantInvoiceById,
  getTenantUsageSummary,
  calculateTenantCost,
  payTenantInvoice,
  generateTenantInvoice
} from '../lib/billing-engine';

export const billingRouter = Router();

// Enforce authentication & tenant boundary on all tenant billing endpoints
billingRouter.use(requireAuth);
billingRouter.use(requireTenant());

/**
 * GET /api/billing/invoices
 * Retrieves invoices strictly scoped to the authenticated tenant.
 */
billingRouter.get('/invoices', async (req: Request, res: Response, next) => {
  try {
    const tenantId = req.tenant!.restaurantId;
    const invoices = await getTenantInvoices(tenantId);
    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/billing/invoices/:id
 * Retrieves a single invoice, verifying that it belongs to the authenticated tenant.
 */
billingRouter.get('/invoices/:id', async (req: Request, res: Response, next) => {
  try {
    const tenantId = req.tenant!.restaurantId;
    const invoiceId = req.params.id as string;

    const invoice = await getTenantInvoiceById(tenantId, invoiceId);
    if (!invoice) {
      throw new AppError('Invoice not found or access denied', 404);
    }

    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/billing/invoices/:id/pay
 * Pays/settles a tenant usage invoice.
 */
billingRouter.post('/invoices/:id/pay', async (req: Request, res: Response, next) => {
  try {
    const tenantId = req.tenant!.restaurantId;
    const invoiceId = req.params.id as string;

    const invoice = await payTenantInvoice(tenantId, invoiceId, req.body);
    res.json({
      success: true,
      message: 'Invoice paid successfully',
      invoice
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/billing/pay-current-usage
 * Generates month-to-date invoice and settles payment for current metered usage.
 */
billingRouter.post('/pay-current-usage', async (req: Request, res: Response, next) => {
  try {
    const tenantId = req.tenant!.restaurantId;
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = now;

    // Issue invoice for month-to-date consumption
    const invoice = await generateTenantInvoice({
      restaurantId: tenantId,
      periodStart,
      periodEnd
    });

    if (!invoice) {
      throw new AppError('Failed to generate tenant invoice for current period', 500);
    }

    const paidInvoice = await payTenantInvoice(tenantId, invoice.id, req.body);
    res.json({
      success: true,
      message: 'Monthly metered usage settled successfully',
      invoice: paidInvoice
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/billing/usage
 * Retrieves usage event summaries strictly for the authenticated tenant.
 */
billingRouter.get('/usage', async (req: Request, res: Response, next) => {
  try {
    const tenantId = req.tenant!.restaurantId;
    const period = req.query.period as string | undefined;

    const usage = await getTenantUsageSummary(tenantId, period);
    res.json(usage);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/billing/current-ledger
 * Computes current month-to-date tenant cost ledger and gross margin.
 */
billingRouter.get('/current-ledger', async (req: Request, res: Response, next) => {
  try {
    const tenantId = req.tenant!.restaurantId;
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = now;

    const ledger = await calculateTenantCost(tenantId, periodStart, periodEnd);
    res.json(ledger);
  } catch (error) {
    next(error);
  }
});
