import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const LOW_COLOR = '#dc2626';
const OK_COLOR = '#2563eb';

// Small, non-blocking visual read of "what's actually on the shelf" -
// stock's list view is precise but doesn't let you eyeball who's close
// to running out at a glance. Purely derived from the already-loaded
// `items` prop, no extra API call.
export default function StockLevelsChart({ items, loading }) {
  const { t } = useTranslation();

  const data = useMemo(() => {
    return [...items]
      .sort((a, b) => b.currentQty - a.currentQty)
      .slice(0, 8)
      .map((item) => ({
        name: item.name.length > 10 ? `${item.name.slice(0, 9)}…` : item.name,
        qty: item.currentQty,
        threshold: item.lowStockThreshold,
        low: item.status === 'low' || item.currentQty <= item.lowStockThreshold,
        unit: item.unit,
      }));
  }, [items]);

  if (loading) {
    return (
      <div className="panel-card p-5">
        <div className="h-4 w-32 animate-pulse rounded bg-surface-200" />
        <div className="mt-4 h-52 animate-pulse rounded-xl bg-surface-200" />
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="panel-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{t('stock.chart.title')}</h3>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: OK_COLOR }} /> {t('stock.chart.legendOk')}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: LOW_COLOR }} /> {t('stock.chart.legendLow')}
          </span>
        </div>
      </div>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#eaf2ff" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5c6c86' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#5c6c86' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <defs>
              <linearGradient id="stockOkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor={OK_COLOR} />
              </linearGradient>
              <linearGradient id="stockLowFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="100%" stopColor={LOW_COLOR} />
              </linearGradient>
            </defs>
            <Tooltip
              cursor={{ fill: 'rgba(37,99,235,0.06)' }}
              formatter={(value, key, entry) => [`${value} ${entry.payload.unit}`, t('stock.chart.tooltipQty')]}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: 12,
                background: 'rgba(15,32,73,0.95)',
                color: '#fff',
                boxShadow: '0 20px 45px -12px rgba(37,99,235,0.28)',
              }}
              labelStyle={{ color: '#bfdbfe', fontWeight: 700 }}
            />
            <Bar dataKey="qty" radius={[6, 6, 0, 0]} maxBarSize={34} animationDuration={900} animationEasing="ease-out">
              {data.map((d, i) => (
                <Cell key={i} fill={d.low ? 'url(#stockLowFill)' : 'url(#stockOkFill)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
