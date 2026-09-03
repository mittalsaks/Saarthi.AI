import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function formatRupees(n) {
  const abs = Math.abs(n);
  return `${n < 0 ? '-' : ''}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// pct === null means statsService had no previous-period baseline to
// compare against (e.g. shop just started) - show a neutral "naya" tag
// instead of implying a real 0% change.
function ChangeBadge({ pct, invert = false }) {
  const { t } = useTranslation();
  if (pct === null || pct === undefined) {
    return (
      <span className="inline-flex items-center rounded-full bg-surface-300 px-2 py-0.5 text-xs font-medium text-muted">
        {t('dashboard.stat.new')}
      </span>
    );
  }
  const isUp = pct > 0;
  const isFlat = pct === 0;
  // For expenses, "up" is bad - invert which color reads as good.
  const isGood = isFlat ? null : invert ? !isUp : isUp;

  const color = isFlat
    ? 'bg-surface-300 text-muted'
    : isGood
    ? 'bg-accent/10 text-accent-green'
    : 'bg-danger/10 text-danger';

  const arrow = isFlat ? '' : isUp ? '↑' : '↓';

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {arrow} {Math.abs(pct)}%
    </span>
  );
}

// Small line-art icons per accent so cards read at a glance instead of
// showing a meaningless first-letter avatar.
const ICONS = {
  primary: (
    <path d="M3 17l6-6 4 4 8-8M21 7v6M21 7h-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  danger: (
    <path d="M3 7l6 6 4-4 8 8M21 17v-6M21 17h-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  accent: (
    <path d="M12 3v3m0 12v3M5 8a5 5 0 015-2h.5a3.5 3.5 0 010 7h-1a3.5 3.5 0 000 7H10a5 5 0 005-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  navy: (
    <path d="M4 6h16M4 12h16M4 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
  ),
};

export default function StatCard({ label, value, pct, invert, loading, accent = 'primary', format = 'currency', to }) {
  const { t } = useTranslation();
  const displayValue = format === 'currency' ? formatRupees(value) : value.toLocaleString('en-IN');
  const isEmpty = !loading && value === 0;

  const chipGradient = {
    primary: 'linear-gradient(150deg,#93c5fd,#2563eb)',
    accent: 'linear-gradient(150deg,#67e8f9,#0891b2)',
    danger: 'linear-gradient(150deg,#f87171,#dc2626)',
    navy: 'linear-gradient(150deg,#fbbf24,#d97706)',
  };

  const Wrapper = to ? Link : 'div';

  return (
    <Wrapper to={to} className="stat-card group block overflow-hidden p-5">
      {/* faint decorative wash in the corner, tinted to the card's accent */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.14] transition group-hover:scale-125"
        style={{ background: chipGradient[accent] || chipGradient.primary }}
      />

      <div className="relative flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-soft transition group-hover:scale-105"
          style={{ background: chipGradient[accent] || chipGradient.primary }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5">
            {ICONS[accent] || ICONS.primary}
          </svg>
        </span>
        {loading ? (
          <span className="h-5 w-12 animate-pulse rounded-full bg-surface-300" />
        ) : (
          <ChangeBadge pct={pct} invert={invert} />
        )}
      </div>

      <p className={`relative mt-4 text-2xl font-extrabold tracking-tight ${isEmpty ? 'text-muted-light' : 'text-slate-900'}`}>
        {loading ? <span className="inline-block h-7 w-24 animate-pulse rounded bg-surface-300" /> : displayValue}
      </p>
      <p className="relative mt-0.5 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>

      {to && (
        <div className="card-open-hint relative mt-2 text-[11px] font-bold text-primary">
          {t('dashboard.stat.viewDetails', 'View details')}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </Wrapper>
  );
}
