const Entry = require('../models/Entry');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { scopeToTenant } = require('../middleware/tenantScope');
const statsService = require('../services/statsService');
const geminiService = require('../services/geminiService');
const { validateQuickAddResult } = require('../services/validateQuickAdd');

const VALID_TYPES = ['sale', 'expense'];

/**
 * POST /api/entries
 * Manual entry creation (the fallback form the frontend uses when
 * quick-add fails or the owner just prefers typing fields directly).
 */
async function create(req, res) {
  try {
    const { type, amount, category, description, date } = req.body || {};

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const Entries = scopeToTenant(Entry, req.tenantId);
    const entry = await Entries.create({
      createdBy: req.userId,
      type,
      amount: numAmount,
      category: category ? String(category).trim().slice(0, 60) : 'general',
      description: description ? String(description).trim().slice(0, 300) : '',
      date: date ? new Date(date) : new Date(),
      source: 'manual',
    });

    return res.status(201).json({ entry });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('create entry error:', err);
    return res.status(500).json({ error: 'Something went wrong while saving the entry' });
  }
}

/**
 * POST /api/entries/quick-add
 * Free text -> Gemini structured guess -> validated/sanitized -> saved.
 * If Gemini is unavailable or the parse fails validation, returns 422
 * so the frontend can fall back to the manual form instead of retrying
 * blindly.
 */
async function quickAdd(req, res) {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > 500) {
      return res.status(400).json({ error: 'text is too long (max 500 characters)' });
    }

    const user = await User.findById(req.userId).select('languagePref');
    const languagePref = user?.languagePref || 'Hinglish';

    let parsed;
    try {
      parsed = await geminiService.parseEntryFromText(text, languagePref);
    } catch (aiErr) {
      console.error('quick-add AI error:', aiErr.message);
      return res.status(422).json({
        error: "Couldn't understand that entry right now - please use the manual form",
        aiUnavailable: true,
      });
    }

    const validated = validateQuickAddResult(parsed, text);
    if (!validated.valid) {
      return res.status(422).json({ error: validated.error, aiUnavailable: false });
    }

    const Entries = scopeToTenant(Entry, req.tenantId);
    const entry = await Entries.create({
      createdBy: req.userId,
      ...validated.entry,
      source: 'quick-add',
      rawText: text.trim().slice(0, 500),
    });

    return res.status(201).json({ entry });
  } catch (err) {
    console.error('quick-add error:', err);
    return res.status(500).json({ error: 'Something went wrong while adding the entry' });
  }
}

/**
 * POST /api/entries/quick-add/voice
 * Audio (base64) -> Gemini audio input -> structured guess -> SAME
 * validateQuickAdd.js sanitization used by the text path -> returned
 * for confirmation. Nothing is saved here - the frontend shows the
 * transcript + parsed fields for review, and only calls POST
 * /api/entries (the existing manual-create endpoint) once the owner
 * confirms, exactly like the manual-form fallback already does.
 */
const MAX_VOICE_DURATION_SECONDS = 20;
// ~8MB of raw audio is generous headroom for a 20s clip at any
// reasonable codec/bitrate; anything bigger is almost certainly a
// mistake (or an abuse attempt) rather than a legitimate quick clip.
const MAX_VOICE_BYTES = 8 * 1024 * 1024;

async function quickAddVoice(req, res) {
  try {
    const { audio, mimeType, durationSeconds } = req.body || {};

    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ error: 'audio is required (base64-encoded)' });
    }
    if (!mimeType || typeof mimeType !== 'string' || !mimeType.startsWith('audio/')) {
      return res.status(400).json({ error: 'A valid audio mimeType is required' });
    }
    if (durationSeconds != null && Number(durationSeconds) > MAX_VOICE_DURATION_SECONDS) {
      return res.status(400).json({
        error: `Voice note is too long - please keep it under ${MAX_VOICE_DURATION_SECONDS} seconds`,
      });
    }

    // base64 -> raw byte length, without allocating a Buffer just to check size.
    const approxBytes = Math.floor((audio.length * 3) / 4);
    if (approxBytes > MAX_VOICE_BYTES) {
      return res.status(400).json({ error: 'Voice note file is too large - please re-record a shorter clip' });
    }

    const user = await User.findById(req.userId).select('languagePref');
    const languagePref = user?.languagePref || 'Hinglish';

    let parsed;
    try {
      parsed = await geminiService.parseEntryFromAudio(audio, mimeType, languagePref);
    } catch (aiErr) {
      console.error('quick-add voice AI error:', aiErr.message);
      return res.status(422).json({
        error: "Couldn't understand that voice note - please try again or use the manual form",
        aiUnavailable: true,
      });
    }

    const transcript = typeof parsed?.transcript === 'string' ? parsed.transcript.trim().slice(0, 500) : '';

    const validated = validateQuickAddResult(parsed, transcript);
    if (!validated.valid) {
      return res.status(422).json({ error: validated.error, aiUnavailable: false, transcript });
    }

    return res.status(200).json({ transcript, entry: validated.entry });
  } catch (err) {
    console.error('quick-add voice error:', err);
    return res.status(500).json({ error: 'Something went wrong while processing the voice note' });
  }
}
/**
 * POST /api/entries/quick-add/image
 * Photo (base64, bill/receipt/handwritten khata page) -> Gemini image
 * input -> structured guess -> SAME validateQuickAdd.js sanitization
 * used by the text/voice paths -> returned for confirmation. Nothing is
 * saved here - the frontend shows what was read + the parsed fields
 * for review, and only calls POST /api/entries (the existing manual-
 * create endpoint) once the owner confirms, exactly like the voice
 * flow already does.
 */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // ~6MB raw is generous for a phone photo of one bill
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

