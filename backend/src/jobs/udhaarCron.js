const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const udhaarAutomationService = require('../services/udhaarAutomationService');

/**
 * Runs the daily customer reminders + admin digest for every active
 * tenant, one at a time (same sequential pattern as alertCron) so a
 * slow Gemini/Gmail call for one tenant never overlaps another.
 */
async function runDailyUdhaarJobsForAllTenants() {
  const tenants = await Tenant.find({ isActive: true }).select('_id shopName');
  const results = [];

  for (const tenant of tenants) {
    try {
      // First-created user for a tenant is the original admin - used
      // for the AI reminder's name/language, same as alertCron.
      const admin = await User.findOne({ tenantId: tenant._id }).sort({ createdAt: 1 });
      const context = {
        ownerName: admin?.name || 'The shop owner',
        shopName: tenant.shopName,
        languagePref: admin?.languagePref || 'Hinglish',
      };

      const reminders = await udhaarAutomationService.sendDailyReminders(tenant._id, context);
      const digest = await udhaarAutomationService.sendAdminDailyDigest(tenant._id, context);

      results.push({ tenantId: tenant._id, reminderCount: reminders.length, digest });
    } catch (err) {
      console.error(`daily udhaar automation failed for tenant ${tenant._id}:`, err.message);
      results.push({ tenantId: tenant._id, error: err.message });
    }
  }

  return results;
}

/**
 * Schedules the daily udhaar automation at 08:30 server time - after
 * the 02:00 alert cron, and early enough that the admin's digest email
 * is waiting for them in the morning. Only called from server.js, same
 * rule as startAlertCron (never from app.js, so tests never schedule a
 * real recurring job).
 */
function startUdhaarCron() {
  cron.schedule('30 8 * * *', () => {
    console.log('Running daily udhaar reminders + admin digest for all tenants...');
    runDailyUdhaarJobsForAllTenants()
      .then((results) => console.log(`Daily udhaar automation done: ${results.length} tenant(s) processed`))
      .catch((err) => console.error('Daily udhaar automation failed:', err));
  });
  console.log('Udhaar cron scheduled: daily at 08:30 server time');
}

module.exports = { startUdhaarCron, runDailyUdhaarJobsForAllTenants };