import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  HandCoins,
  Link2,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import {
  AppSettings,
  CreditDirection,
  SmartParseResult,
  Transaction,
  TransactionType,
} from '../types';
import { addDaysMidnight, formatCalendarDate, toISODate } from '../utils/calendar';
import {
  CATEGORIES,
  CURRENCIES,
  EXPENSE_CATEGORIES,
  formatCurrency,
  INCOME_CATEGORIES,
  roundForCurrency,
} from '../utils/currency';
import { parseSmartEntry } from '../utils/smartParser';

export interface NewTransactionPayload {
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  creditDirection?: CreditDirection;
  partyName?: string;
  dueDate?: string;
}

interface AddEntryModalProps {
  isOpen: boolean;
  initialMode: 'manual' | 'smart';
  editingTransaction: Transaction | null;
  settings: AppSettings;
  onClose: () => void;
  onSave: (payload: NewTransactionPayload, existingId?: string) => void;
}

const SMART_EXAMPLES = [
  'Spent 1200 NPR on groceries at Bhatbhateni yesterday',
  'Paid ₩18,000 for Korean BBQ dinner with friends',
  'Borrowed 4500 from Ramesh Kirana on udharo due in 7 days',
  'Lent £40 to Sita on credit due in 10 days',
  'Received freelance salary 65000 today',
];

