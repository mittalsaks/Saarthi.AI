const mongoose = require('mongoose');

const ALERT_TYPES = ['revenue_drop', 'expense_spike', 'low_stock', 'category_zero'];

/**
 * An Alert is created only after alertService's deterministic rules
 * (see services/alertService.js) already decided something is worth
 * surfacing - `title` and `context` are plain JS-computed facts;
 * `message` is Gemini's phrasing of them and may be null if the AI
 * call failed (the alert is still fully usable without it).
 *
 * `dateKey` + the unique compound index below is what prevents the
 * nightly cron and repeated "Run Check Now" clicks from spamming the
 * same alert type multiple times in one day - at most one alert per
 * (tenant, type, day).
 */
const alertSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ALERT_TYPES,
      required: true,
    },
    severity: {
      type: String,
      enum: ['medium', 'high'],
      default: 'medium',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    // Deterministic numbers the rule used to decide this alert -
    // never AI-derived, kept for transparency/debugging.
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    dateKey: {
      type: String, // 'YYYY-MM-DD', the day the check ran
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

alertSchema.index({ tenantId: 1, type: 1, dateKey: 1 }, { unique: true });
alertSchema.index({ tenantId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
module.exports.ALERT_TYPES = ALERT_TYPES;
