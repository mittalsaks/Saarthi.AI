const mongoose = require('mongoose');

/**
 * A customer the shop extends credit (udhaar) to. The running balance
 * they owe is NEVER stored here - it is always derived in plain JS
 * (see services/udhaarService.js) by summing that customer's
 * UdhaarTransaction rows, so it can never drift out of sync with the
 * ledger.
 */
const udhaarCustomerSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: '',
    },
    note: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    // Set every time the daily reminder cron (or a manual "Send
    // Reminder" click) actually delivers a message to this customer.
    // Used only for the "last reminded" stamp - never gates anything.
    lastReminderSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

udhaarCustomerSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model('UdhaarCustomer', udhaarCustomerSchema);