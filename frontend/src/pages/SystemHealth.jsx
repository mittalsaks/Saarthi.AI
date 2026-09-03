import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../lib/api';

// Public page - deliberately does NOT check isLoggedIn() or render
// AppHeader (which assumes a logged-in session for its nav/badges).
// Hits GET /api/system-health directly, which requires no auth.
export default function SystemHealth() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/system-health`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && json.error) || `Request failed (${res.status})`);
      setData(json);
    } catch (err) {
      console.error('system health load failed:', err);
      setError(err.message || t('systemHealth.fetchError'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="border-b border-surface-500 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cta-gradient text-sm font-bold text-white">
              D
            </span>
            <p className="text-sm font-semibold text-slate-800">{t('systemHealth.title')}</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-surface-600 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {loading ? t('systemHealth.checking') : t('systemHealth.rerun')}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {loading && !data && <p className="text-sm text-muted">{t('systemHealth.running')}</p>}

        {error && (
          <p className="rounded-lg bg-danger/10 px-4 py-2 text-sm font-medium text-danger">{error}</p>
        )}

        {data && (
          <>
            <div
              className={`flex items-center justify-between rounded-xl border p-4 ${
                data.allPassed ? 'border-accent-green/30 bg-accent-green/5' : 'border-danger/30 bg-danger/5'
              }`}
            >
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {data.allPassed ? t('systemHealth.allOperational') : t('systemHealth.someFailed')}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {t('systemHealth.lastChecked', { date: new Date(data.checkedAt).toLocaleString() })}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  data.allPassed ? 'bg-accent-green/10 text-accent-green' : 'bg-danger/10 text-danger'
                }`}
              >
                {data.allPassed ? t('systemHealth.healthy') : t('systemHealth.degraded')}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {data.checks.map((check) => (
                <div
                  key={check.name}
                  className={`rounded-xl border p-4 ${
                    check.passed ? 'border-surface-500 bg-white' : 'border-danger/30 bg-danger/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">{check.name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        check.passed ? 'bg-accent-green/10 text-accent-green' : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {check.passed ? t('systemHealth.pass') : t('systemHealth.fail')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{check.message}</p>
                  <p className="mt-1 text-[11px] text-muted-light">{check.durationMs}ms</p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs text-muted-light">
              {t('systemHealth.footerNote')}
            </p>
          </>
        )}
      </main>
    </div>
  );
}