/**
 * Thin wrapper around the Gemini REST API.
 *
 * GOLDEN RULE (see master plan): the AI never calculates numbers.
 * - quick-add: Gemini only turns free text into a structured guess
 *   (type/amount/category/description). The caller (entryController)
 *   validates every field before anything touches the database.
 * - greeting: Gemini is only ever given numbers that backend JS has
 *   already computed (statsService) and asked to phrase them in 1-2
 *   sentences. It cannot introduce a number that wasn't handed to it
 *   in the prompt.
 */

const cache = require('../utils/cache');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Low-level call to Gemini's generateContent endpoint.
 * Throws on missing API key, network failure, or an empty/blocked
 * response - callers decide how to degrade (e.g. quick-add tells the
 * user to use the manual form; greeting falls back to a canned line).
 */
async function callGemini(prompt, { temperature = 0.4 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: 300 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';

  if (!text.trim()) {
    throw new Error('Gemini returned an empty response');
  }

  return text.trim();
}

/**
 * Low-level multimodal call to Gemini's generateContent endpoint, for
 * requests that include non-text parts (e.g. inline audio). Mirrors
 * callGemini() above but accepts a pre-built `parts` array instead of
 * a single text prompt.
 */
async function callGeminiMultimodal(parts, { temperature = 0.2 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature, maxOutputTokens: 300 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';

  if (!text.trim()) {
    throw new Error('Gemini returned an empty response');
  }

  return text.trim();
}

/**
 * Strips ```json ... ``` / ``` ... ``` fences Gemini sometimes wraps
 * JSON in, despite being asked not to.
 */
function stripCodeFences(text) {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

/**
 * Parses free text like "aaj 3000 ka saaman becha, grocery" into a
 * structured guess. Returns the RAW parsed object - the caller
 * (entryController) is responsible for validating/sanitizing every
 * field before it ever reaches the database. This function does not
 * touch Mongo and does not decide what's valid.
 */
async function parseEntryFromText(text, languagePref = 'English') {
  const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

  const prompt = `You are a data extraction assistant for a small Indian shop's
bookkeeping app. The owner typed a short
note describing ONE sale or expense. Extract it into a single JSON object
and output ONLY that JSON object - no markdown fences, no explanation, no
extra text before or after it.

Shape (all keys required):
{
  "type": "sale" or "expense",
  "amount": <number, just the numeric value, no currency symbol>,
  "category": <short lowercase category like "grocery", "rent", "electricity", "stock purchase", "transport", "salary", "misc">,
  "description": <short human-readable description, max 15 words, same language style as the input>,
  "date": <"YYYY-MM-DD", use ${today} if no date is mentioned or it says "aaj"/"today">
}

Rules:
- "becha"/"bikri"/"sale"/"sold" style language -> type "sale".
- "kharcha"/"expense"/"diya"/"bill"/"paid" style language -> type "expense", UNLESS it's clearly revenue.
- If amount is ambiguous or missing, put 0 for amount.
- If you truly cannot classify type, use "expense".
- Never invent an amount that isn't implied by the text.

Owner's note: "${String(text).slice(0, 500)}"

Output ONLY the JSON object.`;

  const raw = await callGemini(prompt, { temperature: 0.2 });
  const cleaned = stripCodeFences(raw);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Could not understand that entry - please use the manual form instead');
  }

  return parsed;
}

/**
 * Voice counterpart to parseEntryFromText(). Sends the raw audio clip
 * straight to Gemini's multimodal input (no separate transcription
 * step) and asks it to both transcribe and extract the entry in one
 * shot. Returns the RAW parsed object (now including a `transcript`
 * key) - same golden rule as the text path: this function does not
 * touch Mongo and does not decide what's valid. The caller
 * (entryController) validates every field via validateQuickAdd.js
 * before anything reaches the database.
 */
async function parseEntryFromAudio(base64Audio, mimeType, languagePref = 'English') {
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `You are a data extraction assistant for a small Indian shop's
bookkeeping app. Attached is a short voice note from the shop owner
(prefers responses in ${languagePref}), describing ONE sale or expense.

First transcribe what the owner said, then extract it into a single JSON
object and output ONLY that JSON object - no markdown fences, no
explanation, no extra text before or after it.

Shape (all keys required):
{
  "transcript": <the transcribed speech, in the language/script it was spoken in>,
  "type": "sale" or "expense",
  "amount": <number, just the numeric value, no currency symbol>,
  "category": <short lowercase category like "grocery", "rent", "electricity", "stock purchase", "transport", "salary", "misc">,
  "description": <short human-readable description, max 15 words, same language style as the transcript>,
  "date": <"YYYY-MM-DD", use ${today} if no date is mentioned or it says "aaj"/"today">
}

Rules:
- "becha"/"bikri"/"sale"/"sold" style language -> type "sale".
- "kharcha"/"expense"/"diya"/"bill"/"paid" style language -> type "expense", UNLESS it's clearly revenue.
- If amount is ambiguous, unclear, or the audio is silent/unintelligible, put 0 for amount and leave transcript as best-effort (empty string if nothing usable).
- If you truly cannot classify type, use "expense".
- Never invent an amount that isn't implied by the audio.

Output ONLY the JSON object.`;

  const parts = [
    { text: prompt },
    { inline_data: { mime_type: mimeType, data: base64Audio } },
  ];

  const raw = await callGeminiMultimodal(parts, { temperature: 0.2 });
  const cleaned = stripCodeFences(raw);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Could not understand that voice note - please use the manual form instead');
  }

  return parsed;
}
/**
 * Image counterpart to parseEntryFromText()/parseEntryFromAudio().
 * Sends a photo (receipt/bill/handwritten khata page) straight to
 * Gemini's multimodal input and asks it to read whatever text/numbers
 * are visible and extract ONE sale or expense from it. Returns the RAW
 * parsed object (now including a `readText` key, the OCR-style best
 * guess of what's written) - same golden rule as the other quick-add
 * paths: this function does not touch Mongo and does not decide what's
 * valid. The caller (entryController) validates every field via
 * validateQuickAdd.js before anything reaches the database.
 */
async function parseEntryFromImage(base64Image, mimeType, languagePref = 'English') {
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `You are a data extraction assistant for a small Indian shop's
bookkeeping app. Attached is a photo the shop owner took - it could be a
paper bill/receipt, a handwritten khata page, or a stock label. The owner
prefers responses in ${languagePref}.

First read whatever text/numbers are visible in the image, then extract ONE
sale or expense from it into a single JSON object and output ONLY that JSON
object - no markdown fences, no explanation, no extra text before or after
it. If the image contains multiple line items, use the TOTAL amount, not
one line item.

Shape (all keys required):
{
  "readText": <a short plain-text summary of what you could read on the image, in the language/script it appears in>,
  "type": "sale" or "expense",
  "amount": <number, just the numeric value, no currency symbol - use the TOTAL if multiple items are visible>,
  "category": <short lowercase category like "grocery", "rent", "electricity", "stock purchase", "transport", "salary", "misc">,
  "description": <short human-readable description, max 15 words>,
  "date": <"YYYY-MM-DD", use ${today} if no date is visible on the image>
}

Rules:
- A shop bill/receipt for goods bought BY the shop -> type "expense".
- A sale receipt/slip issued BY the shop to a customer -> type "sale".
- A handwritten khata page is usually an expense note unless it clearly says "sold"/"becha"/"bikri".
- If the amount is ambiguous, unclear, or nothing legible is visible, put 0 for amount and leave readText as best-effort (empty string if nothing usable).
- If you truly cannot classify type, use "expense".
- Never invent an amount that isn't actually visible in the image.

Output ONLY the JSON object.`;

  const parts = [
    { text: prompt },
    { inline_data: { mime_type: mimeType, data: base64Image } },
  ];

  const raw = await callGeminiMultimodal(parts, { temperature: 0.2 });
  const cleaned = stripCodeFences(raw);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Could not read that image - please try a clearer photo or use the manual form');
  }

  return parsed;
}
/**
 * Generates a 1-2 sentence greeting narrating numbers the backend
 * already computed. `stats` must be plain already-correct numbers -
 * this function only asks Gemini to phrase them, never to compute
 * them. Cached per-tenant per-day for ~30 min so repeated dashboard
 * loads don't re-call the API.
 */
