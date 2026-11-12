import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  HandCoins,
  History,
  Link2,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import {
  AppSettings,
  CreditDirection,
  CreditItem,
} from '../types';
import {
  addDaysMidnight,
  diffDaysMidnight,
  formatCalendarDate,
  toISODate,
} from '../utils/calendar';
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,
  formatCurrency,
  roundForCurrency,
} from '../utils/currency';

export interface NewCreditLedgerPayload {
  direction: CreditDirection;
  partyName: string;
  description: string;
  totalAmount: number;
  category: string;
  createdAt: string;
  dueDate: string;
}

interface CreditLedgerViewProps {
  settings: AppSettings;
  creditLedger: CreditItem[];
  onAddCreditItem: (payload: NewCreditLedgerPayload) => void;
  onRecordPayment: (
    creditId: string,
    paymentAmount: number,
    note: string,
    recordCashTx: boolean
  ) => void;
  onDeleteCreditItem: (creditId: string) => void;
  onNavigateToDashboard: () => void;
}

export const CreditLedgerView: React.FC<CreditLedgerViewProps> = ({
  settings,
  creditLedger,
  onAddCreditItem,
  onRecordPayment,
  onDeleteCreditItem,
  onNavigateToDashboard,
}) => {
  const { currency, calendar } = settings;
  const currencyMeta = CURRENCIES[currency];
  const todayISO = toISODate();

  const [activeTab, setActiveTab] = useState<
    'all' | 'payable' | 'receivable' | 'settled'
  >('all');
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [direction, setDirection] = useState<CreditDirection>('payable');
  const [partyName, setPartyName] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [category, setCategory] = useState('Udharo / Credit');
  const [createdAt, setCreatedAt] = useState(todayISO);
  const [dueDate, setDueDate] = useState(
    toISODate(addDaysMidnight(todayISO, 14))
  );

  // Partial payment drawer state
  const [payingCreditId, setPayingCreditId] = useState<string | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentNoteInput, setPaymentNoteInput] = useState('');
  const [recordCashTx, setRecordCashTx] = useState(true);

  const summary = useMemo(() => {
    let totalPayableRemaining = 0;
    let totalReceivableRemaining = 0;
    let payableCount = 0;
    let receivableCount = 0;
    let settledCount = 0;

    for (const item of creditLedger) {
      const remaining = Math.max(0, item.totalAmount - item.paidAmount);
      if (item.status === 'settled' || remaining <= 0) {
        settledCount++;
      } else if (item.direction === 'payable') {
        totalPayableRemaining += remaining;
        payableCount++;
      } else {
        totalReceivableRemaining += remaining;
        receivableCount++;
      }
    }

    return {
      totalPayableRemaining,
      totalReceivableRemaining,
      netCreditPosition: totalReceivableRemaining - totalPayableRemaining,
      payableCount,
      receivableCount,
      settledCount,
    };
  }, [creditLedger]);

  const filteredItems = useMemo(() => {
    return creditLedger
      .filter((item) => {
        const isSettled =
          item.status === 'settled' || item.paidAmount >= item.totalAmount;
        if (activeTab === 'settled') return isSettled;
        if (activeTab === 'payable')
          return !isSettled && item.direction === 'payable';
        if (activeTab === 'receivable')
          return !isSettled && item.direction === 'receivable';
        return true;
      })
      .sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));
  }, [creditLedger, activeTab]);

  const handleCreateCredit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(totalAmount);
    if (!Number.isFinite(amt) || amt <= 0 || !partyName.trim()) return;

    onAddCreditItem({
      direction,
      partyName: partyName.trim(),
      description:
        description.trim() ||
        `${direction === 'payable' ? 'Udharo from' : 'Lent to'} ${partyName.trim()}`,
      totalAmount: roundForCurrency(amt, currency),
      category,
      createdAt,
      dueDate,
    });

    setPartyName('');
    setDescription('');
    setTotalAmount('');
    setShowAddForm(false);
  };

  const openPartialPayment = (item: CreditItem) => {
    const remaining = roundForCurrency(
      Math.max(0, item.totalAmount - item.paidAmount),
      currency
    );
    setPayingCreditId(item.id);
    setPaymentAmountInput(String(remaining));
    setPaymentNoteInput('');
    setRecordCashTx(true);
  };

  const handleSubmitPayment = (e: React.FormEvent, item: CreditItem) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmountInput);
    const remaining = Math.max(0, item.totalAmount - item.paidAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    const clampedAmount = roundForCurrency(Math.min(amt, remaining), currency);
    onRecordPayment(
      item.id,
      clampedAmount,
      paymentNoteInput.trim() ||
        (clampedAmount >= remaining ? 'Full settlement' : 'Partial payment'),
      recordCashTx
    );
    setPayingCreditId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Two-Way Sync Banner */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <HandCoins className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Credit & Debt Ledger (उधारो र सापटी खाता)
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-crimson-500/10 text-crimson-600 dark:text-rose-300 border border-crimson-500/20">
                <Link2 className="w-3 h-3" />
                <span>2-Way Dashboard Sync Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Track Accounts Payable (To Pay) and Accounts Receivable (To
              Receive) with partial payments, due dates, and automatic two-way
              sync with Dashboard credit transactions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-crimson-600 hover:bg-crimson-700 text-white shadow-sm shadow-crimson-600/20 transition self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>
              {showAddForm ? 'Close Form' : 'New Credit / Debt (नयाँ उधारो)'}
            </span>
          </button>
        </div>

        {/* 3 Summary Tiles: Payable, Receivable, Net Credit Position */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/25 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Accounts Payable • To Pay (तिर्नुपर्ने)
              </span>
              <p className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                {formatCurrency(summary.totalPayableRemaining, currency)}
              </p>
              <span className="text-[11px] text-slate-400">
                {summary.payableCount} active payable{' '}
                {summary.payableCount === 1 ? 'account' : 'accounts'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/25 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-cyan-800 dark:text-cyan-300">
                Accounts Receivable • To Receive (उठाउनुपर्ने)
              </span>
              <p className="text-xl sm:text-2xl font-extrabold text-cyan-600 dark:text-cyan-400 mt-1">
                {formatCurrency(summary.totalReceivableRemaining, currency)}
              </p>
              <span className="text-[11px] text-slate-400">
                {summary.receivableCount} active receivable{' '}
                {summary.receivableCount === 1 ? 'account' : 'accounts'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Net Credit Position (खुद उधारो अवस्था)
              </span>
              <p
                className={`text-xl sm:text-2xl font-extrabold mt-1 ${
                  summary.netCreditPosition >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(summary.netCreditPosition, currency, {
                  showSign: true,
                })}
              </p>
              <span className="text-[11px] text-slate-400">
                Receivable minus Payable
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Inline Add New Credit / Debt Form */}
        {showAddForm && (
          <form
            onSubmit={handleCreateCredit}
            className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Add New Credit / Debt Record (Auto-syncs with Dashboard)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDirection('payable')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                  direction === 'payable'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Accounts Payable — To Pay (तिर्नुपर्ने उधारो)
              </button>
              <button
                type="button"
                onClick={() => setDirection('receivable')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                  direction === 'receivable'
                    ? 'bg-cyan-600 text-white border-cyan-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Accounts Receivable — To Receive (उठाउनुपर्ने सापटी)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Person / Party Name *
                </label>
                <input
                  type="text"
                  required
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="e.g., Ramesh Kirana / Sita"
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Total Amount ({currencyMeta.symbol}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Description / Notes
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Monthly groceries on credit"
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Entry Date ({formatCalendarDate(createdAt, calendar)})
                </label>
                <input
                  type="date"
                  required
                  value={createdAt}
                  onChange={(e) => setCreatedAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Due Date ({formatCalendarDate(dueDate, calendar)})
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-crimson-600 hover:bg-crimson-700 text-white"
              >
                Save & Sync to Dashboard
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {(
          [
            { id: 'all', label: `All Records (${creditLedger.length})` },
            {
              id: 'payable',
              label: `To Pay • Payable (${summary.payableCount})`,
            },
            {
              id: 'receivable',
              label: `To Receive • Receivable (${summary.receivableCount})`,
            },
            { id: 'settled', label: `Settled (${summary.settledCount})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-crimson-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Credit & Debt Cards */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-8 text-center">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            No credit or debt records in this category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const remaining = roundForCurrency(
              Math.max(0, item.totalAmount - item.paidAmount),
              currency
            );
            const paidPct =
              item.totalAmount > 0
                ? Math.min(100, (item.paidAmount / item.totalAmount) * 100)
                : 100;
            const isSettled = item.status === 'settled' || remaining <= 0;
            const daysUntilDue = diffDaysMidnight(todayISO, item.dueDate);
            const isOverdue = !isSettled && daysUntilDue < 0;
            const isDueSoon =
              !isSettled && daysUntilDue >= 0 && daysUntilDue <= 3;

            return (
              <div
                key={item.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Badge Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          item.direction === 'payable'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                        }`}
                      >
                        {item.direction === 'payable'
                          ? 'To Pay (तिर्नुपर्ने)'
                          : 'To Receive (उठाउनुपर्ने)'}
                      </span>

                      {isSettled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Settled
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          <AlertCircle className="w-3 h-3" />
                          Overdue by {Math.abs(daysUntilDue)}d
                        </span>
                      ) : isDueSoon ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          <Clock className="w-3 h-3" />
                          Due in {daysUntilDue}d
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          <Clock className="w-3 h-3" />
                          Due in {daysUntilDue}d
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteCreditItem(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Delete credit record & synced dashboard transaction"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Party & Description */}
                  <div>
                    <div className="flex items-center gap-1.5 text-base font-bold text-slate-900 dark:text-white">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{item.partyName}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.description}
                    </p>
                  </div>

                  {/* Dates & Sync Link */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Due: {formatCalendarDate(item.dueDate, calendar)}
                    </span>
                    {item.linkedTransactionId && (
                      <button
                        type="button"
                        onClick={onNavigateToDashboard}
                        className="inline-flex items-center gap-1 text-crimson-600 dark:text-rose-400 hover:underline font-semibold"
                      >
                        <Link2 className="w-3 h-3" />
                        <span>Synced on Dashboard</span>
                      </button>
                    )}
                  </div>

                  {/* Amount & Partial Payment Progress Bar */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        Paid:{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.paidAmount, currency)}
                        </strong>{' '}
                        of {formatCurrency(item.totalAmount, currency)}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        Remaining: {formatCurrency(remaining, currency)}
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Partial Payment History Log */}
                  {item.payments.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                        <History className="w-3 h-3" />
                        <span>Payment History ({item.payments.length})</span>
                      </span>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {item.payments.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300"
                          >
                            <span>
                              {formatCalendarDate(p.date, calendar, {
                                includeYear: false,
                              })}{' '}
                              {p.note ? `• ${p.note}` : ''}
                            </span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              +{formatCurrency(p.amount, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Partial Payment Action Drawer */}
                {!isSettled && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    {payingCreditId === item.id ? (
                      <form
                        onSubmit={(e) => handleSubmitPayment(e, item)}
                        className="space-y-2.5 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                          <span>Record Partial or Full Payment</span>
                          <span className="text-[11px] text-slate-400">
                            Max: {formatCurrency(remaining, currency)}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            max={remaining}
                            required
                            value={paymentAmountInput}
                            onChange={(e) =>
                              setPaymentAmountInput(e.target.value)
                            }
                            placeholder="Amount"
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          />
                          <input
                            type="text"
                            value={paymentNoteInput}
                            onChange={(e) =>
                              setPaymentNoteInput(e.target.value)
                            }
                            placeholder="Note (e.g., eSewa / Cash)"
                            className="px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={recordCashTx}
                            onChange={(e) => setRecordCashTx(e.target.checked)}
                            className="rounded text-crimson-600 focus:ring-crimson-500"
                          />
                          <span>
                            Also log cash{' '}
                            {item.direction === 'payable'
                              ? 'expense'
                              : 'income'}{' '}
                            entry on Dashboard
                          </span>
                        </label>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPayingCreditId(null)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Confirm Payment
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openPartialPayment(item)}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition"
                      >
                        Record Partial / Full Payment (भुक्तानी टिप्नुहोस्)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