async function quickAddImage(req, res) {
  try {
    const { image, mimeType } = req.body || {};

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'image is required (base64-encoded)' });
    }
    if (!mimeType || typeof mimeType !== 'string' || !ALLOWED_IMAGE_MIME_TYPES.includes(mimeType.toLowerCase())) {
      return res.status(400).json({
        error: `A valid image mimeType is required (one of: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')})`,
      });
    }

    // base64 -> raw byte length, without allocating a Buffer just to check size.
    const approxBytes = Math.floor((image.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: 'Image file is too large - please use a smaller photo (under 6MB)' });
    }

    const user = await User.findById(req.userId).select('languagePref');
    const languagePref = user?.languagePref || 'Hinglish';

    let parsed;
    try {
      parsed = await geminiService.parseEntryFromImage(image, mimeType, languagePref);
    } catch (aiErr) {
      console.error('quick-add image AI error:', aiErr.message);
      return res.status(422).json({
        error: "Couldn't read that image - please try a clearer photo or use the manual form",
        aiUnavailable: true,
      });
    }

    const readText = typeof parsed?.readText === 'string' ? parsed.readText.trim().slice(0, 500) : '';

    const validated = validateQuickAddResult(parsed, readText);
    if (!validated.valid) {
      return res.status(422).json({ error: validated.error, aiUnavailable: false, readText });
    }

    return res.status(200).json({ readText, entry: validated.entry });
  } catch (err) {
    console.error('quick-add image error:', err);
    return res.status(500).json({ error: 'Something went wrong while processing the image' });
  }
}
/**
 * GET /api/entries
 * Query params: type (sale|expense), startDate, endDate (YYYY-MM-DD),
 * limit (default 50, max 200), page (default 1).
 */
async function list(req, res) {
  try {
    const Entries = scopeToTenant(Entry, req.tenantId);
    const filter = {};

    if (req.query.type) {
      if (!VALID_TYPES.includes(req.query.type)) {
        return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
      }
      filter.type = req.query.type;
    }

    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) filter.date.$gte = new Date(`${req.query.startDate}T00:00:00`);
      if (req.query.endDate) filter.date.$lte = new Date(`${req.query.endDate}T23:59:59.999`);
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const [entries, total] = await Promise.all([
      Entries.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Entries.countDocuments(filter),
    ]);

    return res.status(200).json({ entries, total, page, limit });
  } catch (err) {
    console.error('list entries error:', err);
    return res.status(500).json({ error: 'Something went wrong while fetching entries' });
  }
}

/**
 * DELETE /api/entries/:id
 */
async function remove(req, res) {
  try {
    const Entries = scopeToTenant(Entry, req.tenantId);
    const deleted = await Entries.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    return res.status(200).json({ message: 'Entry deleted', id: req.params.id });
  } catch (err) {
    console.error('delete entry error:', err);
    return res.status(500).json({ error: 'Something went wrong while deleting the entry' });
  }
}

/**
 * GET /api/entries/stats?period=today|week|month
 * Pure DB + JS math, no AI - safe to call on every dashboard load.
 */
async function stats(req, res) {
  try {
    const period = req.query.period || 'today';
    const data = await statsService.getDashboardStats(req.tenantId, period);
    return res.status(200).json(data);
  } catch (err) {
    console.error('stats error:', err);
    return res.status(500).json({ error: 'Something went wrong while computing stats' });
  }
}

/**
 * GET /api/entries/greeting
 * Backend computes today's numbers first; Gemini only narrates them.
 * Cached ~30 min per tenant per day inside geminiService.
 */
async function greeting(req, res) {
  try {
    const [user, tenant, todayStats] = await Promise.all([
      User.findById(req.userId).select('name languagePref'),
      Tenant.findById(req.tenantId).select('shopName ownerName'),
      statsService.getTodayStats(req.tenantId),
    ]);

    if (!user || !tenant) {
      return res.status(404).json({ error: 'User or tenant not found' });
    }

    let message;
    try {
      message = await geminiService.generateGreeting({
        tenantId: req.tenantId,
        ownerName: user.name,
        shopName: tenant.shopName,
        languagePref: user.languagePref,
        stats: todayStats,
      });
    } catch (aiErr) {
      console.error('greeting AI error:', aiErr.message);
      // Deterministic fallback so the dashboard never shows a broken
      // greeting just because Gemini is down/rate-limited.
      message = `Namaste, ${user.name}! Aaj ka net profit abhi tak Rs ${todayStats.today.netProfit} hai.`;
    }

    return res.status(200).json({ message, stats: todayStats });
  } catch (err) {
    console.error('greeting error:', err);
    return res.status(500).json({ error: 'Something went wrong while generating the greeting' });
  }
}

/**
 * GET /api/entries/categories
 * Distinct categories this shop has already used, split by sale/expense,
 * so the manual entry form can suggest them in a dropdown instead of the
 * owner retyping "grocery"/"rent" every time. New categories are still
 * free text - this only ever suggests, never restricts.
 */
async function listCategories(req, res) {
  try {
    const [saleCats, expenseCats] = await Promise.all([
      Entry.distinct('category', { tenantId: req.tenantId, type: 'sale' }),
      Entry.distinct('category', { tenantId: req.tenantId, type: 'expense' }),
    ]);

    const clean = (arr) =>
      Array.from(new Set(arr.filter(Boolean).map((c) => String(c).trim()))).sort((a, b) =>
        a.localeCompare(b)
      );

    return res.status(200).json({ sale: clean(saleCats), expense: clean(expenseCats) });
  } catch (err) {
    console.error('list categories error:', err);
    return res.status(500).json({ error: 'Something went wrong while loading categories' });
  }
}

module.exports = { create, quickAdd, quickAddVoice, quickAddImage, list, remove, stats, greeting, listCategories };