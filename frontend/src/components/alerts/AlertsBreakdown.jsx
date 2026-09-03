import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const TYPE_META = {
  revenue_drop: { color: '#dc2626', bg: 'bg-danger/10', text: 'text-danger' },
  expense_spike: { color: '#d97706', bg: 'bg-warning/10', text: 'text-warning' },
  low_stock: { color: '#2563eb', bg: 'bg-primary/10', text: 'text-primary' },
  category_zero: { color: '#0891b2', bg: 'bg-accent/10', text: 'text-accent' },
};

// A quick "what kind of trouble am I in" read across all alerts -
// counts derived client-side from the already-loaded list, so the long
// scroll of individual cards below gets a summary up top instead of
// being the only way to see the shape of things.
export default function AlertsBreakdown({ alerts, loading }) {
  const { t } = useTranslation();

  const TYPE_LABELS = {
    revenue_drop: t('alerts.typeRevenueDrop'),
    expense_spike: t('alerts.typeExpenseSpike'),
    low_stock: t('alerts.typeLowStock'),
    category_zero: t('alerts.typeCategoryZero'),
  };

  const counts = useMemo(() => {
    const byType = {};
    for (const a of alerts) {
      byType[a.type] = (byType[a.type] || 0) + 1;
    }
    return Object.entries(byType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [alerts]);

  if (loading) {
    return (
      <div className="mt-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 flex-1 animate-pulse rounded-xl bg-surface-200" />
        ))}
      </div>
    );
  }

  if (counts.length === 0) return null;

  const total = alerts.length;

  return (
    <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {counts.map(({ type, count }) => {
        const meta = TYPE_META[type] || TYPE_META.low_stock;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={type} className={`rounded-xl border border-surface-500/60 bg-white p-3 ${meta.bg}`}>
            <p className="text-xl font-extrabold text-slate-900">{count}</p>
            <p className={`mt-0.5 truncate text-xs font-semibold ${meta.text}`}>{TYPE_LABELS[type] || type}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-300">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