async function generateGreeting({ tenantId, ownerName, shopName, languagePref, stats }) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const cacheKey = `greeting:${tenantId}:${dateKey}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const prompt = `You write a short, warm 1-2 sentence daily greeting for the
owner of a small Indian shop, inside a bookkeeping app called Saarthi.ai.
Respond in ${languagePref} (natural, the
way a friendly assistant would text a shop owner, not formal).

Use ONLY these exact already-calculated numbers - do not do any math, do not
change them, do not add numbers that aren't given:
- Owner name: ${ownerName}
- Shop: ${shopName}
- Today's sales so far: Rs ${stats.today.sales}
- Today's expenses so far: Rs ${stats.today.expenses}
- Today's net profit so far: Rs ${stats.today.netProfit}
- Change in today's sales vs yesterday: ${stats.change.salesPct === null ? 'no data yesterday' : `${stats.change.salesPct}%`}

Keep it to 1-2 short sentences. Greet the owner by name once. If profit is
positive, be encouraging; if numbers are low or zero (e.g. no entries yet
today), be gently motivating, not negative. Output ONLY the greeting text,
no quotes, no markdown.`;

  const raw = await callGemini(prompt, { temperature: 0.6 });
  const greeting = stripCodeFences(raw);

  cache.set(cacheKey, greeting, 30 * 60 * 1000);
  return greeting;
}

/** Human-friendly labels for metric keys, used in AI prompts and nowhere else. */
const METRIC_LABELS = {
  sales: 'total sales',
  expenses: 'total expenses',
  netProfit: 'net profit',
  profitMarginPct: 'profit margin',
  customersServed: 'customers served',
  avgSaleValue: 'average sale value',
};

function describeChange(pct) {
  if (pct === null || pct === undefined) return 'no comparable data for the previous period';
  if (pct > 0) return `up ${pct}% vs the previous period`;
  if (pct < 0) return `down ${Math.abs(pct)}% vs the previous period`;
  return 'unchanged vs the previous period';
}

/**
 * Generates a 3-5 sentence "AI Business Summary" narrating numbers the
 * backend already computed (analyticsService.getAnalyticsOverview).
 * Same golden rule as generateGreeting: Gemini phrases, it never
 * computes. Cached per-tenant per-range per-day for ~30 min; `refresh`
 * skips reading the cache but still refills it, so the next normal
 * load stays fast.
 */
async function generateBusinessSummary({ tenantId, range, ownerName, shopName, languagePref, overview, refresh = false }) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const cacheKey = `summary:${tenantId}:${range}:${dateKey}`;

  if (!refresh) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  const t = overview.totals;
  const saleCats = overview.topSaleCategories.map((c) => `${c.category}: Rs ${c.amount}`).join(', ') || 'none';
  const expCats = overview.topExpenseCategories.map((c) => `${c.category}: Rs ${c.amount}`).join(', ') || 'none';

  const prompt = `You write a short "AI Business Summary" (3-5 sentences) for the
