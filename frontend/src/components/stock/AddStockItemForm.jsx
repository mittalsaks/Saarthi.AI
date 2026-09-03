import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

const EMPTY = { name: '', unit: 'pcs', currentQty: '', lowStockThreshold: '' };

export default function AddStockItemForm({ open, onToggle, onAdded }) {
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

    if (!form.name.trim()) {
      setError(t('stock.addForm.nameRequired'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { item } = await api.post('/api/stock', {
        name: form.name,
        unit: form.unit || 'pcs',
        currentQty: form.currentQty === '' ? 0 : Number(form.currentQty),
        lowStockThreshold: form.lowStockThreshold === '' ? 5 : Number(form.lowStockThreshold),
      });
      onAdded(item);
      setForm(EMPTY);
    } catch (err) {
      setError(err.message || t('stock.addForm.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="entry-well p-5">
      <button
        type="button"
        onClick={onToggle}
        className="toggle-bar text-left text-sm font-bold text-slate-800"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cta-gradient text-white shadow-soft">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </span>
          {t('stock.addForm.toggle')}
        </span>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs text-primary shadow-soft transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {!open && (
        <p className="mt-2 pl-1 text-xs text-muted">{t('stock.addForm.namePlaceholder')}</p>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted sm:col-span-2">
            {t('stock.addForm.nameLabel')}
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder={t('stock.addForm.namePlaceholder')}
              className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </label>

          <label className="text-xs font-medium text-muted">
            {t('stock.addForm.unitLabel')}
            <input
              type="text"
              value={form.unit}
              onChange={(e) => update('unit', e.target.value)}
              placeholder={t('stock.addForm.unitPlaceholder')}
              className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="text-xs font-medium text-muted">
            {t('stock.addForm.qtyLabel')}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.currentQty}
              onChange={(e) => update('currentQty', e.target.value)}
              placeholder={t('stock.addForm.qtyPlaceholder')}
              className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="text-xs font-medium text-muted sm:col-span-2">
            {t('stock.addForm.thresholdLabel')}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.lowStockThreshold}
              onChange={(e) => update('lowStockThreshold', e.target.value)}
              placeholder={t('stock.addForm.thresholdPlaceholder')}
              className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          {error && <p className="text-xs font-medium text-danger sm:col-span-2">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
          >
            {submitting ? t('stock.addForm.saving') : t('stock.addForm.saveButton')}
          </button>
        </form>
      )}
    </div>
  );
}