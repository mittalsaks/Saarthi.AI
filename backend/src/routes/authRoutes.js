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

const router = express.Router();

router.post('/register', register);
router.post('/register/request-otp', requestRegisterOtp);
router.post('/register/verify-otp', verifyRegisterOtp);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.patch('/language', requireAuth, updateLanguage);

module.exports = router;