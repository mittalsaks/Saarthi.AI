const Entry = require('../models/Entry');
const StockItem = require('../models/StockItem');
const Alert = require('../models/Alert');
const { scopeToTenant } = require('../middleware/tenantScope');
const statsService = require('./statsService');
const stockService = require('./stockService');
const geminiService = require('./geminiService');

/**
 * GOLDEN RULE (see master plan): every rule below is plain JS deciding
 * WHETHER and HOW SEVERE an alert is, from numbers already computed by
 * statsService/stockService. Gemini (see geminiService.generateAlertMessage)
 * is only ever handed the already-decided type/title/context to phrase
 * into a sentence - it never influences whether an alert fires.
 */

const REVENUE_DROP_THRESHOLD_PCT = -20; // week-over-week sales drop
const EXPENSE_SPIKE_THRESHOLD_PCT = 30; // week-over-week expense rise
const CATEGORY_ZERO_MIN_PREVIOUS = 500; // ignore trivial categories (Rs)

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Fires when this week's sales dropped sharply vs the previous week. */
async function checkRevenueDrop(tenantId) {
  const stats = await statsService.getDashboardStats(tenantId, 'week');
  const pct = stats.change.salesPct;
  if (pct === null || stats.previous.sales <= 0) return null;
  if (pct > REVENUE_DROP_THRESHOLD_PCT) return null;

  return {
    type: 'revenue_drop',
    severity: pct <= -40 ? 'high' : 'medium',
    title: `Sales down ${Math.abs(pct)}% this week`,
    context: {
      period: 'week',
      currentSales: stats.sales,
      previousSales: stats.previous.sales,
      pct,
    },
  };
}

/** Fires when this week's expenses jumped sharply vs the previous week. */
async function checkExpenseSpike(tenantId) {
  const stats = await statsService.getDashboardStats(tenantId, 'week');
  const pct = stats.change.expensesPct;
  if (pct === null || stats.previous.expenses <= 0) return null;
  if (pct < EXPENSE_SPIKE_THRESHOLD_PCT) return null;

  return {
    type: 'expense_spike',
    severity: pct >= 60 ? 'high' : 'medium',
    title: `Expenses up ${pct}% this week`,
    context: {
      period: 'week',
      currentExpenses: stats.expenses,
      previousExpenses: stats.previous.expenses,
      pct,
    },
  };
}

/** Fires when any stock item is low or out, reusing stockService's own status logic. */
async function checkLowStock(tenantId) {
  const Items = scopeToTenant(StockItem, tenantId);
  const items = await Items.find({});
  const summary = stockService.summarize(items);
  if (summary.badgeCount === 0) return null;

  return {
    type: 'low_stock',
    severity: summary.outOfStockCount > 0 ? 'high' : 'medium',
    title:
      summary.outOfStockCount > 0
        ? `${summary.outOfStockCount} item(s) out of stock`
        : `${summary.lowStockCount} item(s) running low`,
    context: {
      outOfStockCount: summary.outOfStockCount,
      lowStockCount: summary.lowStockCount,
      outOfStockItems: summary.outOfStockItems.map((i) => i.name),
      lowStockItems: summary.lowStockItems.map((i) => i.name),
    },
  };
}

/** Sums sale amounts per lowercased category from a list of plain {category, amount} rows. */
function sumByCategory(rows) {
  const map = {};
  for (const r of rows) {
    const cat = (r.category || 'general').toLowerCase();
    map[cat] = (map[cat] || 0) + (Number(r.amount) || 0);
  }
  return map;
}

/** Fires when a category that had meaningful sales last week has zero sales this week. */
async function checkCategoryToZero(tenantId) {
  const { currentStart, currentEnd, previousStart, previousEnd } = statsService.getPeriodRanges('week');
  const Entries = scopeToTenant(Entry, tenantId);

  const [currentRows, previousRows] = await Promise.all([
    Entries.find({ type: 'sale', date: { $gte: currentStart, $lt: currentEnd } })
      .select('category amount')
      .lean(),
    Entries.find({ type: 'sale', date: { $gte: previousStart, $lt: previousEnd } })
      .select('category amount')
      .lean(),
  ]);

  const prevMap = sumByCategory(previousRows);
  const currMap = sumByCategory(currentRows);

  const droppedCategories = Object.keys(prevMap).filter(
    (cat) => prevMap[cat] >= CATEGORY_ZERO_MIN_PREVIOUS && !currMap[cat]
  );

  if (droppedCategories.length === 0) return null;

  const previousAmounts = {};
  for (const cat of droppedCategories) previousAmounts[cat] = statsService.round2(prevMap[cat]);

  return {
    type: 'category_zero',
    severity: 'medium',
    title:
      droppedCategories.length === 1
        ? `No sales in "${droppedCategories[0]}" this week`
        : `${droppedCategories.length} categories had no sales this week`,
    context: { droppedCategories, previousAmounts },
  };
}

/**
 * Runs every rule for one tenant, skips any rule whose alert type
 * already fired today (see Alert model's unique index - this check is
 * just a fast pre-check, the index is the real guarantee), asks
 * Gemini to phrase each new one, and saves it. Used by both the
 * manual "Run Check Now" endpoint and the nightly cron job, scoped to
 * exactly one tenant at a time.
 */
async function runChecks(tenantId, { ownerName, shopName, languagePref } = {}) {
  const candidates = (
    await Promise.all([
      checkRevenueDrop(tenantId),
      checkExpenseSpike(tenantId),
      checkLowStock(tenantId),
      checkCategoryToZero(tenantId),
    ])
  ).filter(Boolean);

  const dateKey = todayKey();
  const Alerts = scopeToTenant(Alert, tenantId);

  const created = [];
  const skipped = [];

  for (const candidate of candidates) {
    const existing = await Alerts.findOne({ type: candidate.type, dateKey });
    if (existing) {
      skipped.push(candidate.type);
      continue;
    }

    let message = null;
    try {
      message = await geminiService.generateAlertMessage({
        ownerName: ownerName || 'there',
        shopName: shopName || 'your shop',
        languagePref: languagePref || 'English',
        alertType: candidate.type,
        title: candidate.title,
        context: candidate.context,
      });
    } catch (err) {
      message = null; // title alone is still useful if the AI call fails
    }

    try {
      const alert = await Alerts.create({
        type: candidate.type,
        severity: candidate.severity,
        title: candidate.title,
        message,
        context: candidate.context,
        dateKey,
      });
      created.push(alert);
    } catch (err) {
      // Duplicate key race (e.g. cron + manual trigger overlapping) -
      // the unique index already protects us, just treat it as skipped.
      if (err.code === 11000) {
        skipped.push(candidate.type);
      } else {
        throw err;
      }
    }
  }

  return { created, skipped };
}

module.exports = {
  REVENUE_DROP_THRESHOLD_PCT,
  EXPENSE_SPIKE_THRESHOLD_PCT,
  CATEGORY_ZERO_MIN_PREVIOUS,
  checkRevenueDrop,
  checkExpenseSpike,
  checkLowStock,
  checkCategoryToZero,
  sumByCategory,
  runChecks,
};