owner of a small Indian shop, inside a bookkeeping app called Saarthi.ai.
Respond in ${languagePref} (natural, the
way a helpful assistant would text a shop owner, not formal).

Use ONLY these exact already-calculated numbers for the last ${overview.range}
- do not do any math, do not change them, do not invent numbers that
aren't given below:
- Owner: ${ownerName}, Shop: ${shopName}
- Total sales: Rs ${t.sales} (${describeChange(overview.change.salesPct)})
- Total expenses: Rs ${t.expenses} (${describeChange(overview.change.expensesPct)})
- Net profit: Rs ${t.netProfit} (${describeChange(overview.change.netProfitPct)})
- Profit margin: ${t.profitMarginPct === null ? 'not available (no sales yet)' : `${t.profitMarginPct}%`}
- Customers served: ${t.customersServed} (${describeChange(overview.change.customersServedPct)})
- Average sale value: Rs ${t.avgSaleValue}
- Top sale categories: ${saleCats}
- Top expense categories: ${expCats}

Summarize the overall trend, call out the single most notable change (good
or bad), and end with one short, practical, encouraging suggestion. Do not
list every number back mechanically - write it like a person would. Output
ONLY the summary text, no quotes, no markdown, no headings.`;

  const raw = await callGemini(prompt, { temperature: 0.5 });
  const summary = stripCodeFences(raw);

  cache.set(cacheKey, summary, 30 * 60 * 1000);
  return summary;
}

/**
 * Generates a 1-3 sentence plain-language explanation of ONE metric,
 * given only backend-computed context (current value, previous value,
 * % change, and top categories where relevant). Cached per-tenant per-
 * metric per-range per-day, same TTL pattern as the other AI calls.
 */
async function explainNumber({ tenantId, metric, range, languagePref, context }) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const cacheKey = `explain:${tenantId}:${metric}:${range}:${dateKey}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const label = METRIC_LABELS[metric] || metric;
  const catLines = context.topCategories && context.topCategories.length
    ? context.topCategories.map((c) => `${c.category}: Rs ${c.amount}`).join(', ')
    : null;

  const prompt = `You explain ONE business number to the owner of a small Indian
shop, inside a bookkeeping app called Saarthi.ai. Respond in ${languagePref} (natural and conversational).

Use ONLY these exact already-calculated numbers for the last ${range} -
do not do any math, do not change them, do not invent numbers that aren't
given below:
- Metric: ${label}
- Current value: ${context.current}
- Previous period's value: ${context.previous === null ? 'not available' : context.previous}
- Change: ${describeChange(context.pct)}
${catLines ? `- Top contributing categories this period: ${catLines}` : ''}

In 1-3 short sentences, explain what this number means and why it moved the
way it did (using only the categories given, if any - if no category data
is given, just explain the trend in general terms). Do not suggest reasons
that aren't supported by the numbers above. Output ONLY the explanation
text, no quotes, no markdown.`;

  const raw = await callGemini(prompt, { temperature: 0.4 });
  const explanation = stripCodeFences(raw);

  cache.set(cacheKey, explanation, 30 * 60 * 1000);
  return explanation;
}

