import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  ActiveView,
  AppSettings,
  CreditItem,
  CurrencyCode,
  KharchaPlan,
  MeroKhataBackup,
  Transaction,
} from './types';
import {
  addDaysMidnight,
  getSalaryCycleWindow,
  isDateInCycle,
  toISODate,
} from './utils/calendar';
import { convertCurrency, roundForCurrency } from './utils/currency';
import { createInitialSeedData, DEFAULT_SETTINGS } from './utils/seedData';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import {
  AddEntryModal,
  NewTransactionPayload,
} from './components/AddEntryModal';
import { KharchaPlannerView } from './components/KharchaPlannerView';
import {
  CreditLedgerView,
  NewCreditLedgerPayload,
} from './components/CreditLedgerView';
import { MonthlyTrackerView } from './components/MonthlyTrackerView';

const STORAGE_KEY = 'mero_khata_v1_state';

interface StoredAppState {
  settings: AppSettings;
  transactions: Transaction[];
  creditLedger: CreditItem[];
  kharchaPlan: KharchaPlan;
}

function loadInitialState(): StoredAppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredAppState>;
      if (
        parsed &&
        parsed.settings &&
        Array.isArray(parsed.transactions) &&
        Array.isArray(parsed.creditLedger) &&
        parsed.kharchaPlan
      ) {
        return {
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          transactions: parsed.transactions,
          creditLedger: parsed.creditLedger,
          kharchaPlan: parsed.kharchaPlan,
        };
      }
    }
  } catch {
    // Fallback to initial seed data if localStorage is unavailable or corrupted
  }
  const seed = createInitialSeedData();
  return {
    settings: { ...DEFAULT_SETTINGS },
    ...seed,
  };
}

