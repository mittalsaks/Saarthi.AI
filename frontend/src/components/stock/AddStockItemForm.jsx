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
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted sm:col-span-2">
            {t('stock.addForm.nameLabel')}
            <div className="field-shell mt-1">
              <span className="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder={t('stock.addForm.namePlaceholder')}
                className="field-input"
                required
              />
            </div>
          </label>

          <label className="text-xs font-semibold text-muted">
            {t('stock.addForm.unitLabel')}
            <div className="field-shell mt-1">
              <span className="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 8V6a2 2 0 00-2-2H5a2 2 0 00-2 2v2M3 8h18M3 8v10a2 2 0 002 2h14a2 2 0 002-2V8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => update('unit', e.target.value)}
                placeholder={t('stock.addForm.unitPlaceholder')}
                className="field-input"
              />
            </div>
          </label>

          <label className="text-xs font-semibold text-muted">
            {t('stock.addForm.qtyLabel')}
            <div className="field-shell mt-1">
              <span className="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 13h6M9 17h6M9 9h1M14 3v4a1 1 0 001 1h4M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.currentQty}
                onChange={(e) => update('currentQty', e.target.value)}
                placeholder={t('stock.addForm.qtyPlaceholder')}
                className="field-input"
              />
            </div>
          </label>

          <label className="text-xs font-semibold text-muted sm:col-span-2">
            {t('stock.addForm.thresholdLabel')}
            <div className="field-shell mt-1">
              <span className="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.lowStockThreshold}
                onChange={(e) => update('lowStockThreshold', e.target.value)}
                placeholder={t('stock.addForm.thresholdPlaceholder')}
                className="field-input"
              />
            </div>
          </label>

          {error && <p className="text-xs font-medium text-danger sm:col-span-2">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-cta-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
          >
            {submitting ? t('stock.addForm.saving') : t('stock.addForm.saveButton')}
          </button>
        </form>
      )}
    </div>
  );
}