import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatRupees } from '../../lib/format';

// Same idea as StockLevelsChart: derived entirely from the customer list
// already loaded for the page, so who owes the most is visible without
// scanning every row.
export default function TopDebtorsChart({ customers, loading }) {
  const { t } = useTranslation();

  const data = useMemo(() => {
    return customers
      .filter((c) => c.balance > 0)
      .slice(0, 6)
      .map((c) => ({
        name: c.name.length > 12 ? `${c.name.slice(0, 11)}…` : c.name,
        balance: c.balance,
      }));
  }, [customers]);

  if (loading) {
    return (
      <div className="panel-card p-5">
        <div className="h-4 w-36 animate-pulse rounded bg-surface-200" />
        <div className="mt-4 h-48 animate-pulse rounded-xl bg-surface-200" />
      </div>
    );
  }

  if (data.length === 0) return null;

  // Give the bars some breathing room on the right so the value label
  // never gets clipped, regardless of how large the biggest balance is.
  const maxBalance = Math.max(...data.map((d) => d.balance));
  const barHeight = 42;

  return (
    <div className="panel-card p-5">
      <h3 className="text-sm font-semibold text-slate-800">{t('udhaar.chart.title')}</h3>
      <p className="mt-1 text-xs text-muted">Who owes you the most, at a glance.</p>
      <div style={{ height: Math.max(160, data.length * barHeight) }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 56, left: 0, bottom: 4 }}
            barCategoryGap={14}
          >
            <CartesianGrid horizontal={false} stroke="#eaf2ff" />
            <XAxis
              type="number"
              domain={[0, maxBalance * 1.15]}
              tick={{ fontSize: 11, fill: '#5c6c86' }}
              tickFormatter={(v) => formatRupees(v)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              cursor={{ fill: 'rgba(37,99,235,0.06)' }}
              formatter={(value) => [formatRupees(value), t('udhaar.chart.tooltipBalance')]}
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
            <Bar dataKey="balance" fill="url(#debtorGradient)" radius={[0, 8, 8, 0]} maxBarSize={22}>
              <LabelList
                dataKey="balance"
                position="right"
                formatter={(v) => formatRupees(v)}
                style={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
              />
            </Bar>
            <defs>
              <linearGradient id="debtorGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}