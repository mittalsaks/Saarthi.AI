const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const alertService = require('../services/alertService');

/**
 * Runs alertService.runChecks() for every active tenant, one at a time
 * (sequential, not Promise.all) so a slow Gemini call for one tenant's
 * alerts never overlaps DB/API load from another - fine for this
 * app's scale, and much easier to reason about than parallel fan-out.
 */
async function runChecksForAllTenants() {
  const tenants = await Tenant.find({ isActive: true }).select('_id shopName');
  const results = [];

  for (const tenant of tenants) {
    try {
      // First-created user for a tenant is always the admin (see User
      // model) - used only to pick a name/language for the AI prompt,
      // never for anything permission-related.
      const admin = await User.findOne({ tenantId: tenant._id }).sort({ createdAt: 1 });
      const { created } = await alertService.runChecks(tenant._id, {
        ownerName: admin?.name,
        shopName: tenant.shopName,
        languagePref: admin?.languagePref,
      });
      results.push({ tenantId: tenant._id, createdCount: created.length });
    } catch (err) {
      console.error(`alert check failed for tenant ${tenant._id}:`, err.message);
      results.push({ tenantId: tenant._id, error: err.message });
    }
  }

  return results;
}

/**
 * Schedules the nightly alert check at 02:00 server time. Deliberately
 * only called from server.js (the real running process) and never
 * from app.js - importing app.js in tests (see tests/*.test.js) must
 * never silently schedule a real recurring job.
 */
function startAlertCron() {
  cron.schedule('0 2 * * *', () => {
    console.log('Running nightly alert check for all tenants...');
    runChecksForAllTenants()
      .then((results) => console.log(`Nightly alert check done: ${results.length} tenant(s) processed`))
      .catch((err) => console.error('Nightly alert check failed:', err));
  });
  console.log('Alert cron scheduled: nightly at 02:00 server time');
}

module.exports = { startAlertCron, runChecksForAllTenants };
