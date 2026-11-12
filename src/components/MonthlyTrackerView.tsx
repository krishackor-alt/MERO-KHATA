import React, { useMemo } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  PieChart,
  ShieldCheck,
} from 'lucide-react';
import { AppSettings, Transaction } from '../types';
import {
  addDaysMidnight,
  diffDaysMidnight,
  formatCalendarDate,
  formatCycleRangeLabel,
  SalaryCycleWindow,
  toISODate,
} from '../utils/calendar';
import { buildTransactionsCsv, downloadCsvFile } from '../utils/csvExport';
import { formatCurrency, getCategoryMeta } from '../utils/currency';

interface MonthlyTrackerViewProps {
  settings: AppSettings;
  cycleWindow: SalaryCycleWindow;
  cycleTransactions: Transaction[];
  allTransactions: Transaction[];
  onCycleOffsetChange: (newOffset: number) => void;
}

export const MonthlyTrackerView: React.FC<MonthlyTrackerViewProps> = ({
  settings,
  cycleWindow,
  cycleTransactions,
  allTransactions,
  onCycleOffsetChange,
}) => {
  const { currency, calendar } = settings;
  const cycleLabel = formatCycleRangeLabel(cycleWindow, calendar);

  // Category Breakdown (Expenses + Payable Credit purchases in active cycle)
  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, { amount: number; count: number }>();
    let grandTotal = 0;

    for (const tx of cycleTransactions) {
      if (
        tx.type === 'expense' ||
        (tx.type === 'credit' && tx.creditDirection !== 'receivable')
      ) {
        const current = totals.get(tx.category) || { amount: 0, count: 0 };
        current.amount += tx.amount;
        current.count += 1;
        totals.set(tx.category, current);
        grandTotal += tx.amount;
      }
    }

    const items = Array.from(totals.entries())
      .map(([category, data]) => {
        const meta = getCategoryMeta(category);
        const pct = grandTotal > 0 ? (data.amount / grandTotal) * 100 : 0;
        return {
          category,
          nepaliName: meta.nepaliName,
          color: meta.color,
          bgLight: meta.bgLight,
          textColor: meta.textColor,
          amount: data.amount,
          count: data.count,
          pct,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return { items, grandTotal };
  }, [cycleTransactions]);

  // Weekly Spending Bars (Week 1 to Week 5 of the active Salary Cycle)
  const weeklyBars = useMemo(() => {
    const numWeeks = Math.ceil(cycleWindow.totalDays / 7);
    const weeks = Array.from({ length: numWeeks }, (_, i) => {
      const startDayOffset = i * 7;
      const endDayOffset = Math.min(cycleWindow.totalDays - 1, (i + 1) * 7 - 1);
      const wStart = addDaysMidnight(cycleWindow.startDate, startDayOffset);
      const wEnd = addDaysMidnight(cycleWindow.startDate, endDayOffset);
      return {
        weekNumber: i + 1,
        label: `Week ${i + 1}`,
        rangeLabel: `${formatCalendarDate(wStart, calendar, {
          includeYear: false,
        })} – ${formatCalendarDate(wEnd, calendar, { includeYear: false })}`,
        expense: 0,
        income: 0,
        credit: 0,
        count: 0,
      };
    });

    for (const tx of cycleTransactions) {
      const dayIdx = diffDaysMidnight(cycleWindow.startDate, tx.date);
      if (dayIdx >= 0 && dayIdx < cycleWindow.totalDays) {
        const weekIdx = Math.min(weeks.length - 1, Math.floor(dayIdx / 7));
        const bucket = weeks[weekIdx];
        bucket.count += 1;
        if (tx.type === 'expense') {
          bucket.expense += tx.amount;
        } else if (tx.type === 'income') {
          bucket.income += tx.amount;
        } else if (tx.type === 'credit') {
          bucket.credit += tx.amount;
        }
      }
    }

    const maxSpend = Math.max(
      1,
      ...weeks.map((w) => w.expense + w.credit)
    );

    return { weeks, maxSpend };
  }, [cycleTransactions, cycleWindow, calendar]);

  const handleExportCycleCsv = () => {
    const csv = buildTransactionsCsv(cycleTransactions, currency, calendar);
    downloadCsvFile(
      csv,
      `mero-khata-cycle-${cycleWindow.startISO}-to-${cycleWindow.endISO}.csv`
    );
  };

  const handleExportAllCsv = () => {
    const csv = buildTransactionsCsv(allTransactions, currency, calendar);
    downloadCsvFile(csv, `mero-khata-all-transactions-${toISODate()}.csv`);
  };

  const dailyAverageSpend =
    cycleWindow.elapsedDays > 0
      ? categoryBreakdown.grandTotal / cycleWindow.elapsedDays
      : 0;

  return (
    <div className="space-y-6">
      {/* Header & Formula-Injection-Safe CSV Export Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <BarChart3 className="w-5 h-5 text-crimson-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Monthly Tracker & Analytics (मासिक खर्च ट्र्याकर)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Category breakdown, weekly spending bars, and formula-injection-safe
              CSV export for {cycleLabel}.
            </p>
          </div>

          {/* Cycle Switcher & CSV Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => onCycleOffsetChange(cycleWindow.cycleOffset - 1)}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 transition"
                title="Previous Cycle"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                {cycleLabel}
              </span>
              <button
                type="button"
                onClick={() => onCycleOffsetChange(cycleWindow.cycleOffset + 1)}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 transition"
                title="Next Cycle"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCycleCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-crimson-600 hover:bg-crimson-700 text-white shadow-sm shadow-crimson-600/20 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Cycle CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportAllCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All ({allTransactions.length})</span>
            </button>
          </div>
        </div>

        {/* Formula-Injection-Safe Security Notice */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              Formula-Injection-Safe CSV Export enabled (neutralizes leading{' '}
              <code>=</code>, <code>+</code>, <code>-</code>, <code>@</code>,{' '}
              <code>\t</code>, <code>\r</code> cells & includes UTF-8 BOM for
              Devanagari).
            </span>
          </span>
          <span className="text-slate-500 dark:text-slate-400 font-semibold">
            Daily Avg Spend: {formatCurrency(dailyAverageSpend, currency)}/day
          </span>
        </div>
      </div>

      {/* Weekly Spending Bars */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Weekly Spending Bars (साप्ताहिक खर्च ग्राफ)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Week-by-week spending distribution across the {cycleWindow.totalDays}
              -day salary cycle.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" />
              Cash Expense
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
              On Credit (उधारो)
            </span>
          </div>
        </div>

        {/* Vertical + Horizontal Responsive Weekly Bars */}
        <div className="space-y-3 pt-2">
          {weeklyBars.weeks.map((week) => {
            const totalOut = week.expense + week.credit;
            const expensePct = (week.expense / weeklyBars.maxSpend) * 100;
            const creditPct = (week.credit / weeklyBars.maxSpend) * 100;

            return (
              <div
                key={week.weekNumber}
                className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {week.label}
                    </span>{' '}
                    <span className="text-slate-500 dark:text-slate-400">
                      ({week.rangeLabel})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {week.income > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        In: +{formatCurrency(week.income, currency)}
                      </span>
                    )}
                    <span className="font-bold text-slate-900 dark:text-white">
                      Spend: {formatCurrency(totalOut, currency)}
                    </span>
                  </div>
                </div>

                <div className="h-3.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/70 overflow-hidden flex">
                  {week.expense > 0 && (
                    <div
                      className="h-full bg-rose-500 transition-all duration-300"
                      style={{ width: `${Math.max(2, expensePct)}%` }}
                      title={`Cash Expense: ${formatCurrency(
                        week.expense,
                        currency
                      )}`}
                    />
                  )}
                  {week.credit > 0 && (
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${Math.max(2, creditPct)}%` }}
                      title={`Credit / Udharo: ${formatCurrency(
                        week.credit,
                        currency
                      )}`}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    Cash: {formatCurrency(week.expense, currency)} • Credit:{' '}
                    {formatCurrency(week.credit, currency)}
                  </span>
                  <span>
                    {week.count} {week.count === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-crimson-500" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Category Breakdown (विधागत खर्च विश्लेषण)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total Cycle Outflow:{' '}
                <strong>
                  {formatCurrency(categoryBreakdown.grandTotal, currency)}
                </strong>
              </p>
            </div>
          </div>
        </div>

        {/* Multi-segment Stacked Bar */}
        {categoryBreakdown.items.length > 0 && (
          <div className="h-4 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex gap-0.5 p-0.5">
            {categoryBreakdown.items.map((cat) => (
              <div
                key={cat.category}
                className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                style={{
                  width: `${Math.max(2, cat.pct)}%`,
                  backgroundColor: cat.color,
                }}
                title={`${cat.category}: ${formatCurrency(
                  cat.amount,
                  currency
                )} (${cat.pct.toFixed(1)}%)`}
              />
            ))}
          </div>
        )}

        {categoryBreakdown.items.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
            No expenses recorded in this salary cycle yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {categoryBreakdown.items.map((cat) => (
              <div
                key={cat.category}
                className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {cat.category}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {cat.nepaliName} • {cat.count}{' '}
                        {cat.count === 1 ? 'tx' : 'txs'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                      {formatCurrency(cat.amount, currency)}
                    </p>
                    <p className="text-[11px] font-semibold text-crimson-600 dark:text-rose-400">
                      {cat.pct.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(2, cat.pct))}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
