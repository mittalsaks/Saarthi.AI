import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { formatDateShort, formatRupees } from '../../lib/format';

const SALES_COLOR = '#2563eb';
const EXPENSES_COLOR = '#dc2626';

const CHART_TYPES = [
  { key: 'area', label: 'Area' },
  { key: 'bar', label: 'Bar' },
  { key: 'line', label: 'Line' },
  { key: 'pie', label: 'Pie' },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f2049]/95 px-3.5 py-2.5 text-xs text-white shadow-lifted backdrop-blur">
      <p className="font-bold text-blue-100">{formatDateShort(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="mt-1 flex items-center gap-1.5 font-semibold">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {formatRupees(p.value)}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f2049]/95 px-3.5 py-2.5 text-xs text-white shadow-lifted backdrop-blur">
      <p className="flex items-center gap-1.5 font-bold">
        <span className="h-2 w-2 rounded-full" style={{ background: p.payload.fill }} />
        {p.name}: {formatRupees(p.value)}
      </p>
    </div>
  );
}

export default function SalesExpensesChart({ series, loading }) {
  const { t } = useTranslation();
  const [chartType, setChartType] = useState('area');

  const pieData = useMemo(() => {
    const totals = (series || []).reduce(
      (acc, row) => {
        acc.sales += Number(row.sales) || 0;
        acc.expenses += Number(row.expenses) || 0;
        return acc;
      },
      { sales: 0, expenses: 0 }
    );
    return [
      { name: t('analytics.chart.salesSeries'), value: totals.sales, fill: SALES_COLOR },
      { name: t('analytics.chart.expensesSeries'), value: totals.expenses, fill: EXPENSES_COLOR },
    ];
  }, [series, t]);

  const sharedAxisProps = {
    xAxis: (
      <XAxis
        dataKey="date"
        tickFormatter={formatDateShort}
        tick={{ fontSize: 11, fill: '#5c6c86' }}
        minTickGap={20}
        axisLine={{ stroke: '#e6f0ff' }}
        tickLine={false}
      />
    ),
    yAxis: (
      <YAxis
        tick={{ fontSize: 11, fill: '#5c6c86' }}
        width={50}
        tickFormatter={(v) => `₹${v}`}
        axisLine={false}
        tickLine={false}
      />
    ),
  };

  function renderChart() {
    if (chartType === 'bar') {
      return (
        <BarChart data={series} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="salesBarFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor={SALES_COLOR} />
            </linearGradient>
            <linearGradient id="expensesBarFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="100%" stopColor={EXPENSES_COLOR} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e6f0ff" vertical={false} />
          {sharedAxisProps.xAxis}
          {sharedAxisProps.yAxis}
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Bar dataKey="sales" name={t('analytics.chart.salesSeries')} fill="url(#salesBarFill)" radius={[6, 6, 0, 0]} animationDuration={900} animationEasing="ease-out" />
          <Bar dataKey="expenses" name={t('analytics.chart.expensesSeries')} fill="url(#expensesBarFill)" radius={[6, 6, 0, 0]} animationDuration={900} animationBegin={150} animationEasing="ease-out" />
        </BarChart>
      );
    }

    if (chartType === 'line') {
      return (
        <LineChart data={series} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e6f0ff" vertical={false} />
          {sharedAxisProps.xAxis}
          {sharedAxisProps.yAxis}
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Line type="monotone" dataKey="sales" name={t('analytics.chart.salesSeries')} stroke={SALES_COLOR} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} animationDuration={900} />
          <Line type="monotone" dataKey="expenses" name={t('analytics.chart.expensesSeries')} stroke={EXPENSES_COLOR} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} animationDuration={900} animationBegin={150} />
        </LineChart>
      );
    }

    if (chartType === 'pie') {
      return (
        <PieChart>
          <Tooltip content={<PieTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={3}
            animationDuration={900}
          >
            {pieData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      );
    }

    // default: area
    return (
      <AreaChart data={series} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SALES_COLOR} stopOpacity={0.28} />
            <stop offset="100%" stopColor={SALES_COLOR} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expensesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EXPENSES_COLOR} stopOpacity={0.22} />
            <stop offset="100%" stopColor={EXPENSES_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e6f0ff" vertical={false} />
        {sharedAxisProps.xAxis}
        {sharedAxisProps.yAxis}
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Area
          type="monotone"
          dataKey="sales"
          name={t('analytics.chart.salesSeries')}
          stroke={SALES_COLOR}
          strokeWidth={2.5}
          fill="url(#salesFill)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
          animationDuration={900}
        />
        <Area
          type="monotone"
          dataKey="expenses"
          name={t('analytics.chart.expensesSeries')}
          stroke={EXPENSES_COLOR}
          strokeWidth={2.5}
          fill="url(#expensesFill)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
          animationDuration={900}
          animationBegin={150}
        />
      </AreaChart>
    );
  }

  return (
    <div className="panel-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{t('analytics.chart.title')}</h3>
          <p className="mt-1 text-xs text-muted">{t('analytics.chart.subtitle')}</p>
        </div>
        <div className="flex rounded-lg border border-surface-500 bg-surface-50/80 p-1 backdrop-blur">
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.key}
              type="button"
              onClick={() => setChartType(ct.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                chartType === ct.key
                  ? 'bg-nav-active text-white shadow-nav-active'
                  : 'text-muted hover:text-slate-700'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-64">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded-xl bg-surface-200" />
        ) : !series?.length ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            {t('analytics.chart.empty')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}