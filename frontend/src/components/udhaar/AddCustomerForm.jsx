import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

const EMPTY = { name: '', phone: '', email: '', note: '' };

export default function AddCustomerForm({ open, onToggle, onAdded }) {
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
      setError(t('udhaar.addForm.nameRequired'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { customer } = await api.post('/api/udhaar/customers', form);
      onAdded(customer);
      setForm(EMPTY);
    } catch (err) {
      setError(err.message || t('udhaar.addForm.saveError'));
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
          {t('udhaar.addForm.toggle')}
        </span>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs text-primary shadow-soft transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted">
            {t('udhaar.addForm.nameLabel')}
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </label>

          <label className="text-xs font-medium text-muted">
            {t('udhaar.addForm.phoneLabel')}
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder={t('udhaar.addForm.phonePlaceholder')}
              className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="text-xs font-medium text-muted">
            {t('udhaar.addForm.emailLabel')}
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder={t('udhaar.addForm.optionalPlaceholder')}
              className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="text-xs font-medium text-muted sm:col-span-2">
            {t('udhaar.addForm.noteLabel')}
            <input
              type="text"
              value={form.note}
              onChange={(e) => update('note', e.target.value)}
              placeholder={t('udhaar.addForm.optionalPlaceholder')}
              className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          {error && <p className="text-xs font-medium text-danger sm:col-span-2">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
          >
            {submitting ? t('udhaar.addForm.saving') : t('udhaar.addForm.saveButton')}
          </button>
        </form>
      )}
    </div>
  );
}