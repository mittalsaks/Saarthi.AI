const Entry = require('../models/Entry');
const { scopeToTenant } = require('../middleware/tenantScope');
const { round2, percentChange } = require('./statsService');

/**
 * ALL math in this file is plain JS on numbers already in Mongo, same
 * golden rule as statsService.js. The AI (geminiService) is only ever
 * handed the already-computed output of getAnalyticsOverview() - it
 * never sees raw entries and never sums/divides anything itself.
 *
 * This file backs the FAST /api/analytics/overview endpoint, which
 * must respond without waiting on any AI call - the AI summary and
 * explain-number endpoints are separate and layered on top in
 * analyticsController.js.
 */

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };
const DEFAULT_RANGE = '30d';

function isValidRange(range) {
  return Object.prototype.hasOwnProperty.call(RANGE_DAYS, range);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** 'YYYY-MM-DD' in server-local time (deliberately not toISOString, which is UTC). */
function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns { start, end, days, prevStart, prevEnd } as half-open
 * [start, end) ranges for a named range, where "prev" is the
 * immediately preceding window of equal length (used for %-change).
 */
function getRangeWindow(range, now = new Date()) {
  const safeRange = isValidRange(range) ? range : DEFAULT_RANGE;
  const days = RANGE_DAYS[safeRange];
  const todayStart = startOfDay(now);

  const start = addDays(todayStart, -(days - 1));
  const end = addDays(todayStart, 1);
  const prevStart = addDays(start, -days);
  const prevEnd = start;

  return { range: safeRange, days, start, end, prevStart, prevEnd };
}

/**
 * Builds a complete daily series between [start, end) (inclusive of
 * every day, even ones with zero entries) so charts never have gaps.
 */
function buildDailySeries(entries, start, end) {
  const buckets = new Map();
  for (let d = new Date(start); d < end; d = addDays(d, 1)) {
    buckets.set(dateKey(d), { date: dateKey(d), sales: 0, expenses: 0 });
  }

  for (const e of entries) {
    const key = dateKey(new Date(e.date));
    const bucket = buckets.get(key);
    if (!bucket) continue; // outside range (shouldn't happen, filter is DB-side)
    const amt = Number(e.amount) || 0;
    if (e.type === 'sale') bucket.sales = round2(bucket.sales + amt);
    else if (e.type === 'expense') bucket.expenses = round2(bucket.expenses + amt);
  }

  return Array.from(buckets.values());
}

/** Sums+counts amounts by category for one entry type, top N by amount desc. */
function topCategories(entries, type, topN = 5) {
  const byCategory = new Map();

  for (const e of entries) {
    if (e.type !== type) continue;
    const cat = e.category || 'general';
    const amt = Number(e.amount) || 0;
    const existing = byCategory.get(cat) || { category: cat, amount: 0, count: 0 };
    existing.amount = round2(existing.amount + amt);
    existing.count += 1;
    byCategory.set(cat, existing);
  }

  return Array.from(byCategory.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topN);
}

/**
 * Pure function: totals + derived metrics for one bucket of entries.
 * "Customers served" is defined as one per sale entry (each logged
 * sale = one transaction/customer) - documented here since there's no
 * separate customer field on Entry.
 */
function computeAnalyticsTotals(entries) {
  let sales = 0;
  let expenses = 0;
  let saleCount = 0;

  for (const e of entries) {
    const amt = Number(e.amount) || 0;
    if (e.type === 'sale') {
      sales += amt;
      saleCount += 1;
    } else if (e.type === 'expense') {
      expenses += amt;
    }
  }

  sales = round2(sales);
  expenses = round2(expenses);
  const netProfit = round2(sales - expenses);
  const profitMarginPct = sales > 0 ? round2((netProfit / sales) * 100) : null;
  const avgSaleValue = saleCount > 0 ? round2(sales / saleCount) : 0;

  return {
    sales,
    expenses,
    netProfit,
    profitMarginPct,
    customersServed: saleCount,
    avgSaleValue,
  };
}

/**
 * Full analytics overview for a tenant + range. This is the only
 * function here that touches the DB; everything above it is pure and
 * independently unit-testable (Part 10) without Mongo or Gemini.
 */
async function getAnalyticsOverview(tenantId, range = DEFAULT_RANGE) {
  const { range: safeRange, start, end, prevStart, prevEnd } = getRangeWindow(range);

  const Entries = scopeToTenant(Entry, tenantId);

  const [currentRows, previousRows] = await Promise.all([
    Entries.find({ date: { $gte: start, $lt: end } })
      .select('type amount category date')
      .lean(),
    Entries.find({ date: { $gte: prevStart, $lt: prevEnd } })
      .select('type amount')
      .lean(),
  ]);

  const current = computeAnalyticsTotals(currentRows);
  const previous = computeAnalyticsTotals(previousRows);

  const change = {
    salesPct: percentChange(current.sales, previous.sales),
    expensesPct: percentChange(current.expenses, previous.expenses),
    netProfitPct: percentChange(current.netProfit, previous.netProfit),
    customersServedPct: percentChange(current.customersServed, previous.customersServed),
    avgSaleValuePct: percentChange(current.avgSaleValue, previous.avgSaleValue),
    // Profit margin is already a %, so its "change" is expressed in
    // percentage points (current - previous), never percentChange of
    // a percentage - that would be a different, more confusing number.
    profitMarginPtsChange:
      current.profitMarginPct === null || previous.profitMarginPct === null
        ? null
        : round2(current.profitMarginPct - previous.profitMarginPct),
  };

  return {
    range: safeRange,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    totals: current,
    previous,
    change,
    series: buildDailySeries(currentRows, start, end),
    topSaleCategories: topCategories(currentRows, 'sale'),
    topExpenseCategories: topCategories(currentRows, 'expense'),
  };
}

module.exports = {
  RANGE_DAYS,
  DEFAULT_RANGE,
  isValidRange,
  getRangeWindow,
  buildDailySeries,
  topCategories,
  computeAnalyticsTotals,
  getAnalyticsOverview,
};