/**
 * Generates a short low-stock alert message narrating an ALREADY
 * DECIDED list of low/out items (see stockService.summarize - the
 * threshold logic that produced this list is deterministic JS; Gemini
 * only phrases it). Cached per-tenant per-day for ~30 min like the
 * other AI calls, keyed also off the item count so a genuinely new
 * alert state isn't served a stale cached sentence.
 */
async function generateStockAlert({ tenantId, ownerName, shopName, languagePref, summary }) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const cacheKey = `stockAlert:${tenantId}:${summary.outOfStockCount}:${summary.lowStockCount}:${dateKey}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const outLines = summary.outOfStockItems.map((i) => `${i.name} (0 ${i.unit} left)`).join(', ') || 'none';
  const lowLines = summary.lowStockItems
    .map((i) => {
      const due = i.nextDueDate
        ? ` - estimated to run out around ${new Date(i.nextDueDate).toISOString().slice(0, 10)}`
        : '';
      return `${i.name} (${i.currentQty} ${i.unit} left, threshold ${i.lowStockThreshold}${due})`;
    })
    .join('; ') || 'none';

  const prompt = `You write a short, practical low-stock alert (2-4 sentences) for
the owner of a small Indian shop, inside a bookkeeping app called Saarthi.ai.
Respond in ${languagePref} (natural, the
way a helpful assistant would text a shop owner, not formal).

Use ONLY this already-decided list - do not add items, do not invent
numbers, do not do any math:
- Owner: ${ownerName}, Shop: ${shopName}
- Completely out of stock: ${outLines}
- Running low: ${lowLines}

Gently prompt the owner to restock the most urgent items first (out of
stock before low stock). If both lists are "none", write one short
reassuring sentence that stock levels look fine. Output ONLY the alert
text, no quotes, no markdown, no bullet points.`;

  const raw = await callGemini(prompt, { temperature: 0.5 });
  const alert = stripCodeFences(raw);

  cache.set(cacheKey, alert, 30 * 60 * 1000);
  return alert;
}

/**
 * Drafts a WhatsApp-style udhaar reminder message using the EXACT
 * code-computed balance for one customer (see udhaarService). Gemini
 * only phrases it politely - it never sees or infers a different
 * number than what's passed in. Not cached (each draft can be tweaked
 * by re-clicking "AI Reminder" without waiting on a stale TTL).
 */
async function generateUdhaarReminder({ ownerName, shopName, languagePref, customerName, balance }) {
  const prompt = `You draft a short, polite WhatsApp-style reminder message from a
small Indian shop owner to a customer who owes them money (udhaar/credit).
Respond in ${languagePref} (natural and
respectful, never rude or threatening).

Use ONLY this exact already-calculated amount - do not do any math, do not
change it, do not invent a different number:
- Shop: ${shopName}, sent by: ${ownerName}
- Customer name: ${customerName}
- Amount owed: Rs ${balance}

Keep it to 2-3 short sentences: a friendly greeting, a gentle reminder of
the exact amount owed, and a polite request to settle it when convenient.
Output ONLY the message text, no quotes, no markdown.`;

  const raw = await callGemini(prompt, { temperature: 0.5 });
  return stripCodeFences(raw);
}

const ALERT_TYPE_HINTS = {
  revenue_drop: 'sales have dropped compared to the previous week',
  expense_spike: 'expenses have risen sharply compared to the previous week',
  low_stock: 'one or more stock items are low or completely out',
  category_zero: 'a sales category that used to bring in revenue had zero sales this week',
};

/**
 * Phrases an ALREADY-DECIDED alert (see alertService - the threshold
 * logic that decided something is worth alerting on is deterministic
 * JS; Gemini only turns the decided type/title/context into a short,
 * friendly message). Not cached - alertService already guarantees at
 * most one alert per tenant/type/day (see Alert model's unique index),
 * so there's nothing to re-fetch here.
 */
async function generateAlertMessage({ ownerName, shopName, languagePref, alertType, title, context }) {
  const prompt = `You write a short, practical business alert (2-3 sentences) for
the owner of a small Indian shop, inside a bookkeeping app called Saarthi.ai.
Respond in ${languagePref} (natural, the
way a helpful assistant would text a shop owner, not formal or alarming).

Use ONLY this already-decided situation - do not do any math, do not invent
numbers that aren't given below:
- Owner: ${ownerName}, Shop: ${shopName}
- Alert type: ${ALERT_TYPE_HINTS[alertType] || alertType}
- Already-decided headline: "${title}"
- Supporting data: ${JSON.stringify(context)}

Explain briefly what happened and suggest one short, practical next step.
Stay calm and helpful, not alarming. Output ONLY the alert text, no quotes,
no markdown, no bullet points.`;

  const raw = await callGemini(prompt, { temperature: 0.5 });
  return stripCodeFences(raw);
}

module.exports = {
  callGemini,
  parseEntryFromText,
  parseEntryFromAudio,
  parseEntryFromImage,
  generateGreeting,
  generateBusinessSummary,
  explainNumber,
  generateStockAlert,
  generateUdhaarReminder,
  generateAlertMessage,
  METRIC_LABELS,
};