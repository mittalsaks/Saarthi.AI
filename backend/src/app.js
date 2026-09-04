const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

const authRoutes = require('./routes/authRoutes');
const entryRoutes = require('./routes/entryRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const stockRoutes = require('./routes/stockRoutes');
const udhaarRoutes = require('./routes/udhaarRoutes');
const alertRoutes = require('./routes/alertRoutes');
const reportRoutes = require('./routes/reportRoutes');
const systemHealthRoutes = require('./routes/systemHealthRoutes');
const { requireAuth } = require('./middleware/requireAuth');
const { scopeToTenant } = require('./middleware/tenantScope');
const { generalLimiter } = require('./middleware/rateLimiters');
const User = require('./models/User');

// Comma-separated list of allowed frontend origins, e.g.
// "http://localhost:5173,https://app.dukkanai.com". Falls back to
// allowing any origin only when explicitly unset (local dev).
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser requests (curl/Postman/no Origin header)
        // and any origin when CORS_ORIGINS isn't configured yet.
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
  // Default JSON limit (100kb) is plenty for every route except voice
  // quick-add, which carries a base64-encoded audio clip (<=20s,
  // capped at ~8MB raw / ~11MB base64 - see entryController.js). Raise
  // the global limit rather than special-casing one route, since the
  // limit only bites when a body is actually that large.
  app.use(express.json({ limit: '12mb' }));
  // Friendly JSON error for oversized bodies instead of the default
  // HTML error page body-parser would otherwise send.
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'That request is too large' });
    }
    return next(err);
  });
  // Strips any request key starting with '$' or containing '.' from
  // body/params/query, blocking NoSQL-injection-style operator payloads.
  app.use(mongoSanitize());
  // Global soft rate-limit on every /api route; stricter limiters are
  // layered on top for auth and AI endpoints in their own route files.
  app.use('/api', generalLimiter);

  // Simple liveness check - useful for deploy platforms (Render/Vercel)
  // and expanded into the real /system-health page in Part 10.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'saarthi-backend' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/entries', entryRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/stock', stockRoutes);
  app.use('/api/udhaar', udhaarRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/system-health', systemHealthRoutes);

  // Minimal protected route used to prove tenant isolation end-to-end
  // over the real HTTP API (see tests/tenantIsolation.test.js). It
  // deliberately does nothing except list users scoped to the caller's
  // own tenant, via scopeToTenant - the same pattern every future
  // dashboard/analytics/stock route will follow.
  app.get('/api/team', requireAuth, async (req, res) => {
    try {
      const Users = scopeToTenant(User, req.tenantId);
      const users = await Users.find({}).select('name email role');
      return res.status(200).json({ users });
    } catch (err) {
      console.error('team list error:', err);
      return res.status(500).json({ error: 'Something went wrong' });
    }
  });

  // Test suite completion + README + final delivery follow in a later part.

  // 404 fallback for anything else under /api
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

module.exports = { createApp };