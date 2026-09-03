const Entry = require('../models/Entry');
const { scopeToTenant } = require('../middleware/tenantScope');
const { round2 } = require('./statsService');
const { topCategories } = require('./analyticsService');

/**
 * Custom date-range reports. Same golden rule as statsService/
 * analyticsService: everything here is plain JS on numbers already in
 * Mongo - there is no AI involvement anywhere in this file at all,
 * unlike the dashboard/analytics/stock/alert features which layer AI
 * narration on top of deterministic numbers. Reports are pure numbers
 * end to end, which is exactly what makes them safe to export as CSV.
 */

const MAX_RANGE_DAYS = 366;

function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());
}

/**
 * Parses 'YYYY-MM-DD' strings into a half-open [start, end) Date range
 * that includes the entirety of endDate. Throws RangeError (caller
 * turns this into a 400) on anything invalid.
 */
function parseDateRange(startDateStr, endDateStr) {
  if (!isValidDateStr(startDateStr) || !isValidDateStr(endDateStr)) {
    throw new RangeError('startDate and endDate are required in YYYY-MM-DD format');
  }

  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  end.setDate(end.getDate() + 1); // half-open, so endDate's entries are fully included

  if (start >= end) {
    throw new RangeError('startDate must be before endDate');
  }

  const spanDays = (end - start) / (24 * 60 * 60 * 1000);
  if (spanDays > MAX_RANGE_DAYS) {
    throw new RangeError(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  }

  return { start, end };
}

/**
 * Pure function: builds the full report shape from already-fetched
 * plain entries. Independently unit-testable without Mongo.
 */
function buildReport(entries, startDateStr, endDateStr) {
  let sales = 0;
  let expenses = 0;
  let saleCount = 0;
  let expenseCount = 0;

  for (const e of entries) {
    const amt = Number(e.amount) || 0;
    if (e.type === 'sale') {
      sales += amt;
      saleCount += 1;
    } else if (e.type === 'expense') {
      expenses += amt;
      expenseCount += 1;
    }
  }

  sales = round2(sales);
  expenses = round2(expenses);

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    totals: {
      sales,
      expenses,
      netProfit: round2(sales - expenses),
      saleCount,
      expenseCount,
      entryCount: entries.length,
    },
    // Reuses analyticsService's own category-summing logic rather than
    // re-implementing it, so "top category" math can never drift
    // between the Analytics page and Reports. topN generously high
    // (50) since a report should show every category, not just top 5.
    categoryBreakdown: {
      sales: topCategories(entries, 'sale', 50),
      expenses: topCategories(entries, 'expense', 50),
    },
    entries: [...entries]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((e) => ({
        date: new Date(e.date).toISOString().slice(0, 10),
        type: e.type,
        category: e.category || 'general',
        amount: Number(e.amount) || 0,
        description: e.description || '',
      })),
  };
}

/**
 * Full report for a tenant + custom date range. Only function here
 * that touches the DB; buildReport() above is pure and independently
 * testable.
 */
async function getDateRangeReport(tenantId, startDateStr, endDateStr) {
  const { start, end } = parseDateRange(startDateStr, endDateStr);

  const Entries = scopeToTenant(Entry, tenantId);
  const entries = await Entries.find({ date: { $gte: start, $lt: end } })
    .select('type amount category description date')
    .lean();

  return buildReport(entries, startDateStr, endDateStr);
}

/** Wraps a CSV field in quotes and escapes internal quotes if it contains a comma/quote/newline. */
function escapeCsvField(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Formats a number as a plain 2-decimal amount, with ₹ prefix, for CSV cells. */
function money(n) {
  return `₹${round2(n ?? 0).toFixed(2)}`;
}

/** Turns a report object (see buildReport) into a downloadable, Excel-friendly CSV string. */
function toCSV(report) {
  const lines = [];
  const margin = report.totals.sales > 0 ? round2((report.totals.netProfit / report.totals.sales) * 100) : 0;

  lines.push('Saarthi.ai — Business Report');
  lines.push(`Period,${report.startDate} to ${report.endDate}`);
  lines.push(`Generated on,${new Date().toISOString().slice(0, 19).replace('T', ' ')}`);
  lines.push('');

  lines.push('Summary');
  lines.push('Metric,Value');
  lines.push(`Total Sales,${money(report.totals.sales)}`);
  lines.push(`Total Expenses,${money(report.totals.expenses)}`);
  lines.push(`Net Profit,${money(report.totals.netProfit)}`);
  lines.push(`Profit Margin,${margin}%`);
  lines.push(`Sale Entries,${report.totals.saleCount}`);
  lines.push(`Expense Entries,${report.totals.expenseCount}`);
  lines.push('');

  lines.push('Sales by Category');
  lines.push('Category,Amount,Count,% of Sales');
  for (const c of report.categoryBreakdown.sales) {
    const share = report.totals.sales > 0 ? round2((c.amount / report.totals.sales) * 100) : 0;
    lines.push(`${escapeCsvField(c.category)},${money(c.amount)},${c.count},${share}%`);
  }
  lines.push('');

  lines.push('Expenses by Category');
  lines.push('Category,Amount,Count,% of Expenses');
  for (const c of report.categoryBreakdown.expenses) {
    const share = report.totals.expenses > 0 ? round2((c.amount / report.totals.expenses) * 100) : 0;
    lines.push(`${escapeCsvField(c.category)},${money(c.amount)},${c.count},${share}%`);
  }
  lines.push('');

  // Most recent first - easier to eyeball what just happened than
  // scrolling to the bottom of a long export.
  const sortedEntries = [...report.entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  lines.push('Entries (most recent first)');
  lines.push('Date,Type,Category,Amount,Description');
  for (const e of sortedEntries) {
    lines.push([e.date, e.type, escapeCsvField(e.category), money(e.amount), escapeCsvField(e.description)].join(','));
  }

  return lines.join('\n');
}

module.exports = {
  MAX_RANGE_DAYS,
  isValidDateStr,
  parseDateRange,
  buildReport,
  getDateRangeReport,
  escapeCsvField,
  toCSV,
};