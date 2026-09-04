const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const { LANGUAGE_PREFS } = require('../utils/languages');
const { sendEmail } = require('../services/emailService');

const cache = require('../utils/cache');

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const OTP_TTL_MS = 10 * 60 * 1000; // 10 min

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Shared by register() and verifyRegisterOtp() - creates the Tenant +
 * its first admin User together, rolling back the Tenant if User
 * creation fails (e.g. duplicate email) so we never leave an orphan
 * tenant with no user attached to it.
 */
async function createTenantAndUser({ shopName, ownerName, email, password, businessType, languagePref }) {
  const tenant = await Tenant.create({
    shopName,
    ownerName,
    businessType: businessType || 'general',
  });

  try {
    const user = await User.create({
      tenantId: tenant._id,
      name: ownerName,
      email,
      password, // virtual - hashed by the pre-save hook in User.js
      role: 'admin',
      languagePref: languagePref || 'English',
    });
    return { tenant, user };
  } catch (userErr) {
    await Tenant.findByIdAndDelete(tenant._id);
    throw userErr;
  }
}

function shapeAuthResponse(user, tenant) {
  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      languagePref: user.languagePref,
    },
    tenant: {
      id: tenant._id,
      shopName: tenant.shopName,
      ownerName: tenant.ownerName,
      businessType: tenant.businessType,
    },
  };
}

/**
 * POST /api/auth/register
 * Creates a new Tenant (the shop) + its first admin User together.
 *
 * No mongoose transaction here on purpose: mongodb-memory-server's
 * default standalone mode (and plenty of cheap free-tier Atlas setups)
 * don't support multi-document transactions. Instead we create the
 * Tenant first, then the User, and manually roll back the Tenant if
 * User creation fails (e.g. duplicate email) so we never leave an
 * orphan tenant with no user attached to it.
 */
async function register(req, res) {
  try {
    const { shopName, ownerName, email, password, businessType, languagePref } = req.body || {};

    const missing = [];
    if (!shopName) missing.push('shopName');
    if (!ownerName) missing.push('ownerName');
    if (!email) missing.push('email');
    if (!password) missing.push('password');
    if (missing.length) {
      return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email' });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (languagePref && !LANGUAGE_PREFS.includes(languagePref)) {
      return res.status(400).json({ error: `languagePref must be one of: ${LANGUAGE_PREFS.join(', ')}` });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const { tenant, user } = await createTenantAndUser({
      shopName,
      ownerName,
      email,
      password,
      businessType,
      languagePref,
    });

    const token = signToken({ tenantId: tenant._id, userId: user._id, role: user.role });

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        languagePref: user.languagePref,
      },
      tenant: {
        id: tenant._id,
        shopName: tenant.shopName,
        ownerName: tenant.ownerName,
        businessType: tenant.businessType,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('register error:', err);
    return res.status(500).json({ error: 'Something went wrong while registering' });
  }
}

/**
 * POST /api/auth/register/request-otp
 * Body: same fields as /register.
 * Validates the signup form (same rules as register()), makes sure the
 * email isn't already taken, then emails a 6-digit code and caches the
 * pending signup payload against that email for OTP_TTL_MS. No Tenant
 * or User is created yet - that only happens once the code is verified.
 */
async function requestRegisterOtp(req, res) {
  try {
    const { shopName, ownerName, email, password, businessType, languagePref } = req.body || {};

    const missing = [];
    if (!shopName) missing.push('shopName');
    if (!ownerName) missing.push('ownerName');
    if (!email) missing.push('email');
    if (!password) missing.push('password');
    if (missing.length) {
      return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (languagePref && !LANGUAGE_PREFS.includes(languagePref)) {
      return res.status(400).json({ error: `languagePref must be one of: ${LANGUAGE_PREFS.join(', ')}` });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const otp = generateOtp();
    cache.set(
      `signupOtp:${normalizedEmail}`,
      { otp, payload: { shopName, ownerName, email: normalizedEmail, password, businessType, languagePref } },
      OTP_TTL_MS
    );

    const result = await sendEmail(
      normalizedEmail,
      'Your Saarthi.ai verification code',
      `Your Saarthi.ai verification code is ${otp}. It expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
      { type: 'otp', otp, shopName: shopName || 'Saarthi.ai' }
    );

    if (!result.success) {
      console.error('requestRegisterOtp: email send failed:', result.error);
      return res.status(500).json({ error: 'Could not send the verification email right now - please try again shortly' });
    }

    return res.status(200).json({ message: `A verification code was sent to ${normalizedEmail}` });
  } catch (err) {
    console.error('requestRegisterOtp error:', err);
    return res.status(500).json({ error: 'Something went wrong while sending the verification code' });
  }
}

/**
 * POST /api/auth/register/verify-otp
 * Body: { email, otp }
 * On a matching, unexpired code, creates the Tenant + User from the
 * payload cached by requestRegisterOtp and returns the same shape as
 * /register and /login (token + user + tenant), so the frontend can
 * treat it exactly like a normal successful signup.
 */
async function verifyRegisterOtp(req, res) {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const cacheKey = `signupOtp:${normalizedEmail}`;
    const cached = cache.get(cacheKey);

    if (!cached) {
      return res.status(400).json({ error: 'That code has expired - please request a new one' });
    }
    if (String(otp).trim() !== cached.otp) {
      return res.status(400).json({ error: 'Incorrect verification code' });
    }

    // Guard against a duplicate account being created between the OTP
    // request and verification (e.g. two tabs, or a retried request).
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      cache.del(cacheKey);
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const { tenant, user } = await createTenantAndUser(cached.payload);
    cache.del(cacheKey);

    const token = signToken({ tenantId: tenant._id, userId: user._id, role: user.role });
    return res.status(201).json({ token, ...shapeAuthResponse(user, tenant) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('verifyRegisterOtp error:', err);
    return res.status(500).json({ error: 'Something went wrong while verifying your code' });
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // passwordHash has `select: false` on the schema, so it must be
    // explicitly requested here.
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tenant = await Tenant.findById(user.tenantId);
    if (!tenant || !tenant.isActive) {
      return res.status(403).json({ error: 'This account is not active' });
    }

    const token = signToken({ tenantId: user.tenantId, userId: user._id, role: user.role });

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        languagePref: user.languagePref,
      },
      tenant: {
        id: tenant._id,
        shopName: tenant.shopName,
        ownerName: tenant.ownerName,
        businessType: tenant.businessType,
      },
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Something went wrong while logging in' });
  }
}

/**
 * POST /api/auth/google
 * Accepts a Google ID token from the frontend, verifies it against
 * GOOGLE_CLIENT_ID, then either links the googleId to an existing
 * (locally-registered) account with the same email, or creates a new
 * Tenant + User together - same pattern as register(). Issues the same
 * JWT shape as login().
 */
async function googleAuth(req, res) {
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('googleAuth error: GOOGLE_CLIENT_ID is not set');
      return res.status(500).json({ error: 'Google sign-in is not configured' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      return res.status(401).json({ error: 'Invalid Google credential' });
    }

    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Invalid Google credential' });
    }

    const email = String(payload.email).toLowerCase().trim();
    const name = payload.name || email.split('@')[0];

    let user = await User.findOne({ email });
    let tenant;

    if (!user) {
      // No existing account for this Google email - don't auto-create
      // one. The person needs to sign up first.
      return res.status(404).json({
        error: 'No account found for this Google email. Please create an account first.',
      });
    }

    // Existing account (created via local register or a prior Google
    // sign-in) - link the googleId if not already linked, don't touch
    // anything else about the account.
    if (!user.googleId) {
      user.googleId = payload.sub;
      await user.save();
    }
    tenant = await Tenant.findById(user.tenantId);
    if (!tenant || !tenant.isActive) {
      return res.status(403).json({ error: 'This account is not active' });
    }

    const token = signToken({ tenantId: user.tenantId, userId: user._id, role: user.role });

    return res.status(200).json({ token, ...shapeAuthResponse(user, tenant) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('googleAuth error:', err);
    return res.status(500).json({ error: 'Something went wrong while signing in with Google' });
  }
}

/**
 * POST /api/auth/logout
 *
 * JWTs are stateless and there's no server-side session to destroy, so
 * this is intentionally a no-op that just tells the client to drop its
 * token. Documented here rather than silently omitted so it's clear
 * this isn't a bug - if a real revocation list is ever needed, this is
 * the endpoint that would grow one.
 */
function logout(req, res) {
  return res.status(200).json({ message: 'Logged out. Discard the token client-side.' });
}

/**
 * GET /api/auth/me
 * Convenience endpoint so the frontend can verify a stored token is
 * still valid and re-hydrate user/tenant info on refresh. Requires
 * requireAuth, so req.tenantId/req.userId are already verified.
 */
async function me(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        languagePref: user.languagePref,
      },
      tenant: {
        id: tenant._id,
        shopName: tenant.shopName,
        ownerName: tenant.ownerName,
        businessType: tenant.businessType,
      },
    });
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

/**
 * PATCH /api/auth/language
 * Lets an already-registered user change languagePref after signup
 * (e.g. from a settings/profile screen), without touching anything
 * else about their account.
 */
async function updateLanguage(req, res) {
  try {
    const { languagePref } = req.body || {};

    if (!languagePref) {
      return res.status(400).json({ error: 'languagePref is required' });
    }

    if (!LANGUAGE_PREFS.includes(languagePref)) {
      return res.status(400).json({ error: `languagePref must be one of: ${LANGUAGE_PREFS.join(', ')}` });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { languagePref },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        languagePref: user.languagePref,
      },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('updateLanguage error:', err);
    return res.status(500).json({ error: 'Something went wrong while updating language' });
  }
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Always responds with the same generic message regardless of whether
 * the email exists, so this endpoint can't be used to enumerate
 * registered users. If a matching local-auth user is found, emails
 * them a one-time reset link valid for 1 hour.
 */
async function forgotPassword(req, res) {
  const GENERIC_MESSAGE = 'If an account exists for that email, a reset link has been sent.';
  try {
    const { email } = req.body || {};
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim(), authProvider: 'local' });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save({ validateBeforeSave: false });

      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      const resetUrl = `${appUrl}/auth?resetToken=${rawToken}`;

      const body =
        `We received a request to reset your Saarthi.ai password.\n\n` +
        `Reset it here (valid for 1 hour): ${resetUrl}\n\n` +
        `If you didn't request this, you can safely ignore this email - your password won't be changed.`;

      const result = await sendEmail(user.email, 'Reset your Saarthi.ai password', body, {
        type: 'reset',
        resetUrl,
        shopName: 'Saarthi.ai',
      });
      if (!result.success) {
        console.error('forgotPassword: email send failed:', result.error);
      }
    }

    return res.status(200).json({ message: GENERIC_MESSAGE });
  } catch (err) {
    console.error('forgotPassword error:', err);
    // Still return the generic message - never leak whether something
    // broke for a specific email address.
    return res.status(200).json({ message: GENERIC_MESSAGE });
  }
}

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 * Verifies the raw token against the stored hash + expiry, then sets
 * the new password and invalidates the token so it can't be reused.
 */
async function resetPassword(req, res) {
  try {
    const { token, password } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Reset token is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordTokenHash +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    user.password = password; // virtual setter -> hashed by the pre-validate hook
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Password updated. You can now log in with your new password.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ error: 'Something went wrong while resetting your password' });
  }
}

module.exports = {
  register,
  requestRegisterOtp,
  verifyRegisterOtp,
  login,
  googleAuth,
  logout,
  me,
  updateLanguage,
  forgotPassword,
  resetPassword,
};