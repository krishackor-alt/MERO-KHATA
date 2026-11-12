import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  FileJson,
  HandCoins,
  Link2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import {
  AppSettings,
  FilterTab,
  MeroKhataBackup,
  Transaction,
} from '../types';
import {
  formatCalendarDate,
  formatCycleRangeLabel,
  SalaryCycleWindow,
} from '../utils/calendar';
import { formatCurrency, getCategoryMeta } from '../utils/currency';

interface DashboardViewProps {
  settings: AppSettings;
  cycleWindow: SalaryCycleWindow;
  cycleTransactions: Transaction[];
  allTransactions: Transaction[];
  onCycleOffsetChange: (newOffset: number) => void;
  onSalaryCycleDayChange: (day: number) => void;
  onBudgetLimitChange: (limit: number) => void;
  onOpenAddModal: (mode?: 'manual' | 'smart') => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string) => void;
  onExportBackup: () => void;
  onRestoreBackup: (backup: MeroKhataBackup) => void;
  onResetDemoData: () => void;
  onNavigateToCredit: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  settings,
  cycleWindow,
  cycleTransactions,
  allTransactions,
  onCycleOffsetChange,
  onSalaryCycleDayChange,
  onBudgetLimitChange,
  onOpenAddModal,
  onEditTransaction,
  onDeleteTransaction,
  onExportBackup,
  onRestoreBackup,
  onResetDemoData,
  onNavigateToCredit,
}) => {
  const { currency, calendar, salaryCycleDay, monthlyBudgetLimit } = settings;

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(monthlyBudgetLimit));
  const [restoreStatus, setRestoreStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cycle summary metrics
  const metrics = useMemo(() => {
    let cycleIncome = 0;
    let cycleExpense = 0;
    let cycleCreditTotal = 0;
    let cycleCreditPayable = 0;
    let cycleCreditReceivable = 0;

    for (const tx of cycleTransactions) {
      if (tx.type === 'income') {
        cycleIncome += tx.amount;
      } else if (tx.type === 'expense') {
        cycleExpense += tx.amount;
      } else if (tx.type === 'credit') {
        cycleCreditTotal += tx.amount;
        if (tx.creditDirection === 'receivable') {
          cycleCreditReceivable += tx.amount;
        } else {
          cycleCreditPayable += tx.amount;
        }
      }
    }

    let allTimeIncome = 0;
    let allTimeExpense = 0;
    for (const tx of allTransactions) {
      if (tx.type === 'income') allTimeIncome += tx.amount;
      else if (tx.type === 'expense') allTimeExpense += tx.amount;
    }

    const netCycleCash = cycleIncome - cycleExpense;
    const netAllTimeCash = allTimeIncome - allTimeExpense;

    // Total outflow tracked against monthly budget (Cash Expenses + Payable Udharo purchases)
    const totalBudgetedSpend = cycleExpense + cycleCreditPayable;
    const budgetPercent =
      monthlyBudgetLimit > 0 ? (totalBudgetedSpend / monthlyBudgetLimit) * 100 : 0;
    const isOverspent =
      monthlyBudgetLimit > 0 && totalBudgetedSpend > monthlyBudgetLimit;
    const isNearLimit =
      monthlyBudgetLimit > 0 &&
      !isOverspent &&
      totalBudgetedSpend >= monthlyBudgetLimit * 0.85;

    const remainingBudget = Math.max(0, monthlyBudgetLimit - totalBudgetedSpend);
    const safeDailySpend =
      cycleWindow.remainingDays > 0
        ? remainingBudget / cycleWindow.remainingDays
        : 0;

    return {
      cycleIncome,
      cycleExpense,
      cycleCreditTotal,
      cycleCreditPayable,
      cycleCreditReceivable,
      netCycleCash,
      netAllTimeCash,
      totalBudgetedSpend,
      budgetPercent,
      isOverspent,
      isNearLimit,
      overspentBy: Math.max(0, totalBudgetedSpend - monthlyBudgetLimit),
      remainingBudget,
      safeDailySpend,
    };
  }, [cycleTransactions, allTransactions, monthlyBudgetLimit, cycleWindow.remainingDays]);

  // Filtered & searched transactions within active cycle
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cycleTransactions
      .filter((tx) => {
        if (filterTab !== 'all' && tx.type !== filterTab) return false;
        if (!q) return true;
        return (
          tx.description.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          (tx.partyName && tx.partyName.toLowerCase().includes(q)) ||
          String(tx.amount).includes(q)
        );
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [cycleTransactions, filterTab, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: cycleTransactions.length,
      expense: cycleTransactions.filter((t) => t.type === 'expense').length,
      income: cycleTransactions.filter((t) => t.type === 'income').length,
      credit: cycleTransactions.filter((t) => t.type === 'credit').length,
    };
  }, [cycleTransactions]);

  const handleSaveBudget = () => {
    const parsed = parseFloat(budgetInput);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onBudgetLimitChange(parsed);
    }
    setEditingBudget(false);
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result;
        if (typeof raw !== 'string') throw new Error('Invalid file content.');
        const parsed = JSON.parse(raw) as MeroKhataBackup;
        if (
          !parsed ||
          !Array.isArray(parsed.transactions) ||
          !Array.isArray(parsed.creditLedger) ||
          !parsed.settings
        ) {
          throw new Error(
            'Invalid Mero Khata backup structure. Missing transactions, creditLedger, or settings.'
          );
        }
        onRestoreBackup(parsed);
        setRestoreStatus({
          type: 'success',
          message: `Restored ${parsed.transactions.length} transactions & ${parsed.creditLedger.length} credit records!`,
        });
      } catch (err) {
        setRestoreStatus({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Failed to parse JSON backup file.',
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const cycleLabel = formatCycleRangeLabel(cycleWindow, calendar);

  return (
    <div className="space-y-5">
      {/* Top Hero Card: Net Cash Balance & Custom Salary Cycle Navigation */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-crimson-950 text-white p-5 sm:p-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-crimson-500/15 blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Net Cash Balance */}
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300 uppercase tracking-wider">
              <Wallet className="w-4 h-4 text-rose-400" />
              <span>Net Cash Balance (Cycle)</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/10 text-slate-200 normal-case">
                All-Time Cash: {formatCurrency(metrics.netAllTimeCash, currency)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              <h2
                className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                  metrics.netCycleCash < 0 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {formatCurrency(metrics.netCycleCash, currency, { showSign: true })}
              </h2>
              <span className="text-xs text-slate-300">
                (Income minus Cash Expenses)
              </span>
            </div>
          </div>

          {/* Salary Cycle Navigator & Custom Cycle Day Selector */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 flex flex-col gap-2 min-w-[260px]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-200">
                <CalendarClock className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Salary Cycle</span>
              </div>

              {/* Cycle Start Day (1-31) Picker */}
              <label className="flex items-center gap-1.5 text-xs text-slate-200">
                <span className="text-slate-300">Start Day:</span>
                <select
                  value={salaryCycleDay}
                  onChange={(e) => onSalaryCycleDayChange(Number(e.target.value))}
                  className="bg-slate-900/90 text-white border border-white/20 rounded-lg px-2 py-0.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-400"
                  aria-label="Salary Cycle Start Day (1 to 31)"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      Day {day}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Prev / Next Cycle Navigation */}
            <div className="flex items-center justify-between gap-1 bg-slate-950/50 rounded-lg px-2 py-1.5">
              <button
                type="button"
                onClick={() => onCycleOffsetChange(cycleWindow.cycleOffset - 1)}
                className="p-1 rounded-md hover:bg-white/10 text-slate-200 transition"
                title="Previous Salary Cycle"
                aria-label="Previous Salary Cycle"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center px-1">
                <div className="text-xs font-bold text-white">{cycleLabel}</div>
                <div className="text-[11px] text-slate-300 flex items-center justify-center gap-1.5 mt-0.5">
                  <Clock className="w-3 h-3 text-amber-300" />
                  {cycleWindow.isCurrentCycle ? (
                    <span>
                      Day {cycleWindow.elapsedDays} of {cycleWindow.totalDays} •{' '}
                      <strong className="text-amber-300">
                        {cycleWindow.remainingDays}{' '}
                        {cycleWindow.remainingDays === 1 ? 'day' : 'days'} left
                      </strong>
                    </span>
                  ) : cycleWindow.isPastCycle ? (
                    <span>Past Cycle ({cycleWindow.totalDays} days)</span>
                  ) : (
                    <span>Upcoming Cycle ({cycleWindow.totalDays} days)</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onCycleOffsetChange(cycleWindow.cycleOffset + 1)}
                className="p-1 rounded-md hover:bg-white/10 text-slate-200 transition"
                title="Next Salary Cycle"
                aria-label="Next Salary Cycle"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {cycleWindow.cycleOffset !== 0 && (
              <button
                type="button"
                onClick={() => onCycleOffsetChange(0)}
                className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline self-center"
              >
                Jump back to Current Cycle
              </button>
            )}
          </div>
        </div>

        {/* Monthly Budget Limit & Progress Bar */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-medium">
                Monthly Budget Limit:
              </span>
              {!editingBudget ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-sm">
                    {formatCurrency(monthlyBudgetLimit, currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetInput(String(monthlyBudgetLimit));
                      setEditingBudget(true);
                    }}
                    className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                    title="Edit Monthly Budget Limit"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    className="w-28 px-2 py-0.5 rounded bg-slate-900 border border-white/30 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-400"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveBudget}
                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                    title="Save Budget"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingBudget(false)}
                    className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-200"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 text-slate-200">
              <span>
                Used:{' '}
                <strong>
                  {formatCurrency(metrics.totalBudgetedSpend, currency)}
                </strong>{' '}
                ({metrics.budgetPercent.toFixed(0)}%)
              </span>
              {cycleWindow.isCurrentCycle && !metrics.isOverspent && (
                <span className="hidden sm:inline text-emerald-300">
                  Safe Daily: {formatCurrency(metrics.safeDailySpend, currency)}/day
                </span>
              )}
            </div>
          </div>

          <div className="mt-2 h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                metrics.isOverspent
                  ? 'bg-gradient-to-r from-rose-500 to-red-600'
                  : metrics.isNearLimit
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                  : 'bg-gradient-to-r from-emerald-400 to-teal-500'
              }`}
              style={{
                width: `${Math.min(100, Math.max(0, metrics.budgetPercent))}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Overspend Warning Alert Banner */}
      {(metrics.isOverspent || metrics.isNearLimit) && (
        <div
          role="alert"
          className={`rounded-2xl p-4 border flex items-start gap-3 shadow-sm ${
            metrics.isOverspent
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800/80 text-red-900 dark:text-red-200'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200'
          }`}
        >
          <AlertTriangle
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              metrics.isOverspent
                ? 'text-red-600 dark:text-red-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          />
          <div className="text-xs sm:text-sm flex-1">
            {metrics.isOverspent ? (
              <>
                <span className="font-bold">
                  Monthly Budget Limit Exceeded (Overspend Warning)!
                </span>{' '}
                Your cycle spending (cash expenses + payable udharo) of{' '}
                <strong>
                  {formatCurrency(metrics.totalBudgetedSpend, currency)}
                </strong>{' '}
                has exceeded your{' '}
                <strong>{formatCurrency(monthlyBudgetLimit, currency)}</strong>{' '}
                limit by{' '}
                <strong className="underline">
                  {formatCurrency(metrics.overspentBy, currency)}
                </strong>
                .
              </>
            ) : (
              <>
                <span className="font-bold">Approaching Monthly Budget Limit:</span>{' '}
                You have used{' '}
                <strong>{metrics.budgetPercent.toFixed(1)}%</strong> of your{' '}
                {formatCurrency(monthlyBudgetLimit, currency)} monthly budget.{' '}
                {formatCurrency(metrics.remainingBudget, currency)} remaining for{' '}
                {cycleWindow.remainingDays} days.
              </>
            )}
          </div>
        </div>
      )}

      {/* 3 Summary Tiles: Income, Expense, On Credit (उधारो) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Income Tile */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Income (आम्दानी)
            </p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {formatCurrency(metrics.cycleIncome, currency)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {counts.income} {counts.income === 1 ? 'entry' : 'entries'} in cycle
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ArrowDownRight className="w-6 h-6" />
          </div>
        </div>

        {/* Expense Tile */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Expenses (नगद खर्च)
            </p>
            <p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {formatCurrency(metrics.cycleExpense, currency)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {counts.expense} {counts.expense === 1 ? 'entry' : 'entries'} in cycle
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        {/* On Credit / Udharo Tile */}
        <div
          onClick={onNavigateToCredit}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateToCredit()}
          className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-amber-300/70 dark:border-amber-700/50 hover:border-amber-500 shadow-sm flex items-center justify-between cursor-pointer transition group"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                On Credit / उधारो
              </p>
              <Link2 className="w-3.5 h-3.5 text-amber-500 group-hover:translate-x-0.5 transition" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {formatCurrency(metrics.cycleCreditTotal, currency)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              To Pay: {formatCurrency(metrics.cycleCreditPayable, currency)} • To
              Receive: {formatCurrency(metrics.cycleCreditReceivable, currency)}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <HandCoins className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Transactions Section: Search & Filter Tabs */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/70 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cycle Transactions (कारोबार विवरण)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing entries for {cycleLabel}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description, category, person..."
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-crimson-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs: All, Expenses, Income, Credit/उधारो */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {(
              [
                { id: 'all', label: 'All', count: counts.all },
                { id: 'expense', label: 'Expenses', count: counts.expense },
                { id: 'income', label: 'Income', count: counts.income },
                { id: 'credit', label: 'Credit / उधारो', count: counts.credit },
              ] as Array<{ id: FilterTab; label: string; count: number }>
            ).map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                    active
                      ? 'bg-crimson-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Transaction List */}
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              No transactions found for this filter in the current cycle.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAddModal('manual')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-crimson-600 text-white hover:bg-crimson-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Entry</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAddModal('smart')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Try Smart Add</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredTransactions.map((tx) => {
              const catMeta = getCategoryMeta(tx.category);
              const dateLabel = formatCalendarDate(tx.date, calendar, {
                includeYear: true,
              });

              return (
                <div
                  key={tx.id}
                  className="p-3.5 sm:px-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${catMeta.bgLight}`}
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: catMeta.color }}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {tx.description}
                        </p>
                        {tx.type === 'credit' && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              tx.creditDirection === 'receivable'
                                ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {tx.creditDirection === 'receivable'
                              ? 'उधारो • To Receive'
                              : 'उधारो • To Pay'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className={`font-medium ${catMeta.textColor}`}>
                          {tx.category}
                        </span>
                        <span>•</span>
                        <span>{dateLabel}</span>
                        {tx.partyName && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              Party: {tx.partyName}
                            </span>
                          </>
                        )}
                        {tx.dueDate && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400">
                              Due:{' '}
                              {formatCalendarDate(tx.dueDate, calendar, {
                                includeYear: false,
                              })}
                            </span>
                          </>
                        )}
                        {tx.linkedCreditId && (
                          <span
                            onClick={onNavigateToCredit}
                            className="inline-flex items-center gap-0.5 text-[11px] text-crimson-600 dark:text-rose-400 hover:underline cursor-pointer font-medium"
                            title="Synced with Credit & Debt Ledger"
                          >
                            <Link2 className="w-3 h-3" />
                            <span>Synced Ledger</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amount & Edit/Delete Controls */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <p
                        className={`text-sm sm:text-base font-bold ${
                          tx.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'credit'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {tx.type === 'income'
                          ? '+'
                          : tx.type === 'expense'
                          ? '-'
                          : ''}
                        {formatCurrency(tx.amount, currency)}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        {tx.type}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Edit transaction"
                        aria-label={`Edit ${tx.description}`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Delete transaction"
                        aria-label={`Delete ${tx.description}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* JSON Backup & Restore Panel */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <FileJson className="w-5 h-5 text-crimson-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Data Portability — JSON Backup & Restore
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                All ledger data is stored locally in your browser. Export a full
                JSON backup anytime or restore from an existing backup file.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExportBackup}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup JSON</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileRestore}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restore JSON</span>
            </button>

            <button
              type="button"
              onClick={onResetDemoData}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Reset to default sample data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo</span>
            </button>
          </div>
        </div>

        {restoreStatus && (
          <div
            className={`mt-3 p-3 rounded-xl text-xs font-medium flex items-center justify-between ${
              restoreStatus.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
            }`}
          >
            <span>{restoreStatus.message}</span>
            <button
              type="button"
              onClick={() => setRestoreStatus(null)}
              className="ml-2 text-current opacity-70 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
