import { useTranslation } from 'react-i18next';
import { formatRupees, formatNumber, formatPercent } from '../../lib/format';

// pct === null means analyticsService had no previous-period baseline
// (e.g. shop just started) - show a neutral "naya" tag instead of
// implying a real 0% change. isPoints=true means the change is already
// in percentage points (profit margin), not a percent-of-percent.
function ChangeBadge({ pct, invert = false, isPoints = false }) {
  const { t } = useTranslation();

  if (pct === null || pct === undefined) {
    return (
      <span className="inline-flex items-center rounded-full bg-surface-300 px-2 py-0.5 text-xs font-medium text-muted">
        {t('analytics.cards.new')}
      </span>
    );
  }
  const isUp = pct > 0;
  const isFlat = pct === 0;
  const isGood = isFlat ? null : invert ? !isUp : isUp;

  const color = isFlat
    ? 'bg-surface-300 text-muted'
    : isGood
    ? 'bg-accent/10 text-accent-green'
    : 'bg-danger/10 text-danger';

  const arrow = isFlat ? '' : isUp ? '↑' : '↓';
  const suffix = isPoints ? ` ${t('analytics.cards.ptsSuffix')}` : '%';

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {arrow} {Math.abs(pct)}
      {suffix}
    </span>
  );
}

const ACCENT_GRADIENTS = {
  primary: 'linear-gradient(150deg,#93c5fd,#2563eb)',
  accent: 'linear-gradient(150deg,#67e8f9,#0891b2)',
  danger: 'linear-gradient(150deg,#f87171,#dc2626)',
  navy: 'linear-gradient(150deg,#c4b5fd,#7c3aed)',
};

// Per-metric line-art icons (not per-accent letters) so every card reads
// at a glance instead of showing a generic first-letter avatar.
const METRIC_ICONS = {
  sales: <path d="M3 17l6-6 4 4 8-8M21 7v6M21 7h-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  expenses: <path d="M3 7l6 6 4-4 8 8M21 17v-6M21 17h-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  netProfit: <path d="M12 2v20M17 5.5a4 4 0 00-4-2.5h-1a3.5 3.5 0 000 7h2a3.5 3.5 0 010 7h-1.5a4 4 0 01-4-2.8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  profitMarginPct: <path d="M19 5L5 19M8 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM16 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  customersServed: <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  avgSaleValue: <path d="M9 2L4 7v13a1 1 0 001 1h14a1 1 0 001-1V7l-5-5H9zM4 7h16M9 11a3 3 0 006 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
};

export default function AnalyticsStatCard({
  metricKey,
  label,
  value,
  pct,
  invert = false,
  isPoints = false,
  loading,
  accent = 'primary',
  format = 'currency',
  onClick,
}) {
  let displayValue;
  if (format === 'currency') displayValue = formatRupees(value);
  else if (format === 'percent') displayValue = formatPercent(value);
  else displayValue = formatNumber(value);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="stat-card group w-full p-5 text-left disabled:cursor-default"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.14] transition group-hover:scale-125"
        style={{ background: ACCENT_GRADIENTS[accent] || ACCENT_GRADIENTS.primary }}
      />
      <div className="relative flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-soft transition group-hover:scale-105"
          style={{ background: ACCENT_GRADIENTS[accent] || ACCENT_GRADIENTS.primary }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5">
            {METRIC_ICONS[metricKey] || METRIC_ICONS.sales}
          </svg>
        </span>
        {loading ? (
          <span className="h-5 w-12 animate-pulse rounded bg-surface-300" />
        ) : (
          <ChangeBadge pct={pct} invert={invert} isPoints={isPoints} />
        )}
      </div>
      <p className="relative mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
        {loading ? <span className="inline-block h-7 w-24 animate-pulse rounded bg-surface-300" /> : displayValue}
      </p>
      <p className="relative mt-0.5 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <span className="relative mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary opacity-0 transition group-hover:opacity-100">
        Ask AI
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}