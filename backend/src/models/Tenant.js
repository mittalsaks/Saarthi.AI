const mongoose = require('mongoose');

/**
 * A Tenant represents one shop/business using Saarthi.ai.
 * Every other collection (users, entries, stock, udhaar, alerts...)
 * will carry a tenantId that points back here, and ALL queries on
 * those collections must go through the tenant-isolation helper in
 * middleware/tenantScope.js - never query them directly with a raw
 * tenantId pulled from req.body or req.params.
 */
const tenantSchema = new mongoose.Schema(
  {
    shopName: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      maxlength: 120,
    },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
      maxlength: 120,
    },
    // Business category, used later for AI context (kirana, tailor, freelancer, etc.)
    businessType: {
      type: String,
      trim: true,
      default: 'general',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', tenantSchema);