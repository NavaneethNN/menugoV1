import {
  CinemaPaymentProvider,
  CinemaPaymentStatus,
  CinemaRefundStatus
} from '@menugo/shared';

export interface PaymentCredentials {
  environment: 'test' | 'live';
  keyId: string; // Razorpay Key ID or Paytm MID
  keySecret: string; // Decrypted merchant key/secret
  webhookSecret?: string | null;
  settings?: Record<string, unknown>;
}

export interface ConnectionVerificationResult {
  success: boolean;
  provider: CinemaPaymentProvider;
  merchantName?: string;
  accountStatus?: string;
  message: string;
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface CreatePaymentOrderParams {
  credentials: PaymentCredentials;
  orderId: string;
  theatreId: string;
  amount: number; // in integer paise
  currency: string; // 'INR'
  receipt: string;
  notes?: Record<string, string>;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
}

export interface PaymentOrderResult {
  success: boolean;
  providerOrderId: string;
  amount: number;
  currency: string;
  providerPayload?: Record<string, unknown>;
  status: CinemaPaymentStatus;
}

export interface VerifyPaymentParams {
  credentials: PaymentCredentials;
  orderId: string;
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature?: string;
  expectedAmount?: number;
  responsePayload?: Record<string, unknown>;
}

export interface PaymentVerificationResult {
  verified: boolean;
  status: CinemaPaymentStatus;
  providerPaymentId: string;
  providerOrderId: string;
  amount: number;
  message?: string;
}

export interface ProcessWebhookParams {
  credentials: PaymentCredentials;
  payload: string | Record<string, unknown>;
  signature?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface WebhookProcessResult {
  validSignature: boolean;
  eventType: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  status?: CinemaPaymentStatus;
  rawEvent?: Record<string, unknown>;
}

export interface InitiateRefundParams {
  credentials: PaymentCredentials;
  transactionId: string;
  providerPaymentId: string;
  amount: number; // in integer paise
  reason?: string;
  notes?: Record<string, string>;
}

export interface RefundResult {
  success: boolean;
  providerRefundId?: string;
  status: CinemaRefundStatus;
  amount: number;
  message?: string;
  rawResponse?: Record<string, unknown>;
}

export interface GetPaymentStatusParams {
  credentials: PaymentCredentials;
  providerPaymentId?: string;
  providerOrderId?: string;
}

export interface PaymentStatusResult {
  status: CinemaPaymentStatus;
  amount: number;
  currency: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  rawStatus?: string;
}

/**
 * Common Payment Provider Interface
 * Each payment gateway (Razorpay, Paytm) implements this interface.
 */
export interface PaymentProvider {
  readonly providerName: CinemaPaymentProvider;

  /**
   * Verifies that the theatre's merchant credentials are valid and active.
   */
  verifyConnection(credentials: PaymentCredentials): Promise<ConnectionVerificationResult>;

  /**
   * Creates a payment order directly on the theatre's merchant account.
   */
  createPaymentOrder(params: CreatePaymentOrderParams): Promise<PaymentOrderResult>;

  /**
   * Verifies payment signatures and transaction status server-to-server.
   */
  verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResult>;

  /**
   * Authenticates and processes incoming provider webhooks.
   */
  processWebhook(params: ProcessWebhookParams): Promise<WebhookProcessResult>;

  /**
   * Initiates a refund directly from the theatre's merchant account.
   */
  initiateRefund(params: InitiateRefundParams): Promise<RefundResult>;

  /**
   * Fetches latest status of a payment directly from the gateway.
   */
  getPaymentStatus(params: GetPaymentStatusParams): Promise<PaymentStatusResult>;
}
