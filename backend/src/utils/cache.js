/**
 * Minimal in-memory TTL cache, used to avoid hammering the Gemini API
 * for things like the daily greeting or repeated quick-add-adjacent
 * calls. Deliberately not Redis/etc - this app is single-instance and
 * a Map is enough; if it's ever scaled horizontally this file is the
 * only thing that needs to change.
 */

const store = new Map();

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 min

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function del(key) {
  store.delete(key);
}

function clear() {
  store.clear();
}

module.exports = { get, set, del, clear, DEFAULT_TTL_MS };
