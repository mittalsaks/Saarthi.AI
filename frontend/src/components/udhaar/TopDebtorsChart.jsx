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
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10)
      .map((c, i) => ({
        rank: i + 1,
        name: c.name.length > 14 ? `${c.name.slice(0, 13)}…` : c.name,
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
  // Slightly tighter rows once the list gets long (e.g. 10 customers)
  // so the chart stays readable without growing enormously tall.
  const barHeight = data.length > 6 ? 34 : 42;

  // Custom Y-axis tick: a small numbered rank badge + the name, so a
  // list of 10 customers still reads at a glance instead of just a
  // wall of names stacked on top of each other.
  function RankTick({ x, y, payload }) {
    const row = data.find((d) => d.name === payload.value);
    return (
      <g transform={`translate(${x},${y})`}>
        <circle cx={-98} cy={0} r={8} fill="#eef2ff" stroke="#c7d7fe" strokeWidth="1" />
        <text x={-98} y={0} dy={3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#4338ca">
          {row?.rank}
        </text>
        <text x={-84} y={0} dy={4} textAnchor="start" fontSize="12" fontWeight="600" fill="#334155">
          {payload.value}
        </text>
      </g>
    );
  }

  return (
    <div className="panel-card p-5">
      <h3 className="text-sm font-semibold text-slate-800">{t('udhaar.chart.title')}</h3>
      <p className="mt-1 text-xs text-muted">Who owes you the most, at a glance.</p>
      <div style={{ height: Math.max(160, data.length * barHeight) }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 56, left: 24, bottom: 4 }}
            barCategoryGap={data.length > 6 ? 8 : 14}
          >
            <defs>
              <linearGradient id="debtorGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
            </defs>
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
              tick={<RankTick />}
              axisLine={false}
              tickLine={false}
              width={100}
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
            <Bar dataKey="balance" fill="url(#debtorGradient)" radius={[0, 8, 8, 0]} maxBarSize={22} animationDuration={800}>
              <LabelList
                dataKey="balance"
                position="right"
                formatter={(v) => formatRupees(v)}
                style={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}