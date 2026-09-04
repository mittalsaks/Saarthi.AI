import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isLoggedIn, getStoredUser, getStoredTenant } from '../lib/auth';
import { api } from '../lib/api';
import AppHeader from '../components/layout/AppHeader';
import RangeSelector from '../components/analytics/RangeSelector';
import AnalyticsStatCard from '../components/analytics/AnalyticsStatCard';
import AISummaryBanner from '../components/analytics/AISummaryBanner';
import SalesExpensesChart from '../components/analytics/SalesExpensesChart';
import CategoryBreakdown from '../components/analytics/CategoryBreakdown';
import ExplainNumberModal from '../components/analytics/ExplainNumberModal';

// Card config drives both the grid render and what gets sent to the
// explain-number endpoint - single source of truth so the popup always
// asks about exactly the metric the user tapped. Labels are i18n keys
// (resolved with t() at render time) rather than plain strings since
// this config lives outside the component and can't call the hook.
const METRIC_CARDS = [
  { key: 'sales', labelKey: 'analytics.cards.sales', format: 'currency', accent: 'primary', changeKey: 'salesPct' },
  { key: 'expenses', labelKey: 'analytics.cards.expenses', format: 'currency', accent: 'danger', changeKey: 'expensesPct', invert: true },
  { key: 'netProfit', labelKey: 'analytics.cards.netProfit', format: 'currency', accent: 'accent', changeKey: 'netProfitPct' },
  {
    key: 'profitMarginPct',
    labelKey: 'analytics.cards.profitMarginPct',
    format: 'percent',
    accent: 'navy',
    changeKey: 'profitMarginPtsChange',
    isPoints: true,
  },
  { key: 'customersServed', labelKey: 'analytics.cards.customersServed', format: 'number', accent: 'primary', changeKey: 'customersServedPct' },
  { key: 'avgSaleValue', labelKey: 'analytics.cards.avgSaleValue', format: 'currency', accent: 'accent', changeKey: 'avgSaleValuePct' },
];

export default function Analytics() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = getStoredUser();
  const tenant = getStoredTenant();

  const [range, setRange] = useState('30d');

  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');

  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryRefreshing, setSummaryRefreshing] = useState(false);
  const [summaryAiUnavailable, setSummaryAiUnavailable] = useState(false);

  const [activeMetric, setActiveMetric] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) navigate('/auth', { replace: true });
  }, [navigate]);

  // Fast, DB-only - charts and stat cards must never wait on the AI call below.
  const loadOverview = useCallback(async (r) => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      const data = await api.get(`/api/analytics/overview?range=${r}`);
      setOverview(data);
    } catch (err) {
      console.error('overview load failed:', err);
      setOverviewError(err.message || t('analytics.loadError'));
    } finally {
      setOverviewLoading(false);
    }
  }, [t]);

  // AI-backed, deliberately separate from loadOverview so a slow/failed
  // Gemini call never blocks the numbers/charts above.
  const loadSummary = useCallback(async (r, refresh = false) => {
    refresh ? setSummaryRefreshing(true) : setSummaryLoading(true);
    try {
      const data = await api.get(`/api/analytics/summary?range=${r}${refresh ? '&refresh=true' : ''}`);
      setSummary(data.message);
      setSummaryAiUnavailable(Boolean(data.aiUnavailable));
    } catch (err) {
      console.error('summary load failed:', err);
      setSummary(t('analytics.summaryFallback'));
      setSummaryAiUnavailable(true);
    } finally {
      refresh ? setSummaryRefreshing(false) : setSummaryLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    loadOverview(range);
    loadSummary(range);
  }, [range, loadOverview, loadSummary]);

  if (!isLoggedIn()) return null;

  const totals = overview?.totals;
  const change = overview?.change;
  const activeCard = METRIC_CARDS.find((c) => c.key === activeMetric);

  return (
    <div className="min-h-screen app-shell-bg">
      <div className="shell-content lg:pl-64">
      <AppHeader shopName={tenant?.shopName} userName={user?.name} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <AISummaryBanner
          message={summary}
          loading={summaryLoading}
          aiUnavailable={summaryAiUnavailable}
          refreshing={summaryRefreshing}
          onRefresh={() => loadSummary(range, true)}
        />

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{t('analytics.title')}</h2>
          <RangeSelector value={range} onChange={setRange} />
        </div>

        {overviewError && (
          <p className="mt-3 rounded-lg bg-danger/10 px-4 py-2 text-sm font-medium text-danger">{overviewError}</p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {METRIC_CARDS.map((card) => (
            <AnalyticsStatCard
              key={card.key}
              metricKey={card.key}
              label={t(card.labelKey)}
              value={totals?.[card.key] ?? 0}
              pct={change?.[card.changeKey]}
              invert={card.invert}
              isPoints={card.isPoints}
              format={card.format}
              accent={card.accent}
              loading={overviewLoading}
              onClick={() => setActiveMetric(card.key)}
            />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SalesExpensesChart series={overview?.series} loading={overviewLoading} />
          </div>
          <CategoryBreakdown
            topSaleCategories={overview?.topSaleCategories || []}
            topExpenseCategories={overview?.topExpenseCategories || []}
            loading={overviewLoading}
          />
        </div>
      </main>
      </div>

      <ExplainNumberModal
        open={Boolean(activeMetric)}
        metric={activeMetric}
        label={activeCard ? t(activeCard.labelKey) : ''}
        range={range}
        onClose={() => setActiveMetric(null)}
      />
    </div>
  );
}