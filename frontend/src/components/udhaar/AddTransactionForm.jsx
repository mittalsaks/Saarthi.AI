import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

const TODAY = () => new Date().toISOString().slice(0, 10);
const EMPTY = { type: 'credit', amount: '', note: '', date: TODAY() };

export default function AddTransactionForm({ customerId, onAdded }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const amountNum = Number(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError(t('udhaar.transactionForm.amountError'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { transaction, customer } = await api.post(`/api/udhaar/customers/${customerId}/transactions`, {
        type: form.type,
        amount: amountNum,
        note: form.note,
        date: form.date,
      });
      onAdded(transaction, customer);
      setForm(EMPTY);
    } catch (err) {
      setError(err.message || t('udhaar.transactionForm.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  const TYPE_LABELS = {
    credit: t('udhaar.transactionForm.creditTab'),
    payment: t('udhaar.transactionForm.paymentTab'),
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex rounded-lg border border-surface-500 bg-surface-50 p-1 sm:col-span-2">
        {['credit', 'payment'].map((txnType) => (
          <button
            key={txnType}
            type="button"
            onClick={() => update('type', txnType)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
              form.type === txnType ? 'bg-white text-primary shadow-sm' : 'text-muted'
            }`}
          >
            {TYPE_LABELS[txnType]}
          </button>
        ))}
      </div>

      <label className="text-xs font-medium text-muted">
        {t('udhaar.transactionForm.amountLabel')}
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.amount}
          onChange={(e) => update('amount', e.target.value)}
          className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          required
        />
      </label>

      <label className="text-xs font-medium text-muted">
        {t('udhaar.transactionForm.dateLabel')}
        <input
          type="date"
          value={form.date}
          onChange={(e) => update('date', e.target.value)}
          max={TODAY()}
          className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <label className="text-xs font-medium text-muted sm:col-span-2">
        {t('udhaar.transactionForm.noteLabel')}
        <input
          type="text"
          value={form.note}
          onChange={(e) => update('note', e.target.value)}
          placeholder={t('udhaar.transactionForm.optionalPlaceholder')}
          className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>

      {error && <p className="text-xs font-medium text-danger sm:col-span-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
      >
        {submitting ? t('udhaar.transactionForm.saving') : t('udhaar.transactionForm.saveButton')}
      </button>
    </form>
  );
}