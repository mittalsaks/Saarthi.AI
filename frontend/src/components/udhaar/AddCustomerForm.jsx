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
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted">
            {t('udhaar.addForm.nameLabel')}
            <div className="field-shell mt-1">
              <span className="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="field-input"
                required
              />
            </div>
          </label>

          <label className="text-xs font-semibold text-muted">
            {t('udhaar.addForm.phoneLabel')}
            <div className="field-shell mt-1">
              <span className="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder={t('udhaar.addForm.phonePlaceholder')}
                className="field-input"
              />
            </div>
          </label>

          <label className="text-xs font-semibold text-muted">
            {t('udhaar.addForm.emailLabel')}
            <div className="field-shell mt-1">
              <span className="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M22 6l-10 7L2 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder={t('udhaar.addForm.optionalPlaceholder')}
                className="field-input"
              />
            </div>
          </label>

          <label className="text-xs font-semibold text-muted sm:col-span-2">
            {t('udhaar.addForm.noteLabel')}
            <div className="field-shell mt-1">
              <span className="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input
                type="text"
                value={form.note}
                onChange={(e) => update('note', e.target.value)}
                placeholder={t('udhaar.addForm.optionalPlaceholder')}
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
            {submitting ? t('udhaar.addForm.saving') : t('udhaar.addForm.saveButton')}
          </button>
        </form>
      )}
    </div>
  );
}