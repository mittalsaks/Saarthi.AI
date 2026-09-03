/**
 * Validates + sanitizes whatever geminiService.parseEntryFromText()
 * returned. Nothing from Gemini reaches Entry.create() without going
 * through here first - this is the enforcement point for the golden
 * rule "AI never calculates numbers, and we never trust its shape
 * blindly either".
 *
 * Returns { valid: true, entry } or { valid: false, error }.
 */

const VALID_TYPES = ['sale', 'expense'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateQuickAddResult(parsed, fallbackText) {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'AI response was not a valid object' };
  }

  const type = VALID_TYPES.includes(parsed.type) ? parsed.type : 'expense';

  const amount = Number(parsed.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      valid: false,
      error: "Couldn't figure out a valid amount from that - please try again or use the manual form",
    };
  }
  // Sanity cap - a single kirana-store entry being in the crores is
  // almost certainly a misparse (e.g. Gemini echoed a phone number).
  if (amount > 10000000) {
    return { valid: false, error: 'That amount looks too large to be right - please use the manual form' };
  }

  let category = typeof parsed.category === 'string' ? parsed.category.trim().toLowerCase() : '';
  if (!category) category = 'general';
  category = category.slice(0, 60);

  let description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
  if (!description) description = String(fallbackText || '').trim().slice(0, 300);
  description = description.slice(0, 300);

  let date = new Date();
  if (typeof parsed.date === 'string' && DATE_RE.test(parsed.date)) {
    const candidate = new Date(`${parsed.date}T00:00:00`);
    const now = new Date();
    const notTooFarInFuture = candidate.getTime() <= now.getTime() + 24 * 60 * 60 * 1000;
    const notTooFarInPast = candidate.getFullYear() >= now.getFullYear() - 5;
    if (!Number.isNaN(candidate.getTime()) && notTooFarInFuture && notTooFarInPast) {
      date = candidate;
    }
  }

  return {
    valid: true,
    entry: {
      type,
      amount: Math.round(amount * 100) / 100,
      category,
      description,
      date,
    },
  };
}

module.exports = { validateQuickAddResult };
