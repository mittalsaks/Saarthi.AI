const User = require('../models/User');
const Tenant = require('../models/Tenant');
const analyticsService = require('../services/analyticsService');
const geminiService = require('../services/geminiService');

const EXPLAINABLE_METRICS = [
  'sales',
  'expenses',
  'netProfit',
  'profitMarginPct',
  'customersServed',
  'avgSaleValue',
];

const METRIC_CHANGE_KEY = {
  sales: 'salesPct',
  expenses: 'expensesPct',
  netProfit: 'netProfitPct',
  customersServed: 'customersServedPct',
  avgSaleValue: 'avgSaleValuePct',
  profitMarginPct: 'profitMarginPtsChange', // percentage-POINTS, not percentChange - see analyticsService
};

/**
 * GET /api/analytics/overview?range=7d|30d|90d
 * Pure DB + JS math, no AI call - this must always be fast, since the
 * frontend (Part 8) renders charts/stat cards straight off this before
 * the AI summary has even started loading.
 */
async function overview(req, res) {
  try {
    const range = req.query.range || analyticsService.DEFAULT_RANGE;
    if (!analyticsService.isValidRange(range)) {
      return res.status(400).json({
        error: `range must be one of: ${Object.keys(analyticsService.RANGE_DAYS).join(', ')}`,
      });
    }

    const data = await analyticsService.getAnalyticsOverview(req.tenantId, range);
    return res.status(200).json(data);
  } catch (err) {
    console.error('analytics overview error:', err);
    return res.status(500).json({ error: 'Something went wrong while computing analytics' });
  }
}

/**
 * GET /api/analytics/summary?range=7d|30d|90d&refresh=true
 * Backend computes the full overview first (fast, same helper as
 * above); Gemini only narrates it. `refresh=true` bypasses the ~30 min
 * cache for a manual "regenerate" click on the frontend.
 */
async function summary(req, res) {
  try {
    const range = req.query.range || analyticsService.DEFAULT_RANGE;
    if (!analyticsService.isValidRange(range)) {
      return res.status(400).json({
        error: `range must be one of: ${Object.keys(analyticsService.RANGE_DAYS).join(', ')}`,
      });
    }
    const refresh = req.query.refresh === 'true';

    const [user, tenant, overviewData] = await Promise.all([
      User.findById(req.userId).select('name languagePref'),
      Tenant.findById(req.tenantId).select('shopName ownerName'),
      analyticsService.getAnalyticsOverview(req.tenantId, range),
    ]);

    if (!user || !tenant) {
      return res.status(404).json({ error: 'User or tenant not found' });
    }

    let message;
    let aiUnavailable = false;
    try {
      message = await geminiService.generateBusinessSummary({
        tenantId: req.tenantId,
        range,
        ownerName: user.name,
        shopName: tenant.shopName,
        languagePref: user.languagePref,
        overview: overviewData,
        refresh,
      });
    } catch (aiErr) {
      console.error('analytics summary AI error:', aiErr.message);
      aiUnavailable = true;
      // Deterministic fallback so the summary banner never breaks the
      // page just because Gemini is down/rate-limited.
      const t = overviewData.totals;
      message = `Last ${overviewData.range}: sales Rs ${t.sales}, expenses Rs ${t.expenses}, net profit Rs ${t.netProfit}.`;
    }

    return res.status(200).json({ message, aiUnavailable, range: overviewData.range });
  } catch (err) {
    console.error('analytics summary error:', err);
    return res.status(500).json({ error: 'Something went wrong while generating the summary' });
  }
}

/**
 * POST /api/analytics/explain-number
 * Body: { metric, range }
 * Backend builds the explanation context (current/previous value, %
 * change, top categories) purely from analyticsService's already-
 * computed overview; Gemini only turns that context into 1-3 sentences
 * of plain language. It cannot introduce a number that wasn't in the
 * context handed to it.
 */
async function explainNumber(req, res) {
  try {
    const { metric } = req.body || {};
    const range = req.body?.range || analyticsService.DEFAULT_RANGE;

    if (!EXPLAINABLE_METRICS.includes(metric)) {
      return res.status(400).json({ error: `metric must be one of: ${EXPLAINABLE_METRICS.join(', ')}` });
    }
    if (!analyticsService.isValidRange(range)) {
      return res.status(400).json({
        error: `range must be one of: ${Object.keys(analyticsService.RANGE_DAYS).join(', ')}`,
      });
    }

    const [user, overviewData] = await Promise.all([
      User.findById(req.userId).select('languagePref'),
      analyticsService.getAnalyticsOverview(req.tenantId, range),
    ]);

    const changeKey = METRIC_CHANGE_KEY[metric];
    const context = {
      current: overviewData.totals[metric],
      previous: overviewData.previous[metric] ?? null,
      pct: overviewData.change[changeKey] ?? null,
      // Category breakdown only makes sense for the two revenue/cost
      // metrics - anything else gets explained on trend alone.
      topCategories:
        metric === 'sales'
          ? overviewData.topSaleCategories
          : metric === 'expenses'
          ? overviewData.topExpenseCategories
          : [],
    };

    let explanation;
    let aiUnavailable = false;
    try {
      explanation = await geminiService.explainNumber({
        tenantId: req.tenantId,
        metric,
        range: overviewData.range,
        languagePref: user?.languagePref || 'Hinglish',
        context,
      });
    } catch (aiErr) {
      console.error('explain-number AI error:', aiErr.message);
      aiUnavailable = true;
      explanation = `This value is currently ${context.current}, based on your last ${overviewData.range} of entries.`;
    }

    return res.status(200).json({ metric, range: overviewData.range, explanation, aiUnavailable, context });
  } catch (err) {
    console.error('explain-number error:', err);
    return res.status(500).json({ error: 'Something went wrong while explaining that number' });
  }
}

module.exports = { overview, summary, explainNumber };
