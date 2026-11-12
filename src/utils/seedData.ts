import {
  AppSettings,
  CreditItem,
  KharchaPlan,
  Transaction,
} from '../types';
import { addDaysMidnight, toISODate } from './calendar';
import { DEFAULT_RATES_TO_NPR } from './currency';

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'NPR',
  calendar: 'BS',
  theme: 'dark',
  salaryCycleDay: 1,
  monthlyBudgetLimit: 55000,
  exchangeRatesToNPR: { ...DEFAULT_RATES_TO_NPR },
};

export function createInitialSeedData(todayISO: string = toISODate()): {
  transactions: Transaction[];
  creditLedger: CreditItem[];
  kharchaPlan: KharchaPlan;
} {
  const d0 = todayISO;
  const d1 = toISODate(addDaysMidnight(todayISO, -1));
  const d2 = toISODate(addDaysMidnight(todayISO, -3));
  const d3 = toISODate(addDaysMidnight(todayISO, -5));
  const d4 = toISODate(addDaysMidnight(todayISO, -8));
  const d5 = toISODate(addDaysMidnight(todayISO, -10));
  const dueSoon = toISODate(addDaysMidnight(todayISO, 5));
  const dueLater = toISODate(addDaysMidnight(todayISO, 12));

  const txCredit1Id = 'tx-seed-credit-1';
  const credit1Id = 'cr-seed-1';

  const txCredit2Id = 'tx-seed-credit-2';
  const credit2Id = 'cr-seed-2';

  const transactions: Transaction[] = [
    {
      id: 'tx-seed-1',
      type: 'income',
      amount: 85000,
      category: 'Salary & Freelance',
      description: 'Monthly Tech Salary Deposit',
      date: d5,
      createdAt: d5,
    },
    {
      id: 'tx-seed-2',
      type: 'expense',
      amount: 16000,
      category: 'Rent & Utilities',
      description: 'Flat Rent & WorldLink Fiber Internet',
      date: d4,
      createdAt: d4,
    },
    {
      id: 'tx-seed-3',
      type: 'expense',
      amount: 6400,
      category: 'Groceries',
      description: 'Bhatbhateni Monthly Groceries & Tarkari',
      date: d3,
      createdAt: d3,
    },
    {
      id: txCredit1Id,
      type: 'credit',
      amount: 4500,
      category: 'Udharo / Credit',
      description: 'Kirana Store Monthly Ration (उधारो)',
      date: d2,
      creditDirection: 'payable',
      partyName: 'Newa Kirana Pasal',
      dueDate: dueSoon,
      linkedCreditId: credit1Id,
      createdAt: d2,
    },
    {
      id: 'tx-seed-4',
      type: 'expense',
      amount: 2200,
      category: 'Food & Dining',
      description: 'Thakali Khana & Momo with Friends',
      date: d1,
      createdAt: d1,
    },
    {
      id: 'tx-seed-5',
      type: 'expense',
      amount: 1850,
      category: 'Transport',
      description: 'Scooter Petrol & Pathao Rides',
      date: d0,
      createdAt: d0,
    },
    {
      id: txCredit2Id,
      type: 'credit',
      amount: 8000,
      category: 'Udharo / Credit',
      description: 'Emergency Cash Lent to Suman (सापटी)',
      date: d1,
      creditDirection: 'receivable',
      partyName: 'Suman Shrestha',
      dueDate: dueLater,
      linkedCreditId: credit2Id,
      createdAt: d1,
    },
  ];

  const creditLedger: CreditItem[] = [
    {
      id: credit1Id,
      direction: 'payable',
      partyName: 'Newa Kirana Pasal',
      description: 'Kirana Store Monthly Ration (उधारो)',
      totalAmount: 4500,
      paidAmount: 1500,
      category: 'Groceries',
      createdAt: d2,
      dueDate: dueSoon,
      status: 'partial',
      payments: [
        {
          id: 'pay-seed-1',
          amount: 1500,
          date: d1,
          note: 'Initial cash advance via eSewa',
        },
      ],
      linkedTransactionId: txCredit1Id,
    },
    {
      id: credit2Id,
      direction: 'receivable',
      partyName: 'Suman Shrestha',
      description: 'Emergency Cash Lent to Suman (सापटी)',
      totalAmount: 8000,
      paidAmount: 0,
      category: 'Udharo / Credit',
      createdAt: d1,
      dueDate: dueLater,
      status: 'pending',
      payments: [],
      linkedTransactionId: txCredit2Id,
    },
  ];

  const kharchaPlan: KharchaPlan = {
    expectedMonthlyIncome: 85000,
    categoryEstimates: [
      { category: 'Rent & Utilities', estimatedAmount: 18000 },
      { category: 'Groceries', estimatedAmount: 10000 },
      { category: 'Food & Dining', estimatedAmount: 6000 },
      { category: 'Transport', estimatedAmount: 4000 },
      { category: 'Remittance & Family', estimatedAmount: 10000 },
      { category: 'Shopping', estimatedAmount: 4000 },
      { category: 'Healthcare', estimatedAmount: 2000 },
      { category: 'Entertainment', estimatedAmount: 3000 },
      { category: 'Savings & Investment', estimatedAmount: 15000 },
    ],
  };

  return { transactions, creditLedger, kharchaPlan };
}
