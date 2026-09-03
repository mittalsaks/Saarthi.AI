import { useTranslation } from 'react-i18next';

// Loads /api/analytics/summary on its own timeline. The page's charts
// and stat cards render from the fast /overview endpoint immediately
// and never wait on this - this banner just fills in with its own
// skeleton whenever it's ready (or shows the API's own deterministic
// fallback text if Gemini is unavailable).
export default function AISummaryBanner({ message, loading, aiUnavailable, onRefresh, refreshing }) {
  const { t } = useTranslation();
  return (
    <div className="relative overflow-hidden rounded-3xl bg-cta-gradient-deep p-6 text-white shadow-lifted">
      <div className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full bg-white/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="h-4 w-4">
              <path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
            </svg>
          </span>
          <p className="text-sm font-bold text-blue-100">{t('analytics.summary.title')}</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading || refreshing}
          className="shrink-0 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? t('analytics.summary.refreshing') : t('analytics.summary.refresh')}
        </button>
      </div>

      {loading ? (
        <div className="relative mt-4 space-y-2.5">
          <span className="block h-5 w-full max-w-md animate-pulse rounded bg-white/20" />
          <span className="block h-5 w-3/4 max-w-sm animate-pulse rounded bg-white/20" />
        </div>
      ) : (
        <>
          <p className="relative mt-4 text-base font-semibold leading-relaxed">{message}</p>
          {aiUnavailable && (
            <p className="relative mt-2 text-xs text-blue-100">{t('analytics.summary.aiUnavailable')}</p>
          )}
        </>
      )}
    </div>
  );
}