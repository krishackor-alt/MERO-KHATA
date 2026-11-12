import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  AppSettings,
  KharchaPlan,
  Transaction,
} from '../types';
import { formatCycleRangeLabel, SalaryCycleWindow } from '../utils/calendar';
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,
  formatCurrency,
  getCategoryMeta,
  roundForCurrency,
} from '../utils/currency';

interface KharchaPlannerViewProps {
  settings: AppSettings;
  kharchaPlan: KharchaPlan;
  cycleWindow: SalaryCycleWindow;
  cycleTransactions: Transaction[];
  onUpdatePlan: (updated: KharchaPlan) => void;
  onSyncBudgetFromPlan: (totalPlannedExpense: number) => void;
}

export const KharchaPlannerView: React.FC<KharchaPlannerViewProps> = ({
  settings,
  kharchaPlan,
  cycleWindow,
  cycleTransactions,
  onUpdatePlan,
  onSyncBudgetFromPlan,
}) => {
  const { currency, calendar } = settings;
  const currencyMeta = CURRENCIES[currency];

  const [newCategory, setNewCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [newEstimate, setNewEstimate] = useState('');

  // Actual spending & income in active cycle
  const actuals = useMemo(() => {
    let actualIncome = 0;
    let actualTotalExpense = 0;
    const categoryActuals: Record<string, number> = {};

    for (const tx of cycleTransactions) {
      if (tx.type === 'income') {
        actualIncome += tx.amount;
      } else if (tx.type === 'expense') {
        actualTotalExpense += tx.amount;
        categoryActuals[tx.category] =
          (categoryActuals[tx.category] || 0) + tx.amount;
      } else if (tx.type === 'credit' && tx.creditDirection !== 'receivable') {
        // Payable udharo purchases also count toward category consumption
        actualTotalExpense += tx.amount;
        categoryActuals[tx.category] =
          (categoryActuals[tx.category] || 0) + tx.amount;
      }
    }

    return { actualIncome, actualTotalExpense, categoryActuals };
  }, [cycleTransactions]);

  const totalPlannedExpense = useMemo(() => {
    return kharchaPlan.categoryEstimates.reduce(
      (sum, item) => sum + item.estimatedAmount,
      0
    );
  }, [kharchaPlan.categoryEstimates]);

  const plannedNetSavings =
    kharchaPlan.expectedMonthlyIncome - totalPlannedExpense;
  const actualNetSavings = actuals.actualIncome - actuals.actualTotalExpense;

  // Combined variance rows (all planned categories + any unplanned categories that had actual spending)
  const varianceRows = useMemo(() => {
    const map = new Map<
      string,
      { category: string; planned: number; actual: number }
    >();

    for (const est of kharchaPlan.categoryEstimates) {
      map.set(est.category, {
        category: est.category,
        planned: est.estimatedAmount,
        actual: actuals.categoryActuals[est.category] || 0,
      });
    }

    for (const [cat, actAmount] of Object.entries(actuals.categoryActuals)) {
      if (!map.has(cat) && actAmount > 0) {
        map.set(cat, {
          category: cat,
          planned: 0,
          actual: actAmount,
        });
      }
    }

    return Array.from(map.values()).map((row) => {
      const variance = row.planned - row.actual; // Positive = Under budget (saved), Negative = Over budget
      const utilizationPct =
        row.planned > 0 ? (row.actual / row.planned) * 100 : row.actual > 0 ? 100 : 0;
      const status: 'under' | 'near' | 'over' | 'unplanned' =
        row.planned === 0 && row.actual > 0
          ? 'unplanned'
          : row.actual > row.planned
          ? 'over'
          : utilizationPct >= 85
          ? 'near'
          : 'under';
      return {
        ...row,
        variance,
        utilizationPct,
        status,
      };
    });
  }, [kharchaPlan.categoryEstimates, actuals.categoryActuals]);

  const handleIncomeChange = (val: string) => {
    const parsed = parseFloat(val);
    onUpdatePlan({
      ...kharchaPlan,
      expectedMonthlyIncome: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
    });
  };

  const handleCategoryEstimateChange = (category: string, val: string) => {
    const parsed = parseFloat(val);
    const safeAmount =
      Number.isFinite(parsed) && parsed >= 0
        ? roundForCurrency(parsed, currency)
        : 0;

    onUpdatePlan({
      ...kharchaPlan,
      categoryEstimates: kharchaPlan.categoryEstimates.map((item) =>
        item.category === category
          ? { ...item, estimatedAmount: safeAmount }
          : item
      ),
    });
  };

  const handleAddCategoryEstimate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(newEstimate);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    const existing = kharchaPlan.categoryEstimates.find(
      (c) => c.category === newCategory
    );
    if (existing) {
      handleCategoryEstimateChange(
        newCategory,
        String(existing.estimatedAmount + parsed)
      );
    } else {
      onUpdatePlan({
        ...kharchaPlan,
        categoryEstimates: [
          ...kharchaPlan.categoryEstimates,
          {
            category: newCategory,
            estimatedAmount: roundForCurrency(parsed, currency),
          },
        ],
      });
    }
    setNewEstimate('');
  };

  const handleRemoveCategory = (category: string) => {
    onUpdatePlan({
      ...kharchaPlan,
      categoryEstimates: kharchaPlan.categoryEstimates.filter(
        (c) => c.category !== category
      ),
    });
  };

  const cycleLabel = formatCycleRangeLabel(cycleWindow, calendar);
  const overallExpenseVariance = totalPlannedExpense - actuals.actualTotalExpense;

  return (
    <div className="space-y-6">
      {/* Top Planner Banner */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-crimson-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Kharcha Planner (मासिक खर्च योजना)
              </h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                Synced with {currencyMeta.symbol} {currency}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Plan your expected monthly income and category estimates. Switching
              currencies in the header automatically converts all estimates.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSyncBudgetFromPlan(totalPlannedExpense)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-crimson-50 dark:bg-crimson-500/15 text-crimson-700 dark:text-rose-300 border border-crimson-200 dark:border-crimson-500/30 hover:bg-crimson-100 transition self-start md:self-auto"
            title="Set Dashboard Monthly Budget Limit equal to Total Planned Kharcha"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>
              Sync Dashboard Budget ({formatCurrency(totalPlannedExpense, currency)})
            </span>
          </button>
        </div>

        {/* 3 Planner Summary Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
              Expected Monthly Income (अनुमानित आम्दानी)
            </label>
            <div className="mt-1.5 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {currencyMeta.symbol}
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={kharchaPlan.expectedMonthlyIncome}
                onChange={(e) => handleIncomeChange(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg text-base font-extrabold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-crimson-500"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
            <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Planned Kharcha (कुल अनुमानित खर्च)
            </span>
            <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-2">
              {formatCurrency(totalPlannedExpense, currency)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Across {kharchaPlan.categoryEstimates.length} planned categories
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
            <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
              Projected Monthly Savings (अनुमानित बचत)
            </span>
            <p
              className={`text-xl font-extrabold mt-2 ${
                plannedNetSavings >= 0
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(plannedNetSavings, currency, { showSign: true })}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {kharchaPlan.expectedMonthlyIncome > 0
                ? `${((plannedNetSavings / kharchaPlan.expectedMonthlyIncome) * 100).toFixed(1)}% planned savings rate`
                : 'Set income to view savings rate'}
            </p>
          </div>
        </div>
      </div>

      {/* Category Estimates Editor */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Category Budget Estimates (विधागत खर्च अनुमान)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Adjust any category estimate below or add a new category allocation.
            </p>
          </div>

          {/* Add Category Estimate Form */}
          <form
            onSubmit={handleAddCategoryEstimate}
            className="flex items-center gap-2 flex-wrap"
          >
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="any"
              value={newEstimate}
              onChange={(e) => setNewEstimate(e.target.value)}
              placeholder={`Amount (${currencyMeta.symbol})`}
              className="w-32 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-crimson-600 hover:bg-crimson-700 text-white transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add / Update</span>
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {kharchaPlan.categoryEstimates.map((item) => {
            const meta = getCategoryMeta(item.category);
            return (
              <div
                key={item.category}
                className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {item.category}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block pl-4">
                    {meta.nepaliName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                      {currencyMeta.symbol}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.estimatedAmount}
                      onChange={(e) =>
                        handleCategoryEstimateChange(item.category, e.target.value)
                      }
                      className="w-28 pl-6 pr-2 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-crimson-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(item.category)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title={`Remove ${item.category}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* End-of-Month Variance Report */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                End-of-Month Variance Report (योजना बनाम वास्तविक प्रतिवेदन)
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                {cycleLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compares your Kharcha Planner estimates against actual cycle
              transactions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {overallExpenseVariance >= 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <TrendingDown className="w-4 h-4" />
                <span>
                  Under Budget by{' '}
                  {formatCurrency(overallExpenseVariance, currency)}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                <TrendingUp className="w-4 h-4" />
                <span>
                  Over Budget by{' '}
                  {formatCurrency(Math.abs(overallExpenseVariance), currency)}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* High-level Variance Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/70 dark:divide-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-xs">
          <div className="p-3.5">
            <span className="text-slate-400 block">Actual vs Planned Income</span>
            <span className="font-bold text-sm text-slate-900 dark:text-white mt-0.5 block">
              {formatCurrency(actuals.actualIncome, currency)} /{' '}
              {formatCurrency(kharchaPlan.expectedMonthlyIncome, currency)}
            </span>
          </div>
          <div className="p-3.5">
            <span className="text-slate-400 block">Actual vs Planned Expense</span>
            <span className="font-bold text-sm text-slate-900 dark:text-white mt-0.5 block">
              {formatCurrency(actuals.actualTotalExpense, currency)} /{' '}
              {formatCurrency(totalPlannedExpense, currency)}
            </span>
          </div>
          <div className="p-3.5">
            <span className="text-slate-400 block">Net Expense Variance</span>
            <span
              className={`font-bold text-sm mt-0.5 block ${
                overallExpenseVariance >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(overallExpenseVariance, currency, {
                showSign: true,
              })}
            </span>
          </div>
          <div className="p-3.5">
            <span className="text-slate-400 block">Actual Net Savings</span>
            <span
              className={`font-bold text-sm mt-0.5 block ${
                actualNetSavings >= 0
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(actualNetSavings, currency, { showSign: true })}
            </span>
          </div>
        </div>

        {/* Category Variance Breakdown Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-400 bg-slate-50/40 dark:bg-slate-900">
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Planned</th>
                <th className="py-3 px-4 text-right">Actual Spent</th>
                <th className="py-3 px-4 text-right">Variance</th>
                <th className="py-3 px-4">Utilization</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {varianceRows.map((row) => {
                const meta = getCategoryMeta(row.category);
                return (
                  <tr
                    key={row.category}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <div>
                          <div>{row.category}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {meta.nepaliName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                      {formatCurrency(row.planned, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                      {formatCurrency(row.actual, currency)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        row.variance >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatCurrency(row.variance, currency, { showSign: true })}
                    </td>
                    <td className="py-3 px-4 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              row.status === 'over' || row.status === 'unplanned'
                                ? 'bg-rose-500'
                                : row.status === 'near'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(0, row.utilizationPct))}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 w-10 text-right">
                          {row.planned > 0
                            ? `${row.utilizationPct.toFixed(0)}%`
                            : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {row.status === 'over' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <AlertCircle className="w-3 h-3" />
                          Over Budget
                        </span>
                      ) : row.status === 'unplanned' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Unplanned
                        </span>
                      ) : row.status === 'near' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Near Limit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Under Budget
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
