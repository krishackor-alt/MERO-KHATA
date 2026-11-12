/**
 * Optional Express + Gemini Backend for Mero Khata (मेरो खाता)
 * Endpoint: POST /api/gemini/parse
 *
 * Works alongside the Vite dev server or in production.
 * When deployed to static hosting (like GitHub Pages) or if GEMINI_API_KEY is not set,
 * the frontend automatically falls back to its built-in client-side Smart Add parser
 * without double-converting currencies.
 */
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Basic CORS headers for local development
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mero-khata-gemini-backend',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.post('/api/gemini/parse', async (req, res) => {
  const { text, activeCurrency = 'NPR', todayISO } = req.body || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing "text" field in request body.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY not configured on server; use client-side fallback parser.',
      fallback: true,
    });
  }

  try {
    const referenceDate = todayISO || new Date().toISOString().split('T')[0];
    const systemPrompt = `You are a financial transaction parser for "Mero Khata", a personal finance & udharo ledger app.
Extract a structured JSON object from the user's natural language input.
Reference today date: ${referenceDate}.
User's currently active currency: ${activeCurrency} (supported: NPR, KRW, GBP).

IMPORTANT CURRENCY RULE (NO DOUBLE CONVERSION):
- Return "rawAmount" as the exact numeric amount mentioned in the text (do NOT convert it yourself).
- Return "detectedCurrency" as "NPR", "KRW", or "GBP" ONLY if the user explicitly specified a currency symbol or code (e.g. रु, Rs, NPR, ₩, KRW, won, £, GBP, pounds). If no currency was explicitly mentioned, set "detectedCurrency" to "${activeCurrency}".

Return strictly valid JSON with these fields:
{
  "type": "expense" | "income" | "credit",
  "rawAmount": number,
  "detectedCurrency": "NPR" | "KRW" | "GBP",
  "category": "Food & Dining" | "Groceries" | "Transport" | "Rent & Utilities" | "Shopping" | "Healthcare" | "Entertainment" | "Remittance & Family" | "Salary & Freelance" | "Education" | "Savings & Investment" | "Udharo / Credit" | "Others",
  "description": string,
  "date": "YYYY-MM-DD",
  "creditDirection": "payable" | "receivable",
  "partyName": string,
  "dueDate": "YYYY-MM-DD"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nUser input: "${text}"` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        error: `Gemini API returned ${response.status}`,
        fallback: true,
      });
    }

    const data = await response.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) {
      return res.status(502).json({ error: 'Empty response from Gemini', fallback: true });
    }

    const parsed = JSON.parse(rawJson);
    return res.json({
      source: 'gemini-api',
      parsed,
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to parse with Gemini API',
      fallback: true,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Mero Khata backend listening on http://localhost:${PORT}`);
});
