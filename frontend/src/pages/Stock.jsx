import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isLoggedIn, getStoredUser, getStoredTenant } from '../lib/auth';
import { api } from '../lib/api';
import AppHeader from '../components/layout/AppHeader';
import LowStockBanner from '../components/stock/LowStockBanner';
import AddStockItemForm from '../components/stock/AddStockItemForm';
import StockTable from '../components/stock/StockTable';
import StockLevelsChart from '../components/stock/StockLevelsChart';

export default function Stock() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = getStoredUser();
  const tenant = getStoredTenant();

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState('');

  const [alertSummary, setAlertSummary] = useState(null);
  const [alertLoading, setAlertLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [expandedDetails, setExpandedDetails] = useState({});
  const [detailLoadingId, setDetailLoadingId] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) navigate('/auth', { replace: true });
  }, [navigate]);

  // Fast, DB-only list - never waits on the AI alert banner below.
  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError('');
    try {
      const data = await api.get('/api/stock');
      setItems(data.items || []);
    } catch (err) {
      console.error('stock list load failed:', err);
      setItemsError(err.message || t('stock.loadError'));
    } finally {
      setItemsLoading(false);
    }
  }, [t]);

  // AI-backed, deliberately separate so a slow/failed Gemini call never
  // blocks the items table from rendering.
  const loadAlerts = useCallback(async () => {
    setAlertLoading(true);
    try {
      const data = await api.get('/api/stock/alerts/low-stock');
      setAlertSummary(data);
    } catch (err) {
      console.error('low stock alert load failed:', err);
    } finally {
      setAlertLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) return;
    loadItems();
    loadAlerts();
  }, [loadItems, loadAlerts]);

  function handleItemAdded(item) {
    setItems((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
    setAddOpen(false);
    loadAlerts();
  }

  async function handleToggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!expandedDetails[id]) {
      setDetailLoadingId(id);
      try {
        const { item } = await api.get(`/api/stock/${id}`);
        setExpandedDetails((prev) => ({ ...prev, [id]: item }));
      } catch (err) {
        console.error('item detail load failed:', err);
      } finally {
        setDetailLoadingId(null);
      }
    }
  }

  function applyItemUpdate(updatedItem) {
    setItems((prev) => prev.map((i) => (i._id === updatedItem._id ? { ...i, ...updatedItem } : i)));
    setExpandedDetails((prev) => ({ ...prev, [updatedItem._id]: updatedItem }));
    loadAlerts();
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await api.delete(`/api/stock/${id}`);
      setItems((prev) => prev.filter((i) => i._id !== id));
      setExpandedDetails((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (expandedId === id) setExpandedId(null);
      loadAlerts();
    } catch (err) {
      console.error('delete stock item failed:', err);
    } finally {
      setDeletingId(null);
    }
  }

  if (!isLoggedIn()) return null;

  return (
    <div className="min-h-screen app-shell-bg">
      <div className="shell-content lg:pl-64">
      <AppHeader shopName={tenant?.shopName} userName={user?.name} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <LowStockBanner summary={alertSummary} loading={alertLoading} />

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{t('stock.title')}</h2>
        </div>

        {itemsError && (
          <p className="mt-3 rounded-lg bg-danger/10 px-4 py-2 text-sm font-medium text-danger">{itemsError}</p>
        )}

        <div className="mt-4">
          <AddStockItemForm open={addOpen} onToggle={() => setAddOpen((o) => !o)} onAdded={handleItemAdded} />
        </div>

        <div className="mt-6">
          <StockLevelsChart items={items} loading={itemsLoading} />
        </div>

        <div className="mt-6">
          <StockTable
            items={items}
            loading={itemsLoading}
            expandedId={expandedId}
            expandedDetails={expandedDetails}
            detailLoading={detailLoadingId}
            onToggleExpand={handleToggleExpand}
            onMovementDone={applyItemUpdate}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        </div>
      </main>
      </div>
    </div>
  );
}