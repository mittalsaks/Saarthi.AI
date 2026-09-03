/**
 * Every language Saarthi.ai's AI features (quick-add, greetings, alerts,
 * udhaar reminders, analytics summaries...) can be asked to respond in.
 *
 * NOTE: The app UI itself is English-only (no language toggle/dropdown
 * anywhere in the frontend). This list only controls the language the
 * AI uses when parsing/replying to the voice + text quick-add feature,
 * so shop owners can still speak/type in Hindi or Hinglish there.
 */
const LANGUAGE_PREFS = ['English', 'Hindi', 'Hinglish'];

module.exports = { LANGUAGE_PREFS };