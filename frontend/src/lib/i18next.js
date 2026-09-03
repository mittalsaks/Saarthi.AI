import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';

// Maps the same languagePref values used everywhere else in the
// app (User model, register/auth forms) to the locale codes i18next
// resources are keyed under.
export const LANGUAGE_PREF_TO_CODE = {
  English: 'en',
};

const USER_KEY = 'saarthi_user';

// Read the cached user snapshot directly from localStorage (instead of
// importing lib/auth.js) so this module has zero dependencies and can be
// safely imported once, at app startup, before anything else runs.
function detectInitialLanguage() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      const code = user?.languagePref && LANGUAGE_PREF_TO_CODE[user.languagePref];
      if (code) return code;
    }
  } catch {
    // ignore malformed/inaccessible storage (private browsing, etc.)
  }
  return 'en'; // fallback for logged-out pages (Landing, Auth)
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes output
  },
});

// Call after login/register succeeds, or after a languagePref update, so
// the UI switches locale immediately without a full page reload.
export function syncLanguageFromUser(user) {
  const code = user?.languagePref && LANGUAGE_PREF_TO_CODE[user.languagePref];
  if (code && code !== i18n.language) {
    i18n.changeLanguage(code);
  }
}

export default i18n;