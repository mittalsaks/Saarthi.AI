import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isLoggedIn, getStoredUser, getStoredTenant } from '../lib/auth';
import { api } from '../lib/api';
import { formatRupees } from '../lib/format';
import AppHeader from '../components/layout/AppHeader';
import AddCustomerForm from '../components/udhaar/AddCustomerForm';
import CustomerList from '../components/udhaar/CustomerList';
import CustomerDetail from '../components/udhaar/CustomerDetail';
import TopDebtorsChart from '../components/udhaar/TopDebtorsChart';

export default function Udhaar() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = getStoredUser();
  const tenant = getStoredTenant();

  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState('');

  const [summary, setSummary] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) navigate('/auth', { replace: true });
  }, [navigate]);

  // Already sorted highest-balance-first by the backend.
  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    setCustomersError('');
    try {
      const data = await api.get('/api/udhaar/customers');
      setCustomers(data.customers || []);
    } catch (err) {
      console.error('customers load failed:', err);
      setCustomersError(err.message || t('udhaar.customersLoadError'));
    } finally {
      setCustomersLoading(false);
    }
  }, [t]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api.get('/api/udhaar/summary');
      setSummary(data);
    } catch (err) {
      console.error('udhaar summary load failed:', err);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) return;
    loadCustomers();
    loadSummary();
  }, [loadCustomers, loadSummary]);

  const loadCustomerDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const { customer } = await api.get(`/api/udhaar/customers/${id}`);
      setSelectedCustomer(customer);
    } catch (err) {
      console.error('customer detail load failed:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function handleSelect(id) {
    setSelectedId(id);
    loadCustomerDetail(id);
  }

  function handleCustomerAdded(customer) {
    setCustomers((prev) => [...prev, customer].sort((a, b) => b.balance - a.balance));
    setAddOpen(false);
    loadSummary();
  }

  function handleTransactionAdded(transaction, updatedCustomer) {
    setSelectedCustomer((prev) => ({ ...prev, ...updatedCustomer, transactions: [transaction, ...(prev?.transactions || [])] }));
    setCustomers((prev) =>
      prev.map((c) => (c._id === updatedCustomer._id ? { ...c, ...updatedCustomer } : c)).sort((a, b) => b.balance - a.balance)
    );
    loadSummary();
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await api.delete(`/api/udhaar/customers/${id}`);
      setCustomers((prev) => prev.filter((c) => c._id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedCustomer(null);
      }
      loadSummary();
    } catch (err) {
      console.error('delete customer failed:', err);
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
        <div className="rounded-2xl bg-cta-gradient p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-white/80">{t('udhaar.eyebrow')}</p>
          <p className="mt-2 text-lg font-semibold leading-snug">
            {summary
              ? t('udhaar.heroSummary', {
                  count: summary.customersOwingCount,
                  amount: formatRupees(summary.totalOutstanding),
                })
              : t('udhaar.heroDefault')}
          </p>
        </div>

        {customersError && (
          <p className="mt-3 rounded-lg bg-danger/10 px-4 py-2 text-sm font-medium text-danger">{customersError}</p>
        )}

        <div className="mt-4">
          <AddCustomerForm open={addOpen} onToggle={() => setAddOpen((o) => !o)} onAdded={handleCustomerAdded} />
        </div>

        <div className="mt-6">
          <TopDebtorsChart customers={customers} loading={customersLoading} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CustomerList
            customers={customers}
            loading={customersLoading}
            selectedId={selectedId}
            onSelect={handleSelect}
            deletingId={deletingId}
            onDelete={handleDelete}
          />
          <CustomerDetail
            customer={selectedCustomer}
            loading={detailLoading}
            onTransactionAdded={handleTransactionAdded}
          />
        </div>
      </main>
      </div>
    </div>
  );
}