import { CurrencyCode } from '../types';

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  name: string;
  nepaliLabel: string;
  flag: string;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  NPR: {
    code: 'NPR',
    symbol: 'रु',
    name: 'Nepalese Rupee',
    nepaliLabel: 'नेपाली रूपैयाँ',
    flag: '🇳🇵',
    decimals: 2,
  },
  KRW: {
    code: 'KRW',
    symbol: '₩',
    name: 'South Korean Won',
    nepaliLabel: 'कोरियन वोन',
    flag: '🇰🇷',
    decimals: 0,
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    nepaliLabel: 'बेलायती पाउण्ड',
    flag: '🇬🇧',
    decimals: 2,
  },
};

/**
 * Default exchange rates expressed in NPR per 1 unit of currency:
 * - 1 NPR = 1 NPR
 * - 1 KRW = 0.10 NPR (1 NPR = 10 KRW)
 * - 1 GBP = 170 NPR
 */
export const DEFAULT_RATES_TO_NPR: Record<CurrencyCode, number> = {
  NPR: 1,
  KRW: 0.1,
  GBP: 170,
};

export function roundForCurrency(amount: number, currency: CurrencyCode): number {
  if (!Number.isFinite(amount)) return 0;
  if (currency === 'KRW') {
    return Math.round(amount);
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Converts an amount from `fromCurrency` to `toCurrency` exactly once.
 * If `fromCurrency === toCurrency`, returns the original amount untouched.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  ratesToNPR: Record<CurrencyCode, number> = DEFAULT_RATES_TO_NPR
): number {
  if (!Number.isFinite(amount)) return 0;
  if (fromCurrency === toCurrency) {
    return roundForCurrency(amount, toCurrency);
  }
  const fromRate = ratesToNPR[fromCurrency] || DEFAULT_RATES_TO_NPR[fromCurrency];
  const toRate = ratesToNPR[toCurrency] || DEFAULT_RATES_TO_NPR[toCurrency];
  const amountInNPR = amount * fromRate;
  const converted = amountInNPR / toRate;
  return roundForCurrency(converted, toCurrency);
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  options?: { compact?: boolean; showSign?: boolean }
): string {
  const meta = CURRENCIES[currency];
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const absAmount = Math.abs(safeAmount);
  const signPrefix =
    safeAmount < 0 ? '-' : options?.showSign && safeAmount > 0 ? '+' : '';

  if (options?.compact && absAmount >= 100000) {
    if (currency === 'NPR') {
      const lakhs = absAmount / 100000;
      return `${signPrefix}${meta.symbol} ${lakhs.toFixed(2)}L`;
    }
    const k = absAmount / 1000;
    return `${signPrefix}${meta.symbol}${k.toFixed(1)}k`;
  }

  if (currency === 'KRW') {
    const formatted = Math.round(absAmount).toLocaleString('en-US');
    return `${signPrefix}${meta.symbol}${formatted}`;
  }

  if (currency === 'GBP') {
    const formatted = absAmount.toLocaleString('en-GB', {
      minimumFractionDigits: absAmount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return `${signPrefix}${meta.symbol}${formatted}`;
  }

  // NPR formatting
  const formatted = absAmount.toLocaleString('en-IN', {
    minimumFractionDigits: absAmount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${signPrefix}${meta.symbol} ${formatted}`;
}

export interface CategoryInfo {
  name: string;
  nepaliName: string;
  type: 'expense' | 'income' | 'both';
  color: string;
  bgLight: string;
  textColor: string;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    name: 'Food & Dining',
    nepaliName: 'खाना र खाजा',
    type: 'expense',
    color: '#ef4444',
    bgLight: 'bg-red-500/10',
    textColor: 'text-red-600 dark:text-red-400',
  },
  {
    name: 'Groceries',
    nepaliName: 'किराना र तरकारी',
    type: 'expense',
    color: '#10b981',
    bgLight: 'bg-emerald-500/10',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    name: 'Rent & Utilities',
    nepaliName: 'कोठा भाडा र बिल',
    type: 'expense',
    color: '#6366f1',
    bgLight: 'bg-indigo-500/10',
    textColor: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    name: 'Transport',
    nepaliName: 'यातायात',
    type: 'expense',
    color: '#f59e0b',
    bgLight: 'bg-amber-500/10',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    name: 'Remittance & Family',
    nepaliName: 'रेमिट्यान्स र परिवार',
    type: 'both',
    color: '#ec4899',
    bgLight: 'bg-pink-500/10',
    textColor: 'text-pink-600 dark:text-pink-400',
  },
  {
    name: 'Shopping',
    nepaliName: 'किनमेल',
    type: 'expense',
    color: '#8b5cf6',
    bgLight: 'bg-violet-500/10',
    textColor: 'text-violet-600 dark:text-violet-400',
  },
  {
    name: 'Healthcare',
    nepaliName: 'स्वास्थ्य र औषधि',
    type: 'expense',
    color: '#06b6d4',
    bgLight: 'bg-cyan-500/10',
    textColor: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    name: 'Entertainment',
    nepaliName: 'मनोरञ्जन',
    type: 'expense',
    color: '#f97316',
    bgLight: 'bg-orange-500/10',
    textColor: 'text-orange-600 dark:text-orange-400',
  },
  {
    name: 'Education',
    nepaliName: 'शिक्षा',
    type: 'expense',
    color: '#3b82f6',
    bgLight: 'bg-blue-500/10',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    name: 'Savings & Investment',
    nepaliName: 'बचत र लगानी',
    type: 'both',
    color: '#14b8a6',
    bgLight: 'bg-teal-500/10',
    textColor: 'text-teal-600 dark:text-teal-400',
  },
  {
    name: 'Salary & Freelance',
    nepaliName: 'तलब र आम्दानी',
    type: 'income',
    color: '#22c55e',
    bgLight: 'bg-green-500/10',
    textColor: 'text-green-600 dark:text-green-400',
  },
  {
    name: 'Udharo / Credit',
    nepaliName: 'उधारो कारोबार',
    type: 'both',
    color: '#eab308',
    bgLight: 'bg-yellow-500/10',
    textColor: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    name: 'Others',
    nepaliName: 'अन्य',
    type: 'both',
    color: '#64748b',
    bgLight: 'bg-slate-500/10',
    textColor: 'text-slate-600 dark:text-slate-400',
  },
];

export const EXPENSE_CATEGORIES = CATEGORIES.filter(
  (c) => c.type === 'expense' || c.type === 'both'
).map((c) => c.name);

export const INCOME_CATEGORIES = CATEGORIES.filter(
  (c) => c.type === 'income' || c.type === 'both'
).map((c) => c.name);

export function getCategoryMeta(categoryName: string): CategoryInfo {
  return (
    CATEGORIES.find((c) => c.name.toLowerCase() === categoryName.toLowerCase()) ||
    CATEGORIES[CATEGORIES.length - 1]
  );
}
