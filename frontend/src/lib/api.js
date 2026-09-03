// Minimal fetch wrapper for talking to the Saarthi.ai backend.
// Every future part (dashboard, analytics, stock, udhaar, alerts) reuses
// this instead of hand-rolling fetch calls, so auth headers and error
// shape stay consistent everywhere.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

import { getToken } from './auth';

/**
 * @param {string} path - starts with /api/...
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.body] - plain object, will be JSON.stringify'd
 * @param {boolean} [options.auth] - attach Bearer token if true (default true)
 */
async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // fetch itself throws on network failure (server down, CORS block, etc)
    const err = new Error('Could not reach the server. Check your connection and try again.');
    err.isNetworkError = true;
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no/invalid JSON body - leave data as null
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get: (path, opts) => apiRequest(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiRequest(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => apiRequest(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => apiRequest(path, { ...opts, method: 'DELETE' }),
};

export { API_URL };