import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isLoggedIn, getStoredUser, getStoredTenant } from '../lib/auth';
import { api } from '../lib/api';
import AppHeader from '../components/layout/AppHeader';
import GreetingBanner from '../components/dashboard/GreetingBanner';
import ProfitGauge from '../components/dashboard/ProfitGauge';
import StatCard from '../components/dashboard/StatCard';
import QuickAdd from '../components/dashboard/QuickAdd';
import ManualEntryForm from '../components/dashboard/ManualEntryForm';
import EntriesTable from '../components/dashboard/EntriesTable';
import { useTranslation } from 'react-i18next';

const PERIOD_KEYS = [
  { key: 'today', labelKey: 'dashboard.period.today' },
  { key: 'week', labelKey: 'dashboard.period.week' },
  { key: 'month', labelKey: 'dashboard.period.month' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = getStoredUser();
  const tenant = getStoredTenant();

  const [period, setPeriod] = useState('today');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [greeting, setGreeting] = useState('');
  const [greetingLoading, setGreetingLoading] = useState(true);
  const [greetingError, setGreetingError] = useState(false);

  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualPrefill, setManualPrefill] = useState('');
  const quickAddRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn()) navigate('/auth', { replace: true });
  }, [navigate]);

  // Topbar's "+ Nayi Entry" button fires a plain window event instead of
  // relying on the URL hash - a hash-based approach only reopens on a
  // real hash *change*, so a second click while already on
  // /dashboard#quick-add (e.g. after the form auto-closed post-save)
  // silently did nothing since the hash string never changed.
  useEffect(() => {
    function handleOpenQuickAdd() {
      setManualOpen(true);
      quickAddRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.addEventListener('saarthi:open-quick-add', handleOpenQuickAdd);
    return () => window.removeEventListener('saarthi:open-quick-add', handleOpenQuickAdd);
  }, []);

  const loadStats = useCallback(async (p) => {
    setStatsLoading(true);
    try {
      const data = await api.get(`/api/entries/stats?period=${p}`);
      setStats(data);
    } catch (err) {
      console.error('stats load failed:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const data = await api.get('/api/entries?limit=15');
      setEntries(data.entries || []);
    } catch (err) {
      console.error('entries load failed:', err);
    } finally {
      setEntriesLoading(false);
    }
  }, []);

  const loadGreeting = useCallback(async () => {
    setGreetingLoading(true);
    setGreetingError(false);
    try {
      const data = await api.get('/api/entries/greeting');
      setGreeting(data.message);
    } catch (err) {
      console.error('greeting load failed:', err);
      setGreetingError(true);
    } finally {
      setGreetingLoading(false);
    }
  }, []);

  // Stats + entries are fast DB-only calls, load together. Greeting is
  // AI-backed and fetched independently so a slow/failed AI call never
  // blocks the numbers the owner actually needs first.
  useEffect(() => {
    if (!isLoggedIn()) return;
    loadEntries();
    loadGreeting();
  }, [loadEntries, loadGreeting]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    loadStats(period);
  }, [period, loadStats]);

  function handleEntryAdded() {
    loadStats(period);
    loadEntries();
    setManualOpen(false);
    setManualPrefill('');
  }

  function handleFallbackToManual(text) {
    setManualPrefill(text);
    setManualOpen(true);
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await api.delete(`/api/entries/${id}`);
      setEntries((prev) => prev.filter((e) => e._id !== id));
      loadStats(period);
    } catch (err) {
      console.error('delete failed:', err);
    } finally {
      setDeletingId(null);
    }
  }

  if (!isLoggedIn()) return null;

  return (
    <div className="min-h-screen app-shell-bg lg:pl-64">
      <AppHeader shopName={tenant?.shopName} userName={user?.name} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <GreetingBanner
          shopName={tenant?.shopName}
          ownerName={user?.name}
          message={greeting}
          loading={greetingLoading}
          error={greetingError}
        />

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{t('dashboard.title')}</h2>
          <div className="flex rounded-lg border border-surface-500 bg-white p-1">
            {PERIOD_KEYS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  period === p.key ? 'bg-primary text-white' : 'text-muted hover:text-slate-700'
                }`}
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ProfitGauge
            sales={stats?.sales ?? 0}
            expenses={stats?.expenses ?? 0}
            netProfit={stats?.netProfit ?? 0}
            loading={statsLoading}
          />

          <div className="grid grid-cols-2 gap-4 lg:col-span-2">
            <StatCard
              label={t('dashboard.stat.sale')}
              value={stats?.sales ?? 0}
              pct={stats?.change?.salesPct}
              loading={statsLoading}
              accent="primary"
              to="/analytics"
            />
            <StatCard
              label={t('dashboard.stat.expense')}
              value={stats?.expenses ?? 0}
              pct={stats?.change?.expensesPct}
              invert
              loading={statsLoading}
              accent="danger"
              to="/analytics"
            />
            <StatCard
              label={t('dashboard.stat.netProfit')}
              value={stats?.netProfit ?? 0}
              pct={stats?.change?.profitPct}
              loading={statsLoading}
              accent="accent"
              to="/analytics"
            />
            <StatCard
              label={t('dashboard.stat.entries')}
              value={stats?.entryCount ?? 0}
              pct={null}
              loading={statsLoading}
              accent="navy"
              format="number"
              to="/reports"
            />
          </div>
        </div>

        <div id="quick-add" ref={quickAddRef} className="mt-8 grid scroll-mt-24 grid-cols-1 gap-4 lg:grid-cols-2">
          <QuickAdd onAdded={handleEntryAdded} onFallbackToManual={handleFallbackToManual} />
          <ManualEntryForm
            open={manualOpen}
            onToggle={() => setManualOpen((o) => !o)}
            onAdded={handleEntryAdded}
            initialDescription={manualPrefill}
          />
        </div>

        <div className="mt-6">
          <EntriesTable
            entries={entries}
            loading={entriesLoading}
            deletingId={deletingId}
            onDelete={handleDelete}
          />
        </div>
      </main>
    </div>
  );
}