const Alert = require('../models/Alert');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { scopeToTenant } = require('../middleware/tenantScope');
const alertService = require('../services/alertService');

/**
 * POST /api/alerts/run
 * "Run Check Now" - runs every deterministic rule for the caller's own
 * tenant only (never touches other tenants; the nightly cron in
 * jobs/alertCron.js is what loops over everyone).
 */
async function runCheck(req, res) {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    const user = await User.findById(req.userId);

    const { created, skipped } = await alertService.runChecks(req.tenantId, {
      ownerName: user?.name,
      shopName: tenant?.shopName,
      languagePref: user?.languagePref,
    });

    return res.status(200).json({
      createdCount: created.length,
      skippedCount: skipped.length,
      alerts: created,
    });
  } catch (err) {
    console.error('run alert check error:', err);
    return res.status(500).json({ error: 'Something went wrong while checking for alerts' });
  }
}

/**
 * GET /api/alerts
 * Most recent 50 alerts, newest first.
 */
async function list(req, res) {
  try {
    const Alerts = scopeToTenant(Alert, req.tenantId);
    const alerts = await Alerts.find({}).sort({ createdAt: -1 }).limit(50);
    return res.status(200).json({ alerts });
  } catch (err) {
    console.error('list alerts error:', err);
    return res.status(500).json({ error: 'Something went wrong while loading alerts' });
  }
}

/**
 * GET /api/alerts/unread-count
 * Used by the sidebar badge - deliberately its own fast endpoint so
 * the header doesn't have to fetch the full alert list on every page.
 */
async function unreadCount(req, res) {
  try {
    const Alerts = scopeToTenant(Alert, req.tenantId);
    const badgeCount = await Alerts.countDocuments({ isRead: false });
    return res.status(200).json({ badgeCount });
  } catch (err) {
    console.error('unread alert count error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

/**
 * PATCH /api/alerts/:id/read
 */
async function markRead(req, res) {
  try {
    const Alerts = scopeToTenant(Alert, req.tenantId);
    const alert = await Alerts.findByIdAndUpdate(req.params.id, { $set: { isRead: true } }, { new: true });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    return res.status(200).json({ alert });
  } catch (err) {
    console.error('mark alert read error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

/**
 * PATCH /api/alerts/read-all
 */
async function markAllRead(req, res) {
  try {
    const Alerts = scopeToTenant(Alert, req.tenantId);
    await Alerts.updateMany({ isRead: false }, { $set: { isRead: true } });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('mark all alerts read error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

module.exports = { runCheck, list, unreadCount, markRead, markAllRead };