export const App: React.FC = () => {
  const [appState, setAppState] = useState<StoredAppState>(() =>
    loadInitialState()
  );
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [cycleOffset, setCycleOffset] = useState<number>(0);

  // Add / Edit Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalMode, setAddModalMode] = useState<'manual' | 'smart'>('manual');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const { settings, transactions, creditLedger, kharchaPlan } = appState;

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch {
      // Ignore storage quota errors
    }
  }, [appState]);

  // Apply Dark/Light theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Compute current Salary Cycle Window with midnight-normalized day counts
  const cycleWindow = useMemo(() => {
    return getSalaryCycleWindow(settings.salaryCycleDay, cycleOffset);
  }, [settings.salaryCycleDay, cycleOffset]);

  // Filter transactions belonging to the active salary cycle
  const cycleTransactions = useMemo(() => {
    return transactions.filter((tx) => isDateInCycle(tx.date, cycleWindow));
  }, [transactions, cycleWindow]);

  // Global Currency Switcher: converts all stored monetary values cleanly
  const handleCurrencyChange = (newCurrency: CurrencyCode) => {
    if (newCurrency === settings.currency) return;

    setAppState((prev) => {
      const fromCurrency = prev.settings.currency;
      const rates = prev.settings.exchangeRatesToNPR;
      const conv = (val: number) =>
        convertCurrency(val, fromCurrency, newCurrency, rates);

      const convertedTransactions = prev.transactions.map((tx) => ({
        ...tx,
        amount: conv(tx.amount),
      }));

      const convertedCreditLedger = prev.creditLedger.map((cr) => ({
        ...cr,
        totalAmount: conv(cr.totalAmount),
        paidAmount: conv(cr.paidAmount),
        payments: cr.payments.map((p) => ({
          ...p,
          amount: conv(p.amount),
        })),
      }));

      const convertedPlan: KharchaPlan = {
        expectedMonthlyIncome: conv(prev.kharchaPlan.expectedMonthlyIncome),
        categoryEstimates: prev.kharchaPlan.categoryEstimates.map((est) => ({
          ...est,
          estimatedAmount: conv(est.estimatedAmount),
        })),
      };

      return {
        settings: {
          ...prev.settings,
          currency: newCurrency,
          monthlyBudgetLimit: conv(prev.settings.monthlyBudgetLimit),
        },
        transactions: convertedTransactions,
        creditLedger: convertedCreditLedger,
        kharchaPlan: convertedPlan,
      };
    });
  };

  const handleCalendarToggle = () => {
    setAppState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        calendar: prev.settings.calendar === 'BS' ? 'AD' : 'BS',
      },
    }));
  };

  const handleThemeToggle = () => {
    setAppState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme: prev.settings.theme === 'dark' ? 'light' : 'dark',
      },
    }));
  };

  const handleSalaryCycleDayChange = (day: number) => {
    const safeDay = Math.max(1, Math.min(31, Math.round(day || 1)));
    setCycleOffset(0);
    setAppState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        salaryCycleDay: safeDay,
      },
    }));
  };

  const handleBudgetLimitChange = (limit: number) => {
    setAppState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        monthlyBudgetLimit: roundForCurrency(limit, prev.settings.currency),
      },
    }));
  };

  // Add or Edit Transaction (with Two-Way Credit Ledger Sync)
  const handleSaveTransaction = (
    payload: NewTransactionPayload,
    existingId?: string
  ) => {
    setAppState((prev) => {
      const nowISO = toISODate();

      if (existingId) {
        // Editing an existing transaction
        const existingTx = prev.transactions.find((t) => t.id === existingId);
        if (!existingTx) return prev;

        let updatedCreditLedger = [...prev.creditLedger];
        let linkedCreditId = existingTx.linkedCreditId;

        if (payload.type === 'credit') {
          if (linkedCreditId) {
            // Update existing linked credit item
            updatedCreditLedger = updatedCreditLedger.map((cr) => {
              if (cr.id !== linkedCreditId) return cr;
              const newTotal = payload.amount;
              const newStatus: CreditItem['status'] =
                cr.paidAmount >= newTotal
                  ? 'settled'
                  : cr.paidAmount > 0
                  ? 'partial'
                  : 'pending';
              return {
                ...cr,
                direction: payload.creditDirection || 'payable',
                partyName: payload.partyName || cr.partyName,
                description: payload.description,
                totalAmount: newTotal,
                category: payload.category,
                createdAt: payload.date,
                dueDate: payload.dueDate || cr.dueDate,
                status: newStatus,
              };
            });
          } else {
            // Transaction changed to credit: create linked CreditItem
            linkedCreditId = `cr-${Date.now()}`;
            const newCreditItem: CreditItem = {
              id: linkedCreditId,
              direction: payload.creditDirection || 'payable',
              partyName: payload.partyName || 'Contact',
              description: payload.description,
              totalAmount: payload.amount,
              paidAmount: 0,
              category: payload.category,
              createdAt: payload.date,
              dueDate:
                payload.dueDate || toISODate(addDaysMidnight(payload.date, 14)),
              status: 'pending',
              payments: [],
              linkedTransactionId: existingId,
            };
            updatedCreditLedger = [newCreditItem, ...updatedCreditLedger];
          }
        } else if (linkedCreditId) {
          // Changed from credit to cash expense/income: remove linked credit entry
          updatedCreditLedger = updatedCreditLedger.filter(
            (cr) => cr.id !== linkedCreditId
          );
          linkedCreditId = undefined;
        }

        const updatedTransactions = prev.transactions.map((tx) =>
          tx.id === existingId
            ? {
                ...tx,
                type: payload.type,
                amount: payload.amount,
                category: payload.category,
                description: payload.description,
                date: payload.date,
                creditDirection:
                  payload.type === 'credit'
                    ? payload.creditDirection
                    : undefined,
                partyName:
                  payload.type === 'credit' ? payload.partyName : undefined,
                dueDate: payload.type === 'credit' ? payload.dueDate : undefined,
                linkedCreditId,
              }
            : tx
        );

        return {
          ...prev,
          transactions: updatedTransactions,
          creditLedger: updatedCreditLedger,
        };
      }

      // Creating a brand-new transaction
      const newTxId = `tx-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      let linkedCreditId: string | undefined;
      let updatedCreditLedger = prev.creditLedger;

      if (payload.type === 'credit') {
        linkedCreditId = `cr-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        const newCreditItem: CreditItem = {
          id: linkedCreditId,
          direction: payload.creditDirection || 'payable',
          partyName: payload.partyName || 'Contact',
          description: payload.description,
          totalAmount: payload.amount,
          paidAmount: 0,
          category: payload.category,
          createdAt: payload.date,
          dueDate:
            payload.dueDate || toISODate(addDaysMidnight(payload.date, 14)),
          status: 'pending',
          payments: [],
          linkedTransactionId: newTxId,
        };
        updatedCreditLedger = [newCreditItem, ...prev.creditLedger];
      }

      const newTx: Transaction = {
        id: newTxId,
        type: payload.type,
        amount: payload.amount,
        category: payload.category,
        description: payload.description,
        date: payload.date,
        creditDirection:
          payload.type === 'credit' ? payload.creditDirection : undefined,
        partyName: payload.type === 'credit' ? payload.partyName : undefined,
        dueDate: payload.type === 'credit' ? payload.dueDate : undefined,
        linkedCreditId,
        createdAt: nowISO,
      };

      return {
        ...prev,
        transactions: [newTx, ...prev.transactions],
        creditLedger: updatedCreditLedger,
      };
    });
  };

  // Delete Transaction (and two-way delete linked CreditItem if present)
  const handleDeleteTransaction = (txId: string) => {
    setAppState((prev) => {
      const target = prev.transactions.find((t) => t.id === txId);
      const updatedTransactions = prev.transactions.filter(
        (t) => t.id !== txId
      );
      const updatedCreditLedger = target?.linkedCreditId
        ? prev.creditLedger.filter(
            (cr) =>
              cr.id !== target.linkedCreditId &&
              cr.linkedTransactionId !== txId
          )
        : prev.creditLedger.filter((cr) => cr.linkedTransactionId !== txId);

      return {
        ...prev,
        transactions: updatedTransactions,
        creditLedger: updatedCreditLedger,
      };
    });
  };

  // Add Credit/Debt from Credit Ledger (and two-way create linked Dashboard credit transaction)
  const handleAddCreditItem = (payload: NewCreditLedgerPayload) => {
    setAppState((prev) => {
      const newCreditId = `cr-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const newTxId = `tx-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;

      const newCreditItem: CreditItem = {
        id: newCreditId,
        direction: payload.direction,
        partyName: payload.partyName,
        description: payload.description,
        totalAmount: payload.totalAmount,
        paidAmount: 0,
        category: payload.category,
        createdAt: payload.createdAt,
        dueDate: payload.dueDate,
        status: 'pending',
        payments: [],
        linkedTransactionId: newTxId,
      };

      const linkedDashboardTx: Transaction = {
        id: newTxId,
        type: 'credit',
        amount: payload.totalAmount,
        category: payload.category,
        description: payload.description,
        date: payload.createdAt,
        creditDirection: payload.direction,
        partyName: payload.partyName,
        dueDate: payload.dueDate,
        linkedCreditId: newCreditId,
        createdAt: toISODate(),
      };

      return {
        ...prev,
        transactions: [linkedDashboardTx, ...prev.transactions],
        creditLedger: [newCreditItem, ...prev.creditLedger],
      };
    });
  };

  // Record Partial or Full Payment on a Credit Item (with two-way sync to Dashboard)
  const handleRecordCreditPayment = (
    creditId: string,
    paymentAmount: number,
    note: string,
    recordCashTx: boolean
  ) => {
    setAppState((prev) => {
      const target = prev.creditLedger.find((cr) => cr.id === creditId);
      if (!target) return prev;

      const today = toISODate();
      const newPaidAmount = roundForCurrency(
        Math.min(target.totalAmount, target.paidAmount + paymentAmount),
        prev.settings.currency
      );
      const newRemaining = roundForCurrency(
        Math.max(0, target.totalAmount - newPaidAmount),
        prev.settings.currency
      );
      const isSettled = newRemaining <= 0;

      const settlementTxId = recordCashTx
        ? `tx-settle-${Date.now()}`
        : undefined;

      const updatedCreditLedger = prev.creditLedger.map((cr) => {
        if (cr.id !== creditId) return cr;
        return {
          ...cr,
          paidAmount: newPaidAmount,
          status: (isSettled ? 'settled' : 'partial') as CreditItem['status'],
          payments: [
            ...cr.payments,
            {
              id: `pay-${Date.now()}`,
              amount: paymentAmount,
              date: today,
              note,
              linkedSettlementTxId: settlementTxId,
            },
          ],
        };
      });

      // Sync the linked Dashboard credit transaction amount to reflect remaining unsettled credit
      let updatedTransactions = prev.transactions.map((tx) => {
        if (
          tx.id === target.linkedTransactionId ||
          tx.linkedCreditId === creditId
        ) {
          return {
            ...tx,
            amount: newRemaining,
            description: isSettled
              ? `${target.description} (Settled)`
              : `${target.description} (Paid ${newPaidAmount}/${target.totalAmount})`,
          };
        }
        return tx;
      });

      // Optionally log the cash settlement entry on Dashboard
      if (recordCashTx && settlementTxId) {
        const cashSettlementTx: Transaction = {
          id: settlementTxId,
          type: target.direction === 'payable' ? 'expense' : 'income',
          amount: paymentAmount,
          category: 'Udharo / Credit',
          description: `${
            target.direction === 'payable'
              ? 'Paid Udharo to'
              : 'Received Udharo from'
          } ${target.partyName} (${note})`,
          date: today,
          partyName: target.partyName,
          isCreditSettlement: true,
          createdAt: today,
        };
        updatedTransactions = [cashSettlementTx, ...updatedTransactions];
      }

      return {
        ...prev,
        transactions: updatedTransactions,
        creditLedger: updatedCreditLedger,
      };
    });
  };

  // Delete Credit Item (and two-way delete linked Dashboard credit transaction)
  const handleDeleteCreditItem = (creditId: string) => {
    setAppState((prev) => {
      const target = prev.creditLedger.find((cr) => cr.id === creditId);
      const updatedCreditLedger = prev.creditLedger.filter(
        (cr) => cr.id !== creditId
      );
      const updatedTransactions = prev.transactions.filter(
        (tx) =>
          tx.linkedCreditId !== creditId &&
          (!target?.linkedTransactionId || tx.id !== target.linkedTransactionId)
      );
      return {
        ...prev,
        transactions: updatedTransactions,
        creditLedger: updatedCreditLedger,
      };
    });
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    const backup: MeroKhataBackup = {
      app: 'mero-khata',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      transactions,
      creditLedger,
      kharchaPlan,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mero-khata-backup-${toISODate()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Restore JSON Backup
  const handleRestoreBackup = (backup: MeroKhataBackup) => {
    setAppState({
      settings: { ...DEFAULT_SETTINGS, ...backup.settings },
      transactions: backup.transactions,
      creditLedger: backup.creditLedger,
      kharchaPlan:
        backup.kharchaPlan || createInitialSeedData().kharchaPlan,
    });
    setCycleOffset(0);
  };

  const handleResetDemoData = () => {
    const seed = createInitialSeedData();
    setAppState({
      settings: { ...DEFAULT_SETTINGS, theme: settings.theme },
      ...seed,
    });
    setCycleOffset(0);
  };

  const activeCreditCount = useMemo(() => {
    return creditLedger.filter(
      (c) => c.status !== 'settled' && c.paidAmount < c.totalAmount
    ).length;
  }, [creditLedger]);

  const navItems: Array<{
    id: ActiveView;
    label: string;
    nepali: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      nepali: 'ड्यासबोर्ड',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'planner',
      label: 'Kharcha Planner',
      nepali: 'खर्च योजना',
      icon: <ClipboardList className="w-4 h-4" />,
    },
    {
      id: 'credit',
      label: 'Credit & Debt',
      nepali: 'उधारो खाता',
      icon: <HandCoins className="w-4 h-4" />,
      badge: activeCreditCount,
    },
    {
      id: 'tracker',
      label: 'Monthly Tracker',
      nepali: 'मासिक ट्र्याकर',
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 sm:pb-10">
      {/* Top Global Header */}
      <Header
        currency={settings.currency}
        calendar={settings.calendar}
        theme={settings.theme}
        onCurrencyChange={handleCurrencyChange}
        onCalendarToggle={handleCalendarToggle}
        onThemeToggle={handleThemeToggle}
        onOpenAddModal={(mode = 'manual') => {
          setEditingTx(null);
          setAddModalMode(mode);
          setIsAddModalOpen(true);
        }}
      />

      {/* Desktop / Tablet Navigation Bar */}
      <nav
        aria-label="Primary Navigation"
        className="hidden sm:block border-b border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
      >
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-2 py-2">
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  active
                    ? 'bg-crimson-600 text-white shadow-sm shadow-crimson-600/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                <span
                  className={`text-[10px] font-normal ${
                    active ? 'text-rose-100' : 'text-slate-400'
                  }`}
                >
                  ({item.nepali})
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      active
                        ? 'bg-white text-crimson-600'
                        : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-5">
        {activeView === 'dashboard' && (
          <DashboardView
            settings={settings}
            cycleWindow={cycleWindow}
            cycleTransactions={cycleTransactions}
            allTransactions={transactions}
            onCycleOffsetChange={setCycleOffset}
            onSalaryCycleDayChange={handleSalaryCycleDayChange}
            onBudgetLimitChange={handleBudgetLimitChange}
            onOpenAddModal={(mode = 'manual') => {
              setEditingTx(null);
              setAddModalMode(mode);
              setIsAddModalOpen(true);
            }}
            onEditTransaction={(tx) => {
              setEditingTx(tx);
              setAddModalMode('manual');
              setIsAddModalOpen(true);
            }}
            onDeleteTransaction={handleDeleteTransaction}
            onExportBackup={handleExportBackup}
            onRestoreBackup={handleRestoreBackup}
            onResetDemoData={handleResetDemoData}
            onNavigateToCredit={() => setActiveView('credit')}
          />
        )}

        {activeView === 'planner' && (
          <KharchaPlannerView
            settings={settings}
            kharchaPlan={kharchaPlan}
            cycleWindow={cycleWindow}
            cycleTransactions={cycleTransactions}
            onUpdatePlan={(updated) =>
              setAppState((prev) => ({ ...prev, kharchaPlan: updated }))
            }
            onSyncBudgetFromPlan={(totalPlanned) =>
              handleBudgetLimitChange(totalPlanned)
            }
          />
        )}

        {activeView === 'credit' && (
          <CreditLedgerView
            settings={settings}
            creditLedger={creditLedger}
            onAddCreditItem={handleAddCreditItem}
            onRecordPayment={handleRecordCreditPayment}
            onDeleteCreditItem={handleDeleteCreditItem}
            onNavigateToDashboard={() => setActiveView('dashboard')}
          />
        )}

        {activeView === 'tracker' && (
          <MonthlyTrackerView
            settings={settings}
            cycleWindow={cycleWindow}
            cycleTransactions={cycleTransactions}
            allTransactions={transactions}
            onCycleOffsetChange={setCycleOffset}
          />
        )}
      </main>

      {/* Mobile Floating Smart Add Button */}
      <div className="sm:hidden fixed right-4 bottom-20 z-30 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setEditingTx(null);
            setAddModalMode('smart');
            setIsAddModalOpen(true);
          }}
          className="w-11 h-11 rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/30 flex items-center justify-center"
          aria-label="Open Smart Add"
          title="Smart Add"
        >
          <Sparkles className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditingTx(null);
            setAddModalMode('manual');
            setIsAddModalOpen(true);
          }}
          className="w-12 h-12 rounded-full bg-crimson-600 text-white shadow-lg shadow-crimson-600/40 flex items-center justify-center"
          aria-label="Add Entry"
          title="Add Entry"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5"
      >
        <div className="grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 relative transition ${
                  active
                    ? 'text-crimson-600 dark:text-rose-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {item.icon}
                <span className="text-[10px] leading-tight truncate max-w-full">
                  {item.label}
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="absolute top-1 right-3 px-1.5 rounded-full text-[9px] font-bold bg-amber-500 text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Add Entry & Smart Add Modal */}
      <AddEntryModal
        isOpen={isAddModalOpen}
        initialMode={addModalMode}
        editingTransaction={editingTx}
        settings={settings}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTx(null);
        }}
        onSave={handleSaveTransaction}
      />
    </div>
  );
};

export default App;
