import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isLoggedIn, getStoredUser, getStoredTenant } from '../lib/auth';
import { api } from '../lib/api';
import AppHeader from '../components/layout/AppHeader';
import AlertCard from '../components/alerts/AlertCard';
import AlertsBreakdown from '../components/alerts/AlertsBreakdown';

export default function Alerts() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = getStoredUser();
  const tenant = getStoredTenant();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) navigate('/auth', { replace: true });
  }, [navigate]);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/alerts');
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('alerts load failed:', err);
      setError(err.message || t('alerts.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    loadAlerts();
  }, [loadAlerts]);

  async function handleRunCheck() {
    setRunning(true);
    setRunMessage('');
    try {
      const data = await api.post('/api/alerts/run');
      setRunMessage(
        data.createdCount > 0
          ? t('alerts.runSuccess', { count: data.createdCount })
          : t('alerts.runNone')
      );
      loadAlerts();
    } catch (err) {
      console.error('run alert check failed:', err);
      setRunMessage(err.message || t('alerts.runError'));
    } finally {
      setRunning(false);
    }
  }

  // Optimistic - flips the dot immediately, syncs to the server in the
  // background so a slow network never makes the click feel unresponsive.
  async function handleMarkRead(id) {
    setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, isRead: true } : a)));
    try {
      await api.patch(`/api/alerts/${id}/read`);
    } catch (err) {
      console.error('mark alert read failed:', err);
    }
  }

  async function handleMarkAllRead() {
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    try {
      await api.patch('/api/alerts/read-all');
    } catch (err) {
      console.error('mark all alerts read failed:', err);
    }
  }

  if (!isLoggedIn()) return null;

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="min-h-screen app-shell-bg">
      <div className="shell-content lg:pl-64">
      <AppHeader shopName={tenant?.shopName} userName={user?.name} />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-800">{t('alerts.title')}</h2>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs font-semibold text-muted hover:text-primary">
                {t('alerts.markAllRead')}
              </button>
            )}
            <button
              onClick={handleRunCheck}
              disabled={running}
              className="rounded-lg bg-cta-gradient px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-60"
            >
              {running ? t('alerts.checking') : t('alerts.runCheck')}
            </button>
          </div>
        </div>

        <AlertsBreakdown alerts={alerts} loading={loading} />

        {runMessage && <p className="mt-3 text-sm text-muted">{runMessage}</p>}
        {error && (
          <p className="mt-3 rounded-lg bg-danger/10 px-4 py-2 text-sm font-medium text-danger">{error}</p>
        )}

        <div className="mt-6 space-y-3">
          {loading && <p className="text-sm text-muted">{t('alerts.loading')}</p>}

          {!loading && alerts.length === 0 && (
            <p className="rounded-xl border border-surface-500 bg-white p-6 text-center text-sm text-muted">
              {t('alerts.empty')}
            </p>
          )}

          {alerts.map((alert) => (
            <AlertCard key={alert._id} alert={alert} onMarkRead={handleMarkRead} />
          ))}
        </div>
      </main>
      </div>
    </div>
  );
}