import {
  CreditDirection,
  CurrencyCode,
  SmartParseResult,
  TransactionType,
} from '../types';
import { addDaysMidnight, toISODate } from './calendar';
import { convertCurrency, roundForCurrency } from './currency';

interface RawParsePayload {
  type: TransactionType;
  rawAmount: number;
  detectedCurrency: CurrencyCode;
  category: string;
  description: string;
  date: string;
  creditDirection?: CreditDirection;
  partyName?: string;
  dueDate?: string;
}

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  {
    category: 'Food & Dining',
    keywords: [
      'food',
      'lunch',
      'dinner',
      'breakfast',
      'coffee',
      'tea',
      'cafe',
      'restaurant',
      'momo',
      'chowmein',
      'thakali',
      'khaja',
      'snack',
      'pizza',
      'burger',
      'kimchi',
      'bbq',
    ],
  },
  {
    category: 'Groceries',
    keywords: [
      'grocery',
      'groceries',
      'vegetables',
      'tarkari',
      'milk',
      'rice',
      'fruits',
      'bhatbhateni',
      'mart',
      'supermarket',
      'kirana',
      'meat',
      'eggs',
    ],
  },
  {
    category: 'Rent & Utilities',
    keywords: [
      'rent',
      'kotha',
      'electricity',
      'water',
      'internet',
      'wifi',
      'utility',
      'utilities',
      'gas',
      'recharge',
      'mobile bill',
      'ntc',
      'ncell',
    ],
  },
  {
    category: 'Transport',
    keywords: [
      'bus',
      'taxi',
      'pathao',
      'indrive',
      'uber',
      'train',
      'subway',
      'metro',
      'tube',
      'fuel',
      'petrol',
      'scooter',
      'bike',
      'flight',
      'ticket',
      'transport',
    ],
  },
  {
    category: 'Remittance & Family',
    keywords: [
      'remittance',
      'ime',
      'remit',
      'family',
      'home',
      'parents',
      'mother',
      'father',
      'sent home',
    ],
  },
  {
    category: 'Shopping',
    keywords: [
      'shopping',
      'clothes',
      'shoes',
      'jacket',
      'shirt',
      'daraz',
      'amazon',
      'coupang',
      'electronics',
      'gadget',
      'gift',
    ],
  },
  {
    category: 'Healthcare',
    keywords: [
      'hospital',
      'doctor',
      'medicine',
      'pharmacy',
      'clinic',
      'dental',
      'health',
      'checkup',
      'medical',
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'movie',
      'cinema',
      'netflix',
      'spotify',
      'game',
      'concert',
      'outing',
      'party',
      'entertainment',
    ],
  },
  {
    category: 'Education',
    keywords: [
      'tuition',
      'course',
      'book',
      'books',
      'college',
      'school',
      'university',
      'exam',
      'fee',
    ],
  },
  {
    category: 'Savings & Investment',
    keywords: [
      'saving',
      'savings',
      'sip',
      'stock',
      'shares',
      'nepse',
      'deposit',
      'fd',
      'investment',
    ],
  },
  {
    category: 'Salary & Freelance',
    keywords: [
      'salary',
      'paycheck',
      'wage',
      'freelance',
      'bonus',
      'client',
      'stipend',
      'dividend',
      'income',
    ],
  },
];

/**
 * Deterministic client-side natural-language parser.
 * Extracts rawAmount and detectedCurrency WITHOUT performing any currency conversion itself,
 * so the caller can perform a single conversion when needed.
 */
