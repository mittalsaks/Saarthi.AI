const mongoose = require('mongoose');

/**
 * One ledger line for a udhaar customer.
 * type 'credit'  -> shop gave goods/money on credit, increases what they owe
 * type 'payment' -> customer paid some/all of it back, decreases what they owe
 *
 * Balance owed is always (sum of credit) - (sum of payment) for a
 * customer, computed in udhaarService.js - never stored redundantly.
 */
const udhaarTransactionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UdhaarCustomer',
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
      enum: ['credit', 'payment'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be greater than 0'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

udhaarTransactionSchema.index({ tenantId: 1, customerId: 1, date: -1 });

module.exports = mongoose.model('UdhaarTransaction', udhaarTransactionSchema);
