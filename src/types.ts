export type CurrencyCode = 'NPR' | 'KRW' | 'GBP';
export type CalendarMode = 'AD' | 'BS';
export type ThemeMode = 'light' | 'dark';
export type TransactionType = 'expense' | 'income' | 'credit';
export type CreditDirection = 'payable' | 'receivable';
export type FilterTab = 'all' | 'expense' | 'income' | 'credit';
export type ActiveView = 'dashboard' | 'planner' | 'credit' | 'tracker';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD (AD normalized)
  creditDirection?: CreditDirection;
  partyName?: string;
  dueDate?: string; // YYYY-MM-DD
  linkedCreditId?: string;
  isCreditSettlement?: boolean;
  createdAt: string;
}

export interface CreditPaymentRecord {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  linkedSettlementTxId?: string;
}

export interface CreditItem {
  id: string;
  direction: CreditDirection; // 'payable' (To Pay) | 'receivable' (To Receive)
  partyName: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  category: string;
  createdAt: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'partial' | 'settled';
  payments: CreditPaymentRecord[];
  linkedTransactionId?: string;
}

export interface PlannerCategoryEstimate {
  category: string;
  estimatedAmount: number;
}

export interface KharchaPlan {
  expectedMonthlyIncome: number;
  categoryEstimates: PlannerCategoryEstimate[];
}

export interface AppSettings {
  currency: CurrencyCode;
  calendar: CalendarMode;
  theme: ThemeMode;
  salaryCycleDay: number; // 1 - 31
  monthlyBudgetLimit: number;
  exchangeRatesToNPR: Record<CurrencyCode, number>;
}

export interface MeroKhataBackup {
  app: 'mero-khata';
  version: number;
  exportedAt: string;
  settings: AppSettings;
  transactions: Transaction[];
  creditLedger: CreditItem[];
  kharchaPlan: KharchaPlan;
}

export interface SmartParseResult {
  type: TransactionType;
  rawAmount: number;
  detectedCurrency: CurrencyCode;
  convertedAmount: number;
  wasConverted: boolean;
  category: string;
  description: string;
  date: string;
  creditDirection?: CreditDirection;
  partyName?: string;
  dueDate?: string;
  source: 'gemini-api' | 'client-fallback';
  confidenceNote?: string;
}
