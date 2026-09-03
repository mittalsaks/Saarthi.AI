const systemHealthService = require('../services/systemHealthService');

/**
 * GET /api/system-health
 * Public, no auth required - backs the public /system-health page.
 * Runs real live checks (see systemHealthService) and reports
 * pass/fail per check rather than a single opaque status.
 */
async function getSystemHealth(req, res) {
  try {
    const checks = await systemHealthService.runAllChecks();
    const allPassed = checks.every((c) => c.passed);
    return res.status(200).json({ allPassed, checkedAt: new Date().toISOString(), checks });
  } catch (err) {
    console.error('system health error:', err);
    return res.status(500).json({ error: 'Something went wrong while running health checks' });
  }
}

module.exports = { getSystemHealth };
