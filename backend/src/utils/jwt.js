const jwt = require('jsonwebtoken');

/**
 * Signs a JWT carrying exactly the claims requireAuth.js expects:
 * tenantId, userId, role. Nothing else goes in the payload - keep it
 * minimal so the token stays small and there's no risk of stale/derived
 * data (like email) drifting out of sync with the DB.
 */
function signToken({ tenantId, userId, role }) {
  return jwt.sign(
    { tenantId: String(tenantId), userId: String(userId), role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { signToken };
