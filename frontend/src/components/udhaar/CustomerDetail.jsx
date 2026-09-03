import { useTranslation } from 'react-i18next';
import { formatRupees } from '../../lib/format';
import AddTransactionForm from './AddTransactionForm';
import AiReminderPanel from './AiReminderPanel';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CustomerDetail({ customer, loading, onTransactionAdded }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="panel-card p-5">
        <div className="space-y-3">
          <div className="h-5 w-1/3 animate-pulse rounded bg-surface-200" />
          <div className="h-16 w-full animate-pulse rounded bg-surface-200" />
          <div className="h-10 w-full animate-pulse rounded bg-surface-200" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex h-full items-center justify-center panel-card p-5 text-center text-sm text-muted">
        {t('udhaar.detail.emptyState')}
      </div>
    );
  }

  const transactions = customer.transactions || [];

  return (
    <div className="space-y-4 panel-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">{customer.name}</h3>
          <p className="text-xs text-muted">
            {customer.phone || t('udhaar.detail.noPhone')}
            {customer.email ? ` · ${customer.email}` : ''}
          </p>
          {customer.note && <p className="mt-1 text-xs text-muted">{customer.note}</p>}
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold ${customer.balance > 0 ? 'text-danger' : 'text-accent-green'}`}>
            {formatRupees(customer.balance)}
          </p>
          <p className="text-xs text-muted">{t('udhaar.detail.balanceLabel')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-50 p-3 text-xs">
        <div>
          <p className="text-muted">{t('udhaar.detail.totalCredit')}</p>
          <p className="mt-0.5 font-semibold text-slate-800">{formatRupees(customer.totalCredit)}</p>
        </div>
        <div>
          <p className="text-muted">{t('udhaar.detail.totalPaid')}</p>
          <p className="mt-0.5 font-semibold text-slate-800">{formatRupees(customer.totalPaid)}</p>
        </div>
      </div>

      {customer.balance > 0 && (
        <AiReminderPanel customerId={customer._id} phone={customer.phone} email={customer.email} />
      )}

      <div>
        <p className="text-xs font-semibold text-slate-700">{t('udhaar.detail.addTransaction')}</p>
        <div className="mt-2">
          <AddTransactionForm customerId={customer._id} onAdded={onTransactionAdded} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700">{t('udhaar.detail.transactionHistory')}</p>
        {transactions.length === 0 ? (
          <p className="mt-2 text-xs text-muted">{t('udhaar.detail.noTransactions')}</p>
        ) : (
          <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-surface-500/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-500 text-muted">
                  <th className="px-3 py-1.5 font-medium">{t('udhaar.detail.colDate')}</th>
                  <th className="px-3 py-1.5 font-medium">{t('udhaar.detail.colType')}</th>
                  <th className="px-3 py-1.5 text-right font-medium">{t('udhaar.detail.colAmount')}</th>
                  <th className="px-3 py-1.5 font-medium">{t('udhaar.detail.colNote')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t2) => (
                  <tr key={t2._id} className="border-b border-surface-200 last:border-0">
                    <td className="px-3 py-1.5 text-muted">{formatDate(t2.date)}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          t2.type === 'credit' ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent-green'
                        }`}
                      >
                        {t2.type === 'credit' ? t('udhaar.detail.typeCredit') : t('udhaar.detail.typePayment')}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-semibold ${
                        t2.type === 'credit' ? 'text-danger' : 'text-accent-green'
                      }`}
                    >
                      {t2.type === 'credit' ? '+' : '-'}
                      {formatRupees(t2.amount)}
                    </td>
                    <td className="px-3 py-1.5 max-w-[160px] truncate text-muted">{t2.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}