import { CalendarMode, CurrencyCode, Transaction } from '../types';
import { formatCalendarDate } from './calendar';

/**
 * Sanitizes a single CSV cell value to prevent CSV Formula Injection (CSV Injection).
 * Any value starting with =, +, -, @, tab (\t), or carriage return (\r) (even after leading spaces)
 * is prefixed with a single quote (') before double-quote escaping.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  let str = String(value);
  const dangerousStartRegex = /^[\s]*[=+\-@\t\r]/;
  if (dangerousStartRegex.test(str)) {
    str = `'${str}`;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildTransactionsCsv(
  transactions: Transaction[],
  currency: CurrencyCode,
  calendarMode: CalendarMode
): string {
  const headers = [
    'Date (AD)',
    'Date (Formatted)',
    'Type',
    'Category',
    'Description',
    `Amount (${currency})`,
    'Credit Direction',
    'Party / Person',
    'Due Date',
  ];

  const rows = transactions.map((tx) => {
    const formattedDate = formatCalendarDate(tx.date, calendarMode, {
      includeYear: true,
    });
    const creditDirLabel =
      tx.type === 'credit'
        ? tx.creditDirection === 'receivable'
          ? 'To Receive (Receivable)'
          : 'To Pay (Payable)'
        : '';

    return [
      sanitizeCsvCell(tx.date),
      sanitizeCsvCell(formattedDate),
      sanitizeCsvCell(tx.type.toUpperCase()),
      sanitizeCsvCell(tx.category),
      sanitizeCsvCell(tx.description),
      sanitizeCsvCell(tx.amount),
      sanitizeCsvCell(creditDirLabel),
      sanitizeCsvCell(tx.partyName || ''),
      sanitizeCsvCell(tx.dueDate || ''),
    ].join(',');
  });

  // Prepend UTF-8 BOM so Excel renders Devanagari & currency symbols properly
  return `\uFEFF${headers.map(sanitizeCsvCell).join(',')}\r\n${rows.join('\r\n')}`;
}

export function downloadCsvFile(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
