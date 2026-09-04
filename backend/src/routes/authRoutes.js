const express = require('express');
const {
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
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/requireAuth');
const { authLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/register/request-otp', authLimiter, requestRegisterOtp);
router.post('/register/verify-otp', authLimiter, verifyRegisterOtp);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleAuth);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.patch('/language', requireAuth, updateLanguage);

module.exports = router;