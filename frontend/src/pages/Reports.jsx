import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isLoggedIn, getStoredUser, getStoredTenant, getToken } from '../lib/auth';
import { api, API_URL } from '../lib/api';
import { formatRupees, formatNumber } from '../lib/format';
import AppHeader from '../components/layout/AppHeader';

// Defaults to the last 30 days ('YYYY-MM-DD' the input[type=date] wants).
function toDateInputValue(d) {
  return d.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { startDate: toDateInputValue(start), endDate: toDateInputValue(end) };
}

const STAT_ICONS = {
  sales: <path d="M3 17l6-6 4 4 8-8M21 7v6M21 7h-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  expenses: <path d="M3 7l6 6 4-4 8 8M21 17v-6M21 17h-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  profit: <path d="M12 3v3m0 12v3M5 8a5 5 0 015-2h.5a3.5 3.5 0 010 7h-1a3.5 3.5 0 000 7H10a5 5 0 005-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  count: <path d="M4 6h16M4 12h16M4 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />,
};

const STAT_GRADIENT = {
  sales: 'linear-gradient(150deg,#93c5fd,#2563eb)',
  expenses: 'linear-gradient(150deg,#f87171,#dc2626)',
  profit: 'linear-gradient(150deg,#67e8f9,#0891b2)',
  count: 'linear-gradient(150deg,#fbbf24,#d97706)',
};

