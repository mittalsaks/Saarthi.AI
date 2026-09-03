const StockItem = require('../models/StockItem');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { scopeToTenant } = require('../middleware/tenantScope');
const stockService = require('../services/stockService');
const geminiService = require('../services/geminiService');

/**
 * POST /api/stock
 * Add a new item to track.
 */
async function create(req, res) {
  try {
    const { name, unit, currentQty, lowStockThreshold } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const qty = currentQty === undefined ? 0 : Number(currentQty);
    const threshold = lowStockThreshold === undefined ? 5 : Number(lowStockThreshold);
    if (!Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({ error: 'currentQty must be zero or a positive number' });
    }
    if (!Number.isFinite(threshold) || threshold < 0) {
      return res.status(400).json({ error: 'lowStockThreshold must be zero or a positive number' });
    }

    const Items = scopeToTenant(StockItem, req.tenantId);
    const item = await Items.create({
      createdBy: req.userId,
      name: String(name).trim().slice(0, 120),
      unit: unit ? String(unit).trim().slice(0, 20) : 'pcs',
      currentQty: qty,
      lowStockThreshold: threshold,
      movements: qty > 0
        ? [{ type: 'restock', changeQty: qty, resultingQty: qty, note: 'Initial stock', addedBy: req.userId }]
        : [],
    });

    return res.status(201).json({ item: stockService.serializeItem(item) });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('create stock item error:', err);
    return res.status(500).json({ error: 'Something went wrong while adding the item' });
  }
}

/**
 * GET /api/stock
 * List all items with computed status/projection (no full history -
 * keeps the list payload small; use GET /:id for the expanded row).
 */
async function list(req, res) {
  try {
    const Items = scopeToTenant(StockItem, req.tenantId);
    const items = await Items.find({}).sort({ name: 1 });
    const serialized = items.map((i) => stockService.serializeItem(i));
    return res.status(200).json({ items: serialized });
  } catch (err) {
    console.error('list stock items error:', err);
    return res.status(500).json({ error: 'Something went wrong while loading stock' });
  }
}

/**
 * GET /api/stock/:id
 * Single item, expanded with full movement history (for the
 * expandable row: last restocked / next due / history).
 */
async function getOne(req, res) {
  try {
    const Items = scopeToTenant(StockItem, req.tenantId);
    const item = await Items.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    return res.status(200).json({ item: stockService.serializeItem(item, { includeHistory: true }) });
  } catch (err) {
    console.error('get stock item error:', err);
    return res.status(500).json({ error: 'Something went wrong while loading the item' });
  }
}

/**
 * Shared handler for restock (positive) and usage (negative) actions -
 * both just append a movement and update currentQty; which direction
 * is decided entirely by which route called this, never by the client.
 */
async function applyMovement(req, res, { type, sign }) {
  try {
    const qty = Number(req.body?.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'qty must be a positive number' });
    }

    const Items = scopeToTenant(StockItem, req.tenantId);
    const item = await Items.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const changeQty = sign * qty;
    const newQty = Math.max(0, item.currentQty + changeQty);

    item.currentQty = newQty;
    item.movements.push({
      type,
      changeQty,
      resultingQty: newQty,
      note: req.body?.note ? String(req.body.note).trim().slice(0, 200) : '',
      addedBy: req.userId,
      date: new Date(),
    });
    await item.save();

    return res.status(200).json({ item: stockService.serializeItem(item, { includeHistory: true }) });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`${type} stock item error:`, err);
    return res.status(500).json({ error: 'Something went wrong while updating stock' });
  }
}

const restock = (req, res) => applyMovement(req, res, { type: 'restock', sign: 1 });
const recordUsage = (req, res) => applyMovement(req, res, { type: 'usage', sign: -1 });

/**
 * DELETE /api/stock/:id
 */
async function remove(req, res) {
  try {
    const Items = scopeToTenant(StockItem, req.tenantId);
    const result = await Items.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Item not found' });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('delete stock item error:', err);
    return res.status(500).json({ error: 'Something went wrong while deleting the item' });
  }
}

/**
 * GET /api/stock/alerts/low-stock
 * Deterministic summary (also used for the sidebar badge) plus an AI
 * phrased alert message. If Gemini fails, the numeric summary still
 * returns successfully - only aiMessage is null, so the page never
 * breaks because of the AI call.
 */
async function lowStockSummary(req, res) {
  try {
    const Items = scopeToTenant(StockItem, req.tenantId);
    const items = await Items.find({});
    const summary = stockService.summarize(items);

    let aiMessage = null;
    let aiError = null;
    try {
      const tenant = await Tenant.findById(req.tenantId);
      const user = await User.findById(req.userId);
      aiMessage = await geminiService.generateStockAlert({
        tenantId: req.tenantId,
        ownerName: user?.name || 'there',
        shopName: tenant?.shopName || 'your shop',
        languagePref: user?.languagePref || 'Hinglish',
        summary,
      });
    } catch (err) {
      aiError = 'AI message unavailable right now';
    }

    return res.status(200).json({ ...summary, aiMessage, aiError });
  } catch (err) {
    console.error('low stock summary error:', err);
    return res.status(500).json({ error: 'Something went wrong while checking stock levels' });
  }
}

module.exports = { create, list, getOne, restock, recordUsage, remove, lowStockSummary };
