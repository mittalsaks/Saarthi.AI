/**
 * All stock math lives here as plain JS. Nothing in this file ever
 * calls Gemini - it only produces numbers/labels that geminiService.js
 * is later allowed to phrase into a sentence (see stockController.js
 * lowStockSummary()).
 */

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * status: 'out' | 'low' | 'ok', purely from currentQty vs threshold -
 * deterministic, no AI involved.
 */
function getStatus(item) {
  if (item.currentQty <= 0) return 'out';
  if (item.currentQty <= item.lowStockThreshold) return 'low';
  return 'ok';
}

/**
 * Average daily usage over the last `windowDays`, derived from 'usage'
 * and negative 'adjustment' movements actually logged for this item.
 * Returns 0 if there isn't enough history to estimate anything yet.
 */
function getAvgDailyUsage(item, windowDays = 30) {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const usageMovements = (item.movements || []).filter(
    (m) => m.changeQty < 0 && new Date(m.date).getTime() >= cutoff
  );
  if (usageMovements.length === 0) return 0;

  const totalUsed = usageMovements.reduce((sum, m) => sum + Math.abs(m.changeQty), 0);
  const earliest = Math.min(...usageMovements.map((m) => new Date(m.date).getTime()));
  const daysSpan = Math.max(1, (Date.now() - earliest) / (24 * 60 * 60 * 1000));

  return totalUsed / daysSpan;
}

/**
 * Estimated date the item runs out at current usage velocity, and the
 * date of the last restock (for the "last restocked" column). Both are
 * plain arithmetic on already-logged movements - never AI-derived.
 */
function getProjection(item) {
  const avgDailyUsage = getAvgDailyUsage(item);
  const restocks = (item.movements || []).filter((m) => m.type === 'restock');
  const lastRestock = restocks.length
    ? restocks.reduce((latest, m) => (new Date(m.date) > new Date(latest.date) ? m : latest))
    : null;

  let daysUntilOut = null;
  let nextDueDate = null;
  if (avgDailyUsage > 0) {
    daysUntilOut = Math.max(0, item.currentQty / avgDailyUsage);
    nextDueDate = new Date(Date.now() + daysUntilOut * 24 * 60 * 60 * 1000);
  }

  return {
    avgDailyUsage: round2(avgDailyUsage),
    daysUntilOut: daysUntilOut === null ? null : Math.round(daysUntilOut),
    nextDueDate,
    lastRestockedAt: lastRestock ? lastRestock.date : null,
  };
}

/**
 * Full serialized view of one stock item for API responses - status +
 * projection bundled in, history included only when requested (list
 * views omit it to keep payloads small; detail view includes it).
 */
function serializeItem(item, { includeHistory = false } = {}) {
  const projection = getProjection(item);
  const out = {
    _id: item._id,
    name: item.name,
    unit: item.unit,
    currentQty: item.currentQty,
    lowStockThreshold: item.lowStockThreshold,
    status: getStatus(item),
    ...projection,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
  if (includeHistory) {
    out.movements = [...(item.movements || [])].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }
  return out;
}

/**
 * Deterministic summary used both for the sidebar badge count and as
 * the factual context handed to Gemini for the low-stock alert message
 * (geminiService.generateStockAlert) - AI is only ever given this
 * already-computed list, never asked to decide what's low.
 */
function summarize(items) {
  const serialized = items.map((i) => serializeItem(i));
  const low = serialized.filter((i) => i.status === 'low');
  const out = serialized.filter((i) => i.status === 'out');
  return {
    totalItems: serialized.length,
    lowStockCount: low.length,
    outOfStockCount: out.length,
    badgeCount: low.length + out.length,
    lowStockItems: low,
    outOfStockItems: out,
  };
}

module.exports = { getStatus, getAvgDailyUsage, getProjection, serializeItem, summarize };