export default function Reports() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = getStoredUser();
  const tenant = getStoredTenant();

  const [range, setRange] = useState(defaultRange);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) navigate('/auth', { replace: true });
  }, [navigate]);

  async function loadReport(r = range) {
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/api/reports?startDate=${r.startDate}&endDate=${r.endDate}`);
      setReport(data.report);
    } catch (err) {
      console.error('report load failed:', err);
      setError(err.message || t('reports.loadError'));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn()) return;
    loadReport(defaultRange());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGenerate(e) {
    e.preventDefault();
    loadReport(range);
  }

  // CSV needs the Bearer token, so it can't be a plain <a href> to the
  // API - fetch it as a blob (auth header attached) and trigger the
  // browser download manually.
  async function handleDownloadCsv() {
    setDownloading(true);
    setError('');
    try {
      const res = await fetch(
        `${API_URL}/api/reports?startDate=${range.startDate}&endDate=${range.endDate}&format=csv`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || t('reports.csvDownloadFailed'));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saarthi-report-${range.startDate}_to_${range.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('csv download failed:', err);
      setError(err.message || t('reports.csvDownloadError'));
    } finally {
      setDownloading(false);
    }
  }

  if (!isLoggedIn()) return null;

  return (
    <div className="min-h-screen app-shell-bg">
      <div className="shell-content lg:pl-64">
      <AppHeader shopName={tenant?.shopName} userName={user?.name} />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{t('reports.title')}</h2>
            {report && (
              <p className="mt-0.5 text-xs font-medium text-muted">
                {range.startDate} &rarr; {range.endDate}
              </p>
            )}
          </div>
        </div>

        <form
          onSubmit={handleGenerate}
          className="mt-4 flex flex-wrap items-end gap-3 panel-card p-4"
        >
          <div>
            <label className="block text-xs font-semibold text-muted">{t('reports.from')}</label>
            <input
              type="date"
              value={range.startDate}
              max={range.endDate}
              onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))}
              className="mt-1 rounded-lg border border-surface-500 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted">{t('reports.to')}</label>
            <input
              type="date"
              value={range.endDate}
              min={range.startDate}
              onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))}
              className="mt-1 rounded-lg border border-surface-500 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-cta-gradient px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {loading ? t('reports.generating') : t('reports.generate')}
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={downloading || !report}
            className="rounded-lg border border-surface-600 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {downloading ? t('reports.preparingCsv') : t('reports.downloadCsv')}
          </button>
        </form>

        {error && (
          <p className="mt-3 rounded-lg bg-danger/10 px-4 py-2 text-sm font-medium text-danger">{error}</p>
        )}

        {loading && !report && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-200" />
            ))}
          </div>
        )}

        {report && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox icon="sales" label={t('reports.stats.sales')} value={formatRupees(report.totals.sales)} />
              <StatBox icon="expenses" label={t('reports.stats.expenses')} value={formatRupees(report.totals.expenses)} />
              <StatBox icon="profit" label={t('reports.stats.netProfit')} value={formatRupees(report.totals.netProfit)} />
              <StatBox icon="count" label={t('reports.stats.totalEntries')} value={formatNumber(report.totals.entryCount)} />
            </div>

            <div className="mt-4 panel-card p-5">
              <h3 className="text-sm font-bold text-slate-800">{t('reports.chart.title')}</h3>
              <p className="mt-0.5 text-xs text-muted">{t('reports.chart.subtitle', 'How much came in vs. went out over this period.')}</p>

              {report.totals.sales === 0 && report.totals.expenses === 0 ? (
                <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-100 py-10 text-center">
                  <span className="text-2xl">📊</span>
                  <p className="text-sm font-semibold text-slate-700">{t('reports.chart.emptyTitle', 'Nothing to show yet')}</p>
                  <p className="max-w-xs text-xs text-muted">
                    {t('reports.chart.emptyBody', 'Add a few sales or expense entries and this chart will fill in automatically.')}
                  </p>
                </div>
              ) : (
                // Single, plain-language comparison: two proportional bars with a
                // share-of-total badge. (Previously this section also rendered a
                // second, unlabeled recharts bar chart underneath showing the exact
                // same two numbers again - same data twice with no extra clarity,
                // just visual clutter. Removed in favour of one clear read.)
                <div className="mt-4 space-y-3">
                  {[
                    {
                      label: t('reports.chart.salesLegend'),
                      value: report.totals.sales,
                      color: '#2563eb',
                      bg: 'from-primary/15 to-primary/5',
                      icon: <path d="M3 17l6-6 4 4 8-8M21 7v6M21 7h-6" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
                    },
                    {
                      label: t('reports.chart.expensesLegend'),
                      value: report.totals.expenses,
                      color: '#dc2626',
                      bg: 'from-danger/15 to-danger/5',
                      icon: <path d="M3 7l6 6 4-4 8 8M21 17v-6M21 17h-6" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
                    },
                  ].map((row) => {
                    const total = report.totals.sales + report.totals.expenses || 1;
                    const max = Math.max(report.totals.sales, report.totals.expenses, 1);
                    const widthPct = Math.max((row.value / max) * 100, 3);
                    const sharePct = Math.round((row.value / total) * 100);
                    return (
                      <div key={row.label} className={`rounded-xl bg-gradient-to-r ${row.bg} p-3.5`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-semibold text-slate-700">
                            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 flex-shrink-0">
                              {row.icon}
                            </svg>
                            {row.label}
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                              style={{ background: row.color }}
                            >
                              {sharePct}%
                            </span>
                          </span>
                          <span className="font-extrabold text-slate-900">{formatRupees(row.value)}</span>
                        </div>
                        <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-white/80 shadow-inner">
                          <div
                            className="h-full rounded-full shadow-sm transition-all duration-700"
                            style={{ width: `${widthPct}%`, background: `linear-gradient(90deg, ${row.color}cc, ${row.color})` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <CategoryBreakdownCard
                title={t('reports.categoryTable.salesTitle')}
                rows={report.categoryBreakdown.sales}
                barColor="#2563eb"
              />
              <CategoryBreakdownCard
                title={t('reports.categoryTable.expensesTitle')}
                rows={report.categoryBreakdown.expenses}
                barColor="#dc2626"
              />
            </div>
          </>
        )}

        {!loading && report && report.entries.length === 0 && (
          <p className="mt-6 rounded-xl border border-surface-500 bg-white p-8 text-center text-sm text-muted">
            {t('reports.noEntries')}
          </p>
        )}
      </main>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value }) {
  return (
    <div className="stat-card p-4">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-xl shadow-soft"
        style={{ background: STAT_GRADIENT[icon] }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          {STAT_ICONS[icon]}
        </svg>
      </span>
      <p className="mt-2.5 text-lg font-extrabold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

// Replaces the plain table with ranked rows + a proportional bar, so the
// "where did the money actually go" question reads at a glance instead
// of needing to compare numbers column by column.
function CategoryBreakdownCard({ title, rows, barColor }) {
  const { t } = useTranslation();
  const max = rows.reduce((m, r) => Math.max(m, r.amount), 0) || 1;

  return (
    <div className="panel-card p-5">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted">{t('reports.categoryTable.noData')}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((r) => (
            <div key={r.category}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium text-slate-700">{r.category}</span>
                <span className="whitespace-nowrap text-xs text-muted">
                  {r.count}
                  {t('reports.categoryTable.countSuffix')}
                </span>
                <span className="whitespace-nowrap font-semibold text-slate-900">{formatRupees(r.amount)}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-300">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(r.amount / max) * 100}%`, background: barColor }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}