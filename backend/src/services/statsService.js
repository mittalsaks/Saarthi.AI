const Entry = require('../models/Entry');
const { scopeToTenant } = require('../middleware/tenantScope');

/**
 * ALL math in this file is plain JS on numbers already in Mongo.
 * The AI (geminiService) never sees raw entries and never produces a
 * total, a percentage, or a sum - it only narrates what these
 * functions already computed. Keeping this pure/exported also makes
 * it directly unit-testable in Part 10 without spinning up Gemini or
 * even an HTTP server.
 */

const PERIODS = ['today', 'week', 'month'];

/** Start-of-day for a given Date, in server-local time. */
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

/**
 * Returns { currentStart, currentEnd, previousStart, previousEnd } for
 * a named period, both as half-open [start, end) ranges, where
 * "previous" is the immediately preceding period of equal length.
 */
function getPeriodRanges(period, now = new Date()) {
  const todayStart = startOfDay(now);

  if (period === 'week') {
    const currentStart = addDays(todayStart, -6); // last 7 days inclusive of today
    const currentEnd = addDays(todayStart, 1);
    const previousStart = addDays(currentStart, -7);
    const previousEnd = currentStart;
    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  if (period === 'month') {
    const currentStart = addDays(todayStart, -29); // last 30 days inclusive of today
    const currentEnd = addDays(todayStart, 1);
    const previousStart = addDays(currentStart, -30);
    const previousEnd = currentStart;
    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  // 'today' (default)
  const currentStart = todayStart;
  const currentEnd = addDays(todayStart, 1);
  const previousStart = addDays(todayStart, -1);
  const previousEnd = todayStart;
  return { currentStart, currentEnd, previousStart, previousEnd };
}

/** Sums a list of plain {type, amount} entries into totals. Pure function, no I/O. */
function computeTotals(entries) {
  let sales = 0;
  let expenses = 0;

  for (const e of entries) {
    const amt = Number(e.amount) || 0;
    if (e.type === 'sale') sales += amt;
    else if (e.type === 'expense') expenses += amt;
  }

  sales = round2(sales);
  expenses = round2(expenses);

  return {
    sales,
    expenses,
    netProfit: round2(sales - expenses),
    entryCount: entries.length,
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * % change from previous -> current. Returns null (not a number/Infinity)
 * when there's no previous value to compare against, so callers/AI
 * prompts can say "no data yet" instead of a misleading "+Infinity%".
 */
function percentChange(current, previous) {
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // undefined growth rate, avoid Infinity/NaN leaking anywhere
  }
  return round2(((current - previous) / Math.abs(previous)) * 100);
}

/**
 * Full dashboard stats for a tenant + period. This is the only
 * function in this file that touches the DB; everything above it is
 * pure and independently testable.
 */
async function getDashboardStats(tenantId, period = 'today') {
  const safePeriod = PERIODS.includes(period) ? period : 'today';
  const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodRanges(safePeriod);

  const Entries = scopeToTenant(Entry, tenantId);

  const [currentRows, previousRows] = await Promise.all([
    Entries.find({ date: { $gte: currentStart, $lt: currentEnd } }).select('type amount').lean(),
    Entries.find({ date: { $gte: previousStart, $lt: previousEnd } }).select('type amount').lean(),
  ]);

  const current = computeTotals(currentRows);
  const previous = computeTotals(previousRows);

  const change = {
    salesPct: percentChange(current.sales, previous.sales),
    expensesPct: percentChange(current.expenses, previous.expenses),
    profitPct: percentChange(current.netProfit, previous.netProfit),
  };

  return {
    period: safePeriod,
    range: { start: currentStart.toISOString(), end: currentEnd.toISOString() },
    sales: current.sales,
    expenses: current.expenses,
    netProfit: current.netProfit,
    entryCount: current.entryCount,
    previous: { sales: previous.sales, expenses: previous.expenses, netProfit: previous.netProfit },
    change,
    // 'today' block is always included (regardless of requested period)
    // because the AI greeting always narrates *today's* numbers
    // specifically - computed separately below only when period !== 'today'
    // to avoid a redundant query.
  };
}

/**
 * Convenience helper used by the greeting endpoint, which always wants
 * strictly "today vs yesterday" regardless of what period the caller
 * might otherwise be viewing on the dashboard.
 */
async function getTodayStats(tenantId) {
  const stats = await getDashboardStats(tenantId, 'today');
  return {
    today: { sales: stats.sales, expenses: stats.expenses, netProfit: stats.netProfit },
    change: stats.change,
  };
}

module.exports = {
  PERIODS,
  getPeriodRanges,
  computeTotals,
  percentChange,
  round2,
  getDashboardStats,
  getTodayStats,
};
