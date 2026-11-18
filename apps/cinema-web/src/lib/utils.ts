import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatPaise } from '@menugo/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amountInPaise: number | string, currency = 'INR'): string {
  const paise = typeof amountInPaise === 'string' ? parseInt(amountInPaise, 10) : amountInPaise;
  return formatPaise(isNaN(paise) ? 0 : paise, currency);
}

export { formatPaise };

