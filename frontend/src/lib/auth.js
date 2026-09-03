// Client-side session storage. The JWT + a small user/tenant snapshot
// (for instant UI like "Namaste, {ownerName}") live in localStorage.
// The token itself is always the source of truth server-side - this is
// just so the UI doesn't flash empty while /api/auth/me round-trips.

const TOKEN_KEY = 'saarthi_token';
const USER_KEY = 'saarthi_user';
const TENANT_KEY = 'saarthi_tenant';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function getStoredTenant() {
  const raw = localStorage.getItem(TENANT_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function saveSession({ token, user, tenant }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
}

// Merge a partial update (e.g. { languagePref }) into the locally
// cached user snapshot, without touching the token or tenant. Used
// after PATCH /api/auth/language so the UI reflects the new pref
// immediately without a full re-login.
export function updateStoredUser(partial) {
  const current = getStoredUser() || {};
  const next = { ...current, ...partial };
  localStorage.setItem(USER_KEY, JSON.stringify(next));
  return next;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TENANT_KEY);
}