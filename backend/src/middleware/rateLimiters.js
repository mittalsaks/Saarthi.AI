const rateLimit = require('express-rate-limit');

/**
 * General limiter for all /api routes - generous, just stops abuse/bots.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

/**
 * Strict limiter for auth endpoints (login/register/forgot-password) -
 * these are the classic brute-force / credential-stuffing targets.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again in a few minutes' },
});

/**
 * Limiter for AI-backed endpoints (quick-add text/voice/image) - these
 * call the paid Gemini API, so an unbounded loop here is a real cost
 * risk, not just a nuisance.
 */
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 AI calls per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests, please slow down and try again shortly' },
});

module.exports = { generalLimiter, authLimiter, aiLimiter };