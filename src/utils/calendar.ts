import { CalendarMode } from '../types';

const MS_PER_DAY = 86_400_000;

/**
 * Normalizes a Date or YYYY-MM-DD string to local midnight (00:00:00.000).
 * Uses UTC day delta math when computing differences to avoid DST 23h/25h drift.
 */
export function normalizeMidnight(input?: Date | string): Date {
  if (!input) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]) - 1;
      const d = Number(match[3]);
      return new Date(y, m, d, 0, 0, 0, 0);
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
    }
    const fallback = new Date();
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 0, 0, 0, 0);
  }
  return new Date(input.getFullYear(), input.getMonth(), input.getDate(), 0, 0, 0, 0);
}

export function toISODate(input?: Date | string): string {
  const d = normalizeMidnight(input);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the exact midnight-normalized integer day difference (end - start).
 * Uses UTC midnight timestamps constructed from local Y/M/D so DST transitions never skew day counts.
 */
export function diffDaysMidnight(start: Date | string, end: Date | string): number {
  const s = normalizeMidnight(start);
  const e = normalizeMidnight(end);
  const utcStart = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
  const utcEnd = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());
  return Math.round((utcEnd - utcStart) / MS_PER_DAY);
}

export function addDaysMidnight(date: Date | string, days: number): Date {
  const d = normalizeMidnight(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 0, 0, 0, 0);
}

/**
 * Clamps a salary cycle day (1-31) to the actual number of days in a given (year, monthIndex).
 */
function getClampedDayInMonth(year: number, monthIndex: number, cycleDay: number): Date {
  const safeCycleDay = Math.max(1, Math.min(31, Math.round(cycleDay || 1)));
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(safeCycleDay, daysInMonth);
  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

export interface SalaryCycleWindow {
  startDate: Date;
  endDate: Date;
  startISO: string;
  endISO: string;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  cycleOffset: number;
  isCurrentCycle: boolean;
  isPastCycle: boolean;
  isFutureCycle: boolean;
}

/**
 * Calculates the salary cycle window for a custom start day (1-31) and cycleOffset
 * (0 = current cycle containing today, -1 = previous cycle, +1 = next cycle, etc.)
 * with accurate midnight-normalized day counts.
 */
export function getSalaryCycleWindow(
  salaryCycleDay: number,
  cycleOffset = 0,
  referenceDate?: Date | string
): SalaryCycleWindow {
  const today = normalizeMidnight(referenceDate);
  const clampedDay = Math.max(1, Math.min(31, Math.round(salaryCycleDay || 1)));

  // Determine the base cycle start month for cycleOffset === 0
  const candidateThisMonth = getClampedDayInMonth(
    today.getFullYear(),
    today.getMonth(),
    clampedDay
  );

  let baseStartYear = today.getFullYear();
  let baseStartMonth = today.getMonth();

  if (diffDaysMidnight(candidateThisMonth, today) < 0) {
    // Today is before this month's cycle start day, so current cycle started last month
    baseStartMonth -= 1;
  }

  // Apply cycleOffset (in months)
  const targetMonthDate = new Date(baseStartYear, baseStartMonth + cycleOffset, 1);
  const startDate = getClampedDayInMonth(
    targetMonthDate.getFullYear(),
    targetMonthDate.getMonth(),
    clampedDay
  );

  const nextCycleMonthDate = new Date(
    targetMonthDate.getFullYear(),
    targetMonthDate.getMonth() + 1,
    1
  );
  const nextCycleStartDate = getClampedDayInMonth(
    nextCycleMonthDate.getFullYear(),
    nextCycleMonthDate.getMonth(),
    clampedDay
  );

  // Cycle ends on the day before the next cycle starts (midnight-normalized)
  const endDate = addDaysMidnight(nextCycleStartDate, -1);

  const totalDays = Math.max(1, diffDaysMidnight(startDate, endDate) + 1);
  const isCurrentCycle =
    diffDaysMidnight(startDate, today) >= 0 && diffDaysMidnight(today, endDate) >= 0;
  const isPastCycle = diffDaysMidnight(endDate, today) > 0;
  const isFutureCycle = diffDaysMidnight(today, startDate) > 0;

  let elapsedDays = 0;
  let remainingDays = totalDays;

  if (isCurrentCycle) {
    elapsedDays = diffDaysMidnight(startDate, today) + 1;
    remainingDays = diffDaysMidnight(today, endDate) + 1; // includes today
  } else if (isPastCycle) {
    elapsedDays = totalDays;
    remainingDays = 0;
  } else if (isFutureCycle) {
    elapsedDays = 0;
    remainingDays = totalDays;
  }

  return {
    startDate,
    endDate,
    startISO: toISODate(startDate),
    endISO: toISODate(endDate),
    totalDays,
    elapsedDays,
    remainingDays,
    cycleOffset,
    isCurrentCycle,
    isPastCycle,
    isFutureCycle,
  };
}

export function isDateInCycle(dateISO: string, cycle: SalaryCycleWindow): boolean {
  const d = toISODate(dateISO);
  return d >= cycle.startISO && d <= cycle.endISO;
}

/**
 * Bikram Sambat (BS) Calendar Data (2075 BS to 2090 BS)
 * Anchor: 2075-01-01 BS = 2018-04-14 AD
 */
const BS_MONTH_DAYS: Record<number, number[]> = {
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2085: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2086: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2087: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2088: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2089: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2090: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
};

export const BS_MONTH_NAMES_EN = [
  'Baisakh',
  'Jestha',
  'Ashadh',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
];

export const BS_MONTH_NAMES_NP = [
  'बैशाख',
  'जेठ',
  'असार',
  'श्रावण',
  'भदौ',
  'असोज',
  'कार्तिक',
  'मंसिर',
  'पुष',
  'माघ',
  'फाल्गुन',
  'चैत',
];

const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

export function toDevanagariDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => DEVANAGARI_DIGITS[Number(d)] ?? d);
}

export interface BSDate {
  year: number;
  month: number; // 1 - 12
  day: number; // 1 - 32
  monthNameEn: string;
  monthNameNp: string;
}

const BS_ANCHOR_AD = new Date(2018, 3, 14, 0, 0, 0, 0); // 2018-04-14 AD = 2075-01-01 BS

export function adToBs(adInput?: Date | string): BSDate {
  const ad = normalizeMidnight(adInput);
  let daysDelta = diffDaysMidnight(BS_ANCHOR_AD, ad);

  if (daysDelta >= 0) {
    let bsYear = 2075;
    while (BS_MONTH_DAYS[bsYear]) {
      const months = BS_MONTH_DAYS[bsYear];
      const yearTotal = months.reduce((a, b) => a + b, 0);
      if (daysDelta < yearTotal) {
        for (let m = 0; m < 12; m++) {
          if (daysDelta < months[m]) {
            const day = daysDelta + 1;
            return {
              year: bsYear,
              month: m + 1,
              day,
              monthNameEn: BS_MONTH_NAMES_EN[m],
              monthNameNp: BS_MONTH_NAMES_NP[m],
            };
          }
          daysDelta -= months[m];
        }
      }
      daysDelta -= yearTotal;
      bsYear++;
    }
  }

  // Fallback approximation for dates outside 2075-2090 BS (~56 years 8 months 17 days offset)
  const approxShifted = addDaysMidnight(ad, 20714);
  const mIdx = approxShifted.getMonth();
  return {
    year: approxShifted.getFullYear(),
    month: mIdx + 1,
    day: approxShifted.getDate(),
    monthNameEn: BS_MONTH_NAMES_EN[mIdx],
    monthNameNp: BS_MONTH_NAMES_NP[mIdx],
  };
}

export function formatCalendarDate(
  adInput: Date | string,
  calendarMode: CalendarMode,
  options?: { includeYear?: boolean; showDevanagari?: boolean }
): string {
  const includeYear = options?.includeYear ?? true;
  const d = normalizeMidnight(adInput);

  if (calendarMode === 'BS') {
    const bs = adToBs(d);
    if (options?.showDevanagari) {
      return includeYear
        ? `${bs.day} ${bs.monthNameEn} ${bs.year} (${toDevanagariDigits(bs.day)} ${bs.monthNameNp} ${toDevanagariDigits(bs.year)})`
        : `${bs.day} ${bs.monthNameEn} (${toDevanagariDigits(bs.day)} ${bs.monthNameNp})`;
    }
    return includeYear
      ? `${bs.day} ${bs.monthNameEn} ${bs.year} BS`
      : `${bs.day} ${bs.monthNameEn}`;
  }

  // AD Formatting
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
  return formatter.format(d);
}

export function formatCycleRangeLabel(
  cycle: SalaryCycleWindow,
  calendarMode: CalendarMode
): string {
  if (calendarMode === 'BS') {
    const startBs = adToBs(cycle.startDate);
    const endBs = adToBs(cycle.endDate);
    const sameYear = startBs.year === endBs.year;
    if (sameYear) {
      return `${startBs.day} ${startBs.monthNameEn} – ${endBs.day} ${endBs.monthNameEn} ${endBs.year} BS`;
    }
    return `${startBs.day} ${startBs.monthNameEn} ${startBs.year} – ${endBs.day} ${endBs.monthNameEn} ${endBs.year} BS`;
  }

  const sameYear = cycle.startDate.getFullYear() === cycle.endDate.getFullYear();
  const startStr = formatCalendarDate(cycle.startDate, 'AD', { includeYear: !sameYear });
  const endStr = formatCalendarDate(cycle.endDate, 'AD', { includeYear: true });
  return `${startStr} – ${endStr}`;
}