export function parseSmartEntryClientFallback(
  input: string,
  activeCurrency: CurrencyCode,
  todayISO: string = toISODate()
): RawParsePayload {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  // 1. Detect explicit currency in input text
  let detectedCurrency: CurrencyCode = activeCurrency;
  if (/(?:£|\bgbp\b|\bpounds?\b|\bquid\b)/i.test(clean)) {
    detectedCurrency = 'GBP';
  } else if (/(?:₩|\bkrw\b|\bwon\b|원)/i.test(clean)) {
    detectedCurrency = 'KRW';
  } else if (/(?:रु|रू|\bnpr\b|\brs\.?\b|\brupees?\b|\bpaisa\b)/i.test(clean)) {
    detectedCurrency = 'NPR';
  }

  // 2. Extract amount (ignoring numbers part of "in 7 days" or "2026-11-12")
  const textWithoutDates = clean
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\bdue\s+in\s+\d+\s+days?\b/gi, ' ')
    .replace(/\bin\s+\d+\s+days?\b/gi, ' ')
    .replace(/\b\d+\s+days?\s+ago\b/gi, ' ');

  let rawAmount = 0;
  const amountRegex =
    /(?:रु|रू|rs\.?|npr|krw|gbp|£|₩)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*(k|lakh|lakhs|m|만)?\b/gi;
  let match: RegExpExecArray | null;

  while ((match = amountRegex.exec(textWithoutDates)) !== null) {
    const integerPart = match[1].replace(/,/g, '');
    const decimalPart = match[2] ? `.${match[2]}` : '';
    const suffix = (match[3] || '').toLowerCase();
    let num = parseFloat(`${integerPart}${decimalPart}`);
    if (!Number.isFinite(num) || num <= 0) continue;

    if (suffix === 'k') num *= 1_000;
    else if (suffix === 'lakh' || suffix === 'lakhs') num *= 100_000;
    else if (suffix === 'm') num *= 1_000_000;
    else if (suffix === '만') num *= 10_000;

    rawAmount = num;
    break;
  }

  // 3. Detect transaction type & credit direction
  let type: TransactionType = 'expense';
  let creditDirection: CreditDirection | undefined;

  const isCreditPayable =
    /\b(udharo|उधारो|borrowed|borrow|owe|owed|on credit|credit from|payable|to pay|baaki|बाँकी)\b/i.test(
      clean
    );
  const isCreditReceivable =
    /\b(lent|lend|gave on credit|receivable|to receive|due from|owes me|सापटी दिएँ)\b/i.test(
      clean
    );
  const isIncome =
    /\b(received|salary|earned|income|got paid|bonus|freelance|refund|cashback|deposit from)\b/i.test(
      clean
    );

  if (isCreditReceivable) {
    type = 'credit';
    creditDirection = 'receivable';
  } else if (isCreditPayable) {
    type = 'credit';
    creditDirection = 'payable';
  } else if (isIncome) {
    type = 'income';
  } else {
    type = 'expense';
  }

  // 4. Extract party name for credit transactions
  let partyName: string | undefined;
  if (type === 'credit') {
    const partyMatch =
      /\b(?:from|to|with|at)\s+([A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)?)/i.exec(clean);
    if (partyMatch && partyMatch[1]) {
      const candidate = partyMatch[1]
        .replace(/\b(on|due|yesterday|today|tomorrow|for|udharo|credit)\b.*$/i, '')
        .trim();
      if (candidate) {
        partyName = candidate.charAt(0).toUpperCase() + candidate.slice(1);
      }
    }
    if (!partyName) {
      partyName = creditDirection === 'receivable' ? 'Friend / Contact' : 'Local Shop / Contact';
    }
  }

  // 5. Detect transaction date & due date
  let date = todayISO;
  if (/\byesterday\b|\bहिजो\b/i.test(clean)) {
    date = toISODate(addDaysMidnight(todayISO, -1));
  } else if (/\bday before yesterday\b|\bअस्ति\b/i.test(clean)) {
    date = toISODate(addDaysMidnight(todayISO, -2));
  } else {
    const agoMatch = /\b(\d+)\s+days?\s+ago\b/i.exec(clean);
    const isoMatch = /\b(\d{4}-\d{2}-\d{2})\b/.exec(clean);
    if (agoMatch) {
      date = toISODate(addDaysMidnight(todayISO, -Number(agoMatch[1])));
    } else if (isoMatch) {
      date = isoMatch[1];
    }
  }

  let dueDate: string | undefined;
  if (type === 'credit') {
    const dueInDays = /\b(?:due\s+in|in)\s+(\d+)\s+days?\b/i.exec(clean);
    const dueInWeeks = /\b(?:due\s+in|in)\s+(\d+)\s+weeks?\b/i.exec(clean);
    if (dueInDays) {
      dueDate = toISODate(addDaysMidnight(date, Number(dueInDays[1])));
    } else if (dueInWeeks) {
      dueDate = toISODate(addDaysMidnight(date, Number(dueInWeeks[1]) * 7));
    } else if (/\bnext week\b/i.test(clean)) {
      dueDate = toISODate(addDaysMidnight(date, 7));
    } else if (/\bnext month\b/i.test(clean)) {
      dueDate = toISODate(addDaysMidnight(date, 30));
    } else {
      dueDate = toISODate(addDaysMidnight(date, 14));
    }
  }

  // 6. Detect category
  let category = type === 'income' ? 'Salary & Freelance' : type === 'credit' ? 'Udharo / Credit' : 'Others';
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      category = entry.category;
      break;
    }
  }

  // 7. Build a clean, readable description
  let description = clean
    .replace(/(?:रु|रू|\brs\.?\b|\bnpr\b|\bkrw\b|\bgbp\b|£|₩|\bwon\b|\bpounds?\b)/gi, '')
    .replace(/\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:k|lakh|lakhs|m)?\b/gi, '')
    .replace(/\b(spent|paid|bought|received|got|on|for|yesterday|today)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!description || description.length < 2) {
    description =
      type === 'credit'
        ? `${creditDirection === 'receivable' ? 'Lent to' : 'Udharo from'} ${partyName}`
        : `${category} entry`;
  } else {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  return {
    type,
    rawAmount,
    detectedCurrency,
    category,
    description,
    date,
    creditDirection,
    partyName,
    dueDate,
  };
}

/**
 * Parses natural-language input via optional `./api/gemini/parse` backend,
 * falling back to the client-side parser on static hosts (GitHub Pages) or offline.
 * Guarantees currency is converted AT MOST ONCE.
 */
export async function parseSmartEntry(
  input: string,
  activeCurrency: CurrencyCode,
  ratesToNPR: Record<CurrencyCode, number>,
  todayISO: string = toISODate()
): Promise<SmartParseResult> {
  let rawPayload: RawParsePayload | null = null;
  let source: 'gemini-api' | 'client-fallback' = 'client-fallback';

  // Try optional Express + Gemini backend with short timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2400);

    const response = await fetch('./api/gemini/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input,
        activeCurrency,
        todayISO,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (response.ok) {
      const data = await response.json();
      if (data?.parsed && typeof data.parsed.rawAmount === 'number') {
        const p = data.parsed;
        const validCurrency: CurrencyCode =
          p.detectedCurrency === 'NPR' ||
          p.detectedCurrency === 'KRW' ||
          p.detectedCurrency === 'GBP'
            ? p.detectedCurrency
            : activeCurrency;

        rawPayload = {
          type:
            p.type === 'income' || p.type === 'credit' || p.type === 'expense'
              ? p.type
              : 'expense',
          rawAmount: Number(p.rawAmount) || 0,
          detectedCurrency: validCurrency,
          category: p.category || 'Others',
          description: p.description || input.trim(),
          date: p.date || todayISO,
          creditDirection:
            p.creditDirection === 'receivable' ? 'receivable' : 'payable',
          partyName: p.partyName,
          dueDate: p.dueDate,
        };
        source = 'gemini-api';
      }
    }
  } catch {
    // Expected on static hosting (GitHub Pages) or when Express backend is not running
  }

  if (!rawPayload) {
    rawPayload = parseSmartEntryClientFallback(input, activeCurrency, todayISO);
    source = 'client-fallback';
  }

  // SINGLE CURRENCY CONVERSION POINT — prevents double conversion!
  const wasConverted = rawPayload.detectedCurrency !== activeCurrency;
  const convertedAmount = wasConverted
    ? convertCurrency(
        rawPayload.rawAmount,
        rawPayload.detectedCurrency,
        activeCurrency,
        ratesToNPR
      )
    : roundForCurrency(rawPayload.rawAmount, activeCurrency);

  return {
    ...rawPayload,
    convertedAmount,
    wasConverted,
    source,
  };
}
