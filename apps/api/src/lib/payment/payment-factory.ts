import { CinemaPaymentProvider } from '@menugo/shared';
import { PaymentProvider } from './payment-provider.interface';
import { RazorpayPaymentProvider } from './razorpay.adapter';
import { PaytmPaymentProvider } from './paytm.adapter';

export function getPaymentProvider(provider: CinemaPaymentProvider): PaymentProvider {
  switch (provider) {
    case 'razorpay':
      return new RazorpayPaymentProvider();
    case 'paytm':
      return new PaytmPaymentProvider();
    default:
      throw new Error(`Unsupported payment provider: ${provider}`);
  }
}

export * from './payment-provider.interface';
export * from './razorpay.adapter';
export * from './paytm.adapter';
