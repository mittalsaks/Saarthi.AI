const mongoose = require('mongoose');

/**
 * A single sale or expense record for a tenant. This is the row that
 * everything else (dashboard stats, analytics, alerts) is computed
 * from in plain JS - the AI never touches these numbers after
 * creation, it only helps produce them (quick-add) or narrate them
 * (greeting/summary) elsewhere.
 */
const entrySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['sale', 'expense'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be greater than 0'],
    },
    category: {
      type: String,
      trim: true,
      maxlength: 60,
      default: 'general',
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    // The date the sale/expense actually happened (not createdAt, which
    // is "when the row was saved" - the owner might log yesterday's
    // sale today).
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // 'manual' = typed into the plain form, 'quick-add' = parsed by
    // Gemini from free text. Kept for transparency/debugging, not used
    // in any math.
    source: {
      type: String,
      enum: ['manual', 'quick-add'],
      default: 'manual',
    },
    // The raw free text the owner typed, when source is quick-add.
    // Useful for debugging bad parses; never used in calculations.
    rawText: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

entrySchema.index({ tenantId: 1, date: -1 });
entrySchema.index({ tenantId: 1, type: 1, date: -1 });

module.exports = mongoose.model('Entry', entrySchema);