export const AddEntryModal: React.FC<AddEntryModalProps> = ({
  isOpen,
  initialMode,
  editingTransaction,
  settings,
  onClose,
  onSave,
}) => {
  const { currency, calendar, exchangeRatesToNPR } = settings;
  const currencyMeta = CURRENCIES[currency];

  const [mode, setMode] = useState<'manual' | 'smart'>(initialMode);
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food & Dining');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toISODate());
  const [creditDirection, setCreditDirection] =
    useState<CreditDirection>('payable');
  const [partyName, setPartyName] = useState('');
  const [dueDate, setDueDate] = useState(
    toISODate(addDaysMidnight(toISODate(), 14))
  );

  // Smart Add states
  const [smartPrompt, setSmartPrompt] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [smartResult, setSmartResult] = useState<SmartParseResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setSmartResult(null);

    if (editingTransaction) {
      setMode('manual');
      setType(editingTransaction.type);
      setAmount(String(editingTransaction.amount));
      setCategory(editingTransaction.category);
      setDescription(editingTransaction.description);
      setDate(editingTransaction.date);
      setCreditDirection(editingTransaction.creditDirection || 'payable');
      setPartyName(editingTransaction.partyName || '');
      setDueDate(
        editingTransaction.dueDate ||
          toISODate(addDaysMidnight(editingTransaction.date, 14))
      );
    } else {
      setMode(initialMode);
      setType('expense');
      setAmount('');
      setCategory('Food & Dining');
      setDescription('');
      setDate(toISODate());
      setCreditDirection('payable');
      setPartyName('');
      setDueDate(toISODate(addDaysMidnight(toISODate(), 14)));
      setSmartPrompt('');
    }
  }, [isOpen, initialMode, editingTransaction]);

  if (!isOpen) return null;

  const availableCategories =
    type === 'income'
      ? INCOME_CATEGORIES
      : type === 'expense'
      ? EXPENSE_CATEGORIES
      : CATEGORIES.map((c) => c.name);

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'income' && !INCOME_CATEGORIES.includes(category)) {
      setCategory('Salary & Freelance');
    } else if (
      newType === 'expense' &&
      !EXPENSE_CATEGORIES.includes(category)
    ) {
      setCategory('Food & Dining');
    } else if (newType === 'credit') {
      setCategory('Udharo / Credit');
    }
  };

  const handleRunSmartParse = async (textToParse?: string) => {
    const query = (textToParse ?? smartPrompt).trim();
    if (!query) {
      setFormError('Please enter a natural-language sentence to parse.');
      return;
    }
    setFormError(null);
    setIsParsing(true);
    try {
      const result = await parseSmartEntry(
        query,
        currency,
        exchangeRatesToNPR,
        toISODate()
      );
      setSmartResult(result);
    } finally {
      setIsParsing(false);
    }
  };

  const applySmartResultToForm = (res: SmartParseResult) => {
    setType(res.type);
    // Uses res.convertedAmount directly (already in active global currency, never double-converted)
    setAmount(res.convertedAmount > 0 ? String(res.convertedAmount) : '');
    setCategory(res.category);
    setDescription(res.description);
    setDate(res.date);
    if (res.type === 'credit') {
      setCreditDirection(res.creditDirection || 'payable');
      setPartyName(res.partyName || '');
      setDueDate(res.dueDate || toISODate(addDaysMidnight(res.date, 14)));
    }
    setMode('manual');
  };

  const handleDirectSmartSave = (res: SmartParseResult) => {
    if (!res.convertedAmount || res.convertedAmount <= 0) {
      applySmartResultToForm(res);
      setFormError('Please specify a valid amount greater than 0.');
      return;
    }
    onSave({
      type: res.type,
      amount: roundForCurrency(res.convertedAmount, currency),
      category: res.category,
      description: res.description,
      date: res.date,
      creditDirection: res.type === 'credit' ? res.creditDirection || 'payable' : undefined,
      partyName:
        res.type === 'credit'
          ? res.partyName || 'Contact'
          : undefined,
      dueDate:
        res.type === 'credit'
          ? res.dueDate || toISODate(addDaysMidnight(res.date, 14))
          : undefined,
    });
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Please enter a valid positive amount.');
      return;
    }
    if (!description.trim()) {
      setFormError('Please enter a brief description.');
      return;
    }
    if (type === 'credit' && !partyName.trim()) {
      setFormError('Please enter the person or shop name for this Udharo / Credit entry.');
      return;
    }

    onSave(
      {
        type,
        amount: roundForCurrency(numericAmount, currency),
        category,
        description: description.trim(),
        date,
        creditDirection: type === 'credit' ? creditDirection : undefined,
        partyName: type === 'credit' ? partyName.trim() : undefined,
        dueDate: type === 'credit' ? dueDate : undefined,
      },
      editingTransaction?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
          <div>
            <h2
              id="modal-title"
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <span>
                {editingTransaction
                  ? 'Edit Entry (रेकर्ड सच्याउनुहोस्)'
                  : 'Add Khata Entry (नयाँ प्रविष्टि)'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Active Currency: {currencyMeta.symbol} {currency} • Calendar:{' '}
              {calendar}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs (Manual vs Smart Add) */}
        {!editingTransaction && (
          <div className="px-5 pt-3 bg-white dark:bg-slate-900">
            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMode('manual');
                  setFormError(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold transition ${
                  mode === 'manual'
                    ? 'bg-white dark:bg-slate-900 text-crimson-600 dark:text-rose-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Manual Entry (म्यानुअल)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('smart');
                  setFormError(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  mode === 'smart'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Smart Add (AI / NLP)</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          {mode === 'smart' ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Wand2 className="w-4 h-4 text-amber-500" />
                  <span>Natural-Language Smart Add</span>
                </div>
                <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                  Type a phrase in plain English or Nepali terms. Uses{' '}
                  <code className="px-1 py-0.5 rounded bg-amber-500/20">
                    /api/gemini/parse
                  </code>{' '}
                  when available and automatically falls back to the built-in
                  client parser on GitHub Pages — without double-converting
                  currencies.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Describe your transaction:
                </label>
                <textarea
                  rows={3}
                  value={smartPrompt}
                  onChange={(e) => setSmartPrompt(e.target.value)}
                  placeholder="e.g. Spent 1200 NPR on groceries at Bhatbhateni yesterday..."
                  className="w-full rounded-xl p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Quick Example Chips */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Try an example (click to parse):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SMART_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setSmartPrompt(example);
                        handleRunSmartParse(example);
                      }}
                      className="text-left text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/15 text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 transition"
                    >
                      “{example}”
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={isParsing}
                onClick={() => handleRunSmartParse()}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isParsing
                    ? 'Parsing entry...'
                    : 'Parse with Smart Add (पार्स गर्नुहोस्)'}
                </span>
              </button>

              {/* Smart Parse Result Preview */}
              {smartResult && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Parsed Entry Preview</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <Cpu className="w-3 h-3" />
                      {smartResult.source === 'gemini-api'
                        ? 'Gemini API Backend'
                        : 'Built-in Client Parser'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px]">
                        Type & Category
                      </span>
                      <span className="font-bold uppercase text-slate-800 dark:text-white">
                        {smartResult.type}
                      </span>{' '}
                      •{' '}
                      <span className="font-medium text-crimson-600 dark:text-rose-400">
                        {smartResult.category}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px]">
                        Amount ({currency})
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(smartResult.convertedAmount, currency)}
                      </span>
                      {smartResult.wasConverted ? (
                        <span className="block text-[10px] text-amber-600 dark:text-amber-400">
                          Converted once from{' '}
                          {formatCurrency(
                            smartResult.rawAmount,
                            smartResult.detectedCurrency
                          )}
                        </span>
                      ) : (
                        <span className="block text-[10px] text-emerald-600 dark:text-emerald-400">
                          Native {currency} (No double conversion)
                        </span>
                      )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px]">
                        Description
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {smartResult.description}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px]">
                        Date ({calendar})
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatCalendarDate(smartResult.date, calendar)}
                      </span>
                    </div>
                  </div>

                  {smartResult.type === 'credit' && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong>
                          {smartResult.creditDirection === 'receivable'
                            ? 'To Receive (Receivable)'
                            : 'To Pay (Payable)'}
                        </strong>{' '}
                        • Party: <strong>{smartResult.partyName}</strong>
                      </span>
                      {smartResult.dueDate && (
                        <span>
                          Due:{' '}
                          {formatCalendarDate(smartResult.dueDate, calendar)}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleDirectSmartSave(smartResult)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition"
                    >
                      Save Entry Now
                    </button>
                    <button
                      type="button"
                      onClick={() => applySmartResultToForm(smartResult)}
                      className="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 transition"
                    >
                      Edit in Form
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Manual Entry Form */
            <form onSubmit={handleManualSubmit} className="space-y-4">
              {/* Transaction Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Transaction Type (प्रकार)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'expense', label: 'Expense (खर्च)', activeClass: 'bg-rose-600 text-white border-rose-600' },
                      { id: 'income', label: 'Income (आम्दानी)', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
                      { id: 'credit', label: 'Credit (उधारो)', activeClass: 'bg-amber-600 text-white border-amber-600' },
                    ] as Array<{
                      id: TransactionType;
                      label: string;
                      activeClass: string;
                    }>
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleTypeChange(item.id)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                        type === item.id
                          ? item.activeClass
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount & Date Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount in {currency} ({currencyMeta.symbol})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      {currencyMeta.symbol}
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-3 py-2 rounded-xl text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-crimson-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date ({formatCalendarDate(date, calendar)})
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-crimson-500"
                  />
                </div>
              </div>

              {/* Category & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category (विधा)
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-crimson-500"
                  >
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description (विवरण)
                  </label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Bhatbhateni Groceries, Flat Rent..."
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-crimson-500"
                  />
                </div>
              </div>

              {/* Credit / Udharo Specific Fields (Two-way synced with Credit & Debt Ledger) */}
              {type === 'credit' && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <HandCoins className="w-4 h-4" />
                      <span>Udharo / Credit Details (उधारो विवरण)</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      <Link2 className="w-3 h-3" />
                      <span>Two-Way Ledger Sync</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreditDirection('payable')}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition ${
                        creditDirection === 'payable'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      To Pay (तिर्नुपर्ने / Payable)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreditDirection('receivable')}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition ${
                        creditDirection === 'receivable'
                          ? 'bg-cyan-600 text-white border-cyan-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      To Receive (उठाउनुपर्ने / Receivable)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 dark:text-amber-200 mb-1">
                        Person / Shop Name (व्यक्ति वा पसल)
                      </label>
                      <input
                        type="text"
                        required
                        value={partyName}
                        onChange={(e) => setPartyName(e.target.value)}
                        placeholder="e.g., Ramesh Kirana / Suman"
                        className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-amber-400/50 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 dark:text-amber-200 mb-1">
                        Due Date ({formatCalendarDate(dueDate, calendar)})
                      </label>
                      <input
                        type="date"
                        required
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-amber-400/50 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-crimson-600 hover:bg-crimson-700 text-white shadow-md shadow-crimson-600/20 transition"
                >
                  {editingTransaction
                    ? 'Update Entry'
                    : 'Save Entry (सुरक्षित गर्नुहोस्)'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
