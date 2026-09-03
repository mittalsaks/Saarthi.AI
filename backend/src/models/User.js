const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { LANGUAGE_PREFS } = require('../utils/languages');

/**
 * A User belongs to exactly one Tenant (tenantId, required + indexed).
 * Password hashing happens here via a pre-save hook so no controller
 * ever has to remember to hash it manually.
 */
const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email'],
    },
    passwordHash: {
      type: String,
      // Google-authenticated users never set a password, so this is
      // only required for the 'local' auth flow.
      required: [
        function passwordRequiredForLocal() {
          return this.authProvider === 'local';
        },
        'Password is required',
      ],
      select: false, // never return password hash by default
    },
    // "Forgot password" flow: we store a SHA-256 hash of the reset
    // token (never the raw token itself - same principle as passwords)
    // plus an expiry, so a leaked DB dump can't be used to reset
    // anyone's password after the fact.
    resetPasswordTokenHash: { type: String, select: false, default: undefined },
    resetPasswordExpires: { type: Date, select: false, default: undefined },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: {
      type: String,
      default: undefined,
      sparse: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ['admin', 'staff'],
      default: 'admin', // first user created with a tenant is always admin
    },
    // Drives which language the AI responds in throughout the app
    languagePref: {
      type: String,
      enum: LANGUAGE_PREFS,
      default: 'Hinglish',
    },
  },
  { timestamps: true }
);

// Virtual, write-only "password" field so controllers can do
// `new User({ ...fields, password: plainTextPassword })` without
// ever touching bcrypt themselves.
userSchema.virtual('password').set(function setPassword(plainPassword) {
  this._plainPassword = plainPassword;
});

userSchema.pre('validate', async function hashPasswordBeforeSave(next) {
  if (!this._plainPassword) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this._plainPassword, salt);
  this._plainPassword = undefined;
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
