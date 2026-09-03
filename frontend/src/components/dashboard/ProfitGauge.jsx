import { useTranslation } from 'react-i18next';

// Circular gauge showing profit margin (netProfit / sales) for the
// selected period. Pure presentational - all numbers are already
// computed server-side in statsService, this component only draws them.

const SIZE = 176;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatRupees(n) {
  const abs = Math.abs(n);
  return `${n < 0 ? '-' : ''}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function ProfitGauge({ sales, expenses, netProfit, loading }) {
  const { t } = useTranslation();
  // Margin as % of sales, clamped to [0, 100] for the ring itself
  // (a >100% or negative margin still shows the real number below,
  // the ring just visually caps so it doesn't wrap around twice).
  const marginPct = sales > 0 ? (netProfit / sales) * 100 : 0;
  const ringPct = Math.max(0, Math.min(100, marginPct));
  const dashOffset = CIRCUMFERENCE * (1 - ringPct / 100);
  const isNegative = netProfit < 0;

  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-primary/10 bg-white p-6 shadow-card">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <div
          className="absolute inset-2 rounded-full opacity-70 blur-xl"
          style={{
            background: isNegative
              ? 'radial-gradient(circle, #fca5a5, transparent 70%)'
              : 'radial-gradient(circle, #93c5fd, #c4b5fd 60%, transparent 75%)',
          }}
        />
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative -rotate-90">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isNegative ? '#f87171' : '#2563eb'} />
              <stop offset="100%" stopColor={isNegative ? '#dc2626' : '#7c3aed'} />
            </linearGradient>
          </defs>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#eaf2ff" strokeWidth={STROKE} />
          {!loading && (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {loading ? (
            <span className="h-4 w-20 animate-pulse rounded bg-surface-300" />
          ) : (
            <>
              <span className={`text-2xl font-extrabold ${isNegative ? 'text-danger' : 'text-slate-900'}`}>
                {formatRupees(netProfit)}
              </span>
              <span className="mt-1 text-xs font-semibold text-muted">{t('dashboard.stat.netProfit')}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex w-full justify-around text-center text-sm">
        <div>
          <p className="font-bold text-slate-900">{loading ? '—' : formatRupees(sales)}</p>
          <p className="text-xs font-medium text-muted">{t('dashboard.stat.sale')}</p>
        </div>
        <div className="w-px bg-surface-500" />
        <div>
          <p className="font-bold text-slate-900">{loading ? '—' : formatRupees(expenses)}</p>
          <p className="text-xs font-medium text-muted">{t('dashboard.stat.expense')}</p>
        </div>
      </div>
    </div>
  );
}