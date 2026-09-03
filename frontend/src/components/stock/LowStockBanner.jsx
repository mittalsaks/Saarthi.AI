import { useTranslation } from 'react-i18next';

// Loads /api/stock/alerts/low-stock on its own timeline - the items
// table renders from its own fast list call and never waits on this.
// The endpoint always returns the deterministic counts even if the
// Gemini-phrased aiMessage fails (aiError set instead), so this banner
// only ever shows a spinner, never blocks or errors the whole page.
export default function LowStockBanner({ summary, loading }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="rounded-2xl bg-cta-gradient p-6 text-white shadow-sm">
        <p className="text-sm font-medium text-white/80">{t('stock.banner.title')}</p>
        <div className="mt-3 space-y-2">
          <span className="block h-5 w-full max-w-md animate-pulse rounded bg-white/20" />
          <span className="block h-5 w-3/4 max-w-sm animate-pulse rounded bg-white/20" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const allClear = summary.outOfStockCount === 0 && summary.lowStockCount === 0;

  return (
    <div className="rounded-2xl bg-cta-gradient p-6 text-white shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-white/80">{t('stock.banner.title')}</p>
        {!allClear && (
          <span className="shrink-0 rounded-lg bg-white/15 px-3 py-1 text-xs font-semibold">
            {t('stock.banner.badge', { out: summary.outOfStockCount, low: summary.lowStockCount })}
          </span>
        )}
      </div>

      <p className="mt-3 text-lg font-semibold leading-snug">
        {summary.aiMessage || (allClear ? t('stock.banner.allClear') : t('stock.banner.needsRestock'))}
      </p>
      {summary.aiError && <p className="mt-2 text-xs text-white/70">{t('stock.banner.aiError')}</p>}
    </div>
  );
}