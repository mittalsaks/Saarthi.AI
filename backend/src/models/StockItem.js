const mongoose = require('mongoose');

/**
 * A single movement against a stock item's quantity.
 * type 'restock'   -> changeQty is positive (owner added stock)
 * type 'usage'     -> changeQty is negative (sold/used/consumed)
 * type 'adjustment'-> changeQty can be either (manual correction, e.g. wastage)
 *
 * resultingQty is a snapshot of currentQty AFTER this movement was applied,
 * kept so history rows/charts never need to recompute a running total.
 */
const movementSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['restock', 'usage', 'adjustment'],
      required: true,
    },
    changeQty: { type: Number, required: true },
    resultingQty: { type: Number, required: true },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
  },
  { _id: true, timestamps: false }
);

const stockItemSchema = new mongoose.Schema(
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
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: 120,
    },
    // e.g. kg, ltr, pcs, box - display only, never used in math beyond labels
    unit: {
      type: String,
      trim: true,
      maxlength: 20,
      default: 'pcs',
    },
    currentQty: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      min: [0, 'Threshold cannot be negative'],
      default: 5,
    },
    movements: {
      type: [movementSchema],
      default: [],
    },
  },
  { timestamps: true }
);

stockItemSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model('StockItem', stockItemSchema);
