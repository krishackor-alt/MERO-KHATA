# Mero Khata (मेरो खाता)

A mobile-first personal finance & Udharo (credit/debt) ledger web app built with **React**, **TypeScript**, **Tailwind CSS**, **Vite**, and **Lucide Icons**, pre-configured for **GitHub Pages** deployment (`base: './'` in `vite.config.ts` and `.github/workflows/deploy.yml`).

## Key Features

1. **Dashboard**:
   - Net Cash Balance (cycle & all-time), custom Salary Cycle (start day 1–31) with midnight-normalized day counts and Previous/Next cycle navigation.
   - Monthly Budget Limit with utilization bar and overspend warning alert.
   - Income, Expenses, and On Credit (`उधारो`) summary tiles.
   - Real-time search & filter tabs (`All`, `Expenses`, `Income`, `Credit / उधारो`).
   - Full JSON Backup & Restore + Dark/Light theme persistence.
2. **Multi-Currency & Bikram Sambat (BS)**:
   - Global currency switcher for **NPR (रु)**, **KRW (₩)**, and **GBP (£)** that converts all ledger balances, transactions, budgets, planner estimates, and credit entries cleanly.
   - **BS (विक्रम संवत्) / AD (Gregorian)** calendar toggle across headers, salary cycle ranges, transactions, and due dates.
3. **Add Entry & Smart Add**:
   - Modal with Manual Entry and Natural-Language **Smart Add** (`POST ./api/gemini/parse` optional Express + Gemini backend with automatic client-side fallback for static hosting like GitHub Pages, guaranteed never to double-convert currencies).
4. **Kharcha Planner**:
   - Monthly expected income & category budget estimates synced with global currency changes.
   - **End-of-Month Variance Report** comparing planned vs. actual spending per category.
5. **Credit & Debt Ledger (उधारो खाता)**:
   - Accounts Payable (`To Pay / तिर्नुपर्ने`) and Accounts Receivable (`To Receive / उठाउनुपर्ने`) with partial payments, payment history, due date tracking, and two-way sync with Dashboard credit transactions.
6. **Monthly Tracker**:
   - Category breakdown, weekly spending bars across the active salary cycle, and **formula-injection-safe CSV export** (with UTF-8 BOM for Devanagari).

## Getting Started

```bash
npm install
npm run dev
```

### Optional Express + Gemini Backend

```bash
GEMINI_API_KEY=your_key_here npm run server
```

### Production Build (GitHub Pages Ready)

```bash
npm run build
```
