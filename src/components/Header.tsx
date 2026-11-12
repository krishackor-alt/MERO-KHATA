import React from 'react';
import {
  BookOpen,
  Calendar,
  Moon,
  Plus,
  Sparkles,
  Sun,
} from 'lucide-react';
import { CalendarMode, CurrencyCode, ThemeMode } from '../types';
import { CURRENCIES } from '../utils/currency';
import { formatCalendarDate, toISODate } from '../utils/calendar';

interface HeaderProps {
  currency: CurrencyCode;
  calendar: CalendarMode;
  theme: ThemeMode;
  onCurrencyChange: (newCurrency: CurrencyCode) => void;
  onCalendarToggle: () => void;
  onThemeToggle: () => void;
  onOpenAddModal: (defaultTab?: 'manual' | 'smart') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currency,
  calendar,
  theme,
  onCurrencyChange,
  onCalendarToggle,
  onThemeToggle,
  onOpenAddModal,
}) => {
  const todayFormatted = formatCalendarDate(toISODate(), calendar, {
    includeYear: true,
    showDevanagari: calendar === 'BS',
  });

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-crimson-500 to-rose-700 flex items-center justify-center text-white shadow-md shadow-crimson-500/20 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  Mero Khata
                </h1>
                <span className="text-xs sm:text-sm font-semibold px-2 py-0.5 rounded-full bg-crimson-50 text-crimson-600 dark:bg-crimson-500/15 dark:text-rose-300 border border-crimson-200/60 dark:border-crimson-500/30">
                  मेरो खाता
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-crimson-500 shrink-0" />
                <span className="truncate">{todayFormatted}</span>
              </p>
            </div>
          </div>

          {/* Controls: Currency Switcher, AD/BS Toggle, Theme Toggle, Quick Add */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Multi-Currency Switcher: NPR, KRW, GBP */}
            <div
              className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/70 dark:border-slate-700/70"
              role="group"
              aria-label="Global Currency Switcher"
            >
              {(['NPR', 'KRW', 'GBP'] as CurrencyCode[]).map((code) => {
                const active = currency === code;
                const meta = CURRENCIES[code];
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onCurrencyChange(code)}
                    className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-crimson-600 dark:text-rose-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title={`Switch global currency to ${meta.name} (${meta.symbol})`}
                  >
                    <span>{meta.symbol}</span>
                    <span>{code}</span>
                  </button>
                );
              })}
            </div>

            {/* AD / BS Calendar Toggle */}
            <button
              type="button"
              onClick={onCalendarToggle}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-crimson-400 dark:hover:border-crimson-500 transition flex items-center gap-1"
              title="Toggle between Bikram Sambat (BS) and Gregorian (AD) calendar"
            >
              <Calendar className="w-3.5 h-3.5 text-crimson-500" />
              <span>{calendar === 'BS' ? 'BS (वि.सं.)' : 'AD (ई.सं.)'}</span>
            </button>

            {/* Dark / Light Theme Toggle */}
            <button
              type="button"
              onClick={onThemeToggle}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-crimson-500 dark:hover:text-rose-400 transition"
              aria-label="Toggle dark or light theme"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* Desktop/Tablet Add & Smart Add Buttons */}
            <button
              type="button"
              onClick={() => onOpenAddModal('smart')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Add</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenAddModal('manual')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-crimson-600 hover:bg-crimson-700 text-white shadow-sm shadow-crimson-600/25 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Entry</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
