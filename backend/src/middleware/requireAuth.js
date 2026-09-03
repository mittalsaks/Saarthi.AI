const jwt = require('jsonwebtoken');

/**
 * Verifies the Bearer JWT on the Authorization header and attaches
 * req.tenantId / req.userId / req.userRole to the request.
 *
 * req.tenantId ALWAYS comes from the verified token payload, never from
 * req.body/req.params/req.query - this is what makes scopeToTenant()
 * (see tenantScope.js) safe to trust in every downstream controller.
 *
 * The routes that actually issue these tokens (register/login) are
 * built in Part 2. This middleware is fully functional already; it
 * just has nothing to verify against until those routes exist.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload.tenantId || !payload.userId) {
      return res.status(401).json({ error: 'Token missing required claims' });
    }

    req.tenantId = payload.tenantId;
    req.userId = payload.userId;
    req.userRole = payload.role;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
