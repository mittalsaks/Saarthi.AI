import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { formatRupees, formatNumber } from '../../lib/format';

function formatContextValue(metric, n) {
  if (n === null || n === undefined) return '—';
  if (metric === 'profitMarginPct') return `${n}%`;
  if (metric === 'customersServed') return formatNumber(n);
  return formatRupees(n);
}

// Fetches its own explanation on open - the backend hands Gemini only
// already-computed numbers (current/previous/pct/top categories), so
// whatever comes back can never disagree with the card the user tapped.
export default function ExplainNumberModal({ open, metric, label, range, onClose }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState('');
  const [context, setContext] = useState(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !metric) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    setExplanation('');
    setContext(null);
    setAiUnavailable(false);

    api
      .post('/api/analytics/explain-number', { metric, range })
      .then((data) => {
        if (cancelled) return;
        setExplanation(data.explanation);
        setContext(data.context);
        setAiUnavailable(Boolean(data.aiUnavailable));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || t('analytics.explain.error'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, metric, range, t]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-primary">{t('analytics.explain.eyebrow')}</p>
            <h3 className="mt-0.5 text-lg font-bold text-slate-800">{label}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-100 hover:text-slate-700"
            aria-label={t('analytics.explain.close')}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 min-h-[4.5rem]">
          {loading ? (
            <div className="space-y-2">
              <span className="block h-4 w-full animate-pulse rounded bg-surface-300" />
              <span className="block h-4 w-5/6 animate-pulse rounded bg-surface-300" />
              <span className="block h-4 w-2/3 animate-pulse rounded bg-surface-300" />
            </div>
          ) : error ? (
            <p className="text-sm font-medium text-danger">{error}</p>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-slate-700">{explanation}</p>
              {aiUnavailable && (
                <p className="mt-2 text-xs text-muted">{t('analytics.explain.aiUnavailable')}</p>
              )}
            </>
          )}
        </div>

        {context && !loading && !error && (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-surface-50 p-3 text-xs">
            <div>
              <p className="text-muted">{t('analytics.explain.current')}</p>
              <p className="mt-0.5 font-semibold text-slate-800">{formatContextValue(metric, context.current)}</p>
            </div>
            <div>
              <p className="text-muted">{t('analytics.explain.previous')}</p>
              <p className="mt-0.5 font-semibold text-slate-800">{formatContextValue(metric, context.previous)}</p>
            </div>
            {context.topCategories?.length > 0 && (
              <div className="col-span-2">
                <p className="text-muted">{t('analytics.explain.topCategories')}</p>
                <p className="mt-0.5 font-semibold text-slate-800">
                  {context.topCategories.map((c) => c.category).join(', ')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}