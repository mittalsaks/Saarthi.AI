import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

const TODAY = () => {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
};

const EMPTY = { type: 'sale', amount: '', category: '', description: '', date: TODAY() };

export default function ManualEntryForm({ open, onToggle, onAdded, initialDescription = '' }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState({ sale: [], expense: [] });

  useEffect(() => {
    if (initialDescription) {
      setForm((f) => ({ ...f, description: initialDescription }));
    }
  }, [initialDescription]);

  // Load this shop's already-used categories once, so the category field
  // can suggest them (split by sale/expense). Typing something new is
  // still fine - the datalist only suggests, it never restricts input.
  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/entries/categories')
      .then((data) => {
        if (!cancelled) setCategories({ sale: data.sale || [], expense: data.expense || [] });
      })
      .catch(() => {
        // Suggestions are a nice-to-have; a failed fetch shouldn't block
        // the form from working as plain free text.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categorySuggestions = categories[form.type] || [];

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const amountNum = Number(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError(t('dashboard.manualEntry.amountError'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { entry } = await api.post('/api/entries', {
        type: form.type,
        amount: amountNum,
        category: form.category || 'general',
        description: form.description,
        date: form.date,
      });
      onAdded(entry);
      setForm(EMPTY);
    } catch (err) {
      setError(err.message || t('dashboard.manualEntry.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel-card p-5">
      <button
        type="button"
        onClick={onToggle}
        className="toggle-bar text-left text-sm font-bold text-slate-800"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-500/60 text-slate-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M9 3v18M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
            </svg>
          </span>
          {t('dashboard.manualEntry.toggleLabel')}
        </span>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs text-primary shadow-soft transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex rounded-lg border border-surface-500 bg-surface-50 p-1 sm:col-span-2">
            {['sale', 'expense'].map((entryType) => (
              <button
                key={entryType}
                type="button"
                onClick={() => update('type', entryType)}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                  form.type === entryType ? 'bg-white text-primary' : 'text-muted'
                }`}
              >
                {entryType === 'sale' ? t('dashboard.manualEntry.typeSale') : t('dashboard.manualEntry.typeExpense')}
              </button>
            ))}
          </div>

          <label className="text-xs font-medium text-muted">
            {t('dashboard.manualEntry.amountLabel')}
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
            {t('dashboard.manualEntry.categoryLabel')}
            <input
              type="text"
              list="category-suggestions"
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              placeholder={t('dashboard.manualEntry.categoryPlaceholder')}
              className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <datalist id="category-suggestions">
              {categorySuggestions.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </label>

          <label className="text-xs font-medium text-muted sm:col-span-2">
            {t('dashboard.manualEntry.descriptionLabel')}
            <input
              type="text"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="text-xs font-medium text-muted">
            {t('dashboard.manualEntry.dateLabel')}
            <input
              type="date"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              max={TODAY()}
              className="mt-1 w-full rounded-lg border border-surface-500 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          {error && <p className="text-xs font-medium text-danger sm:col-span-2">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
          >
            {submitting ? t('dashboard.manualEntry.saving') : t('dashboard.manualEntry.saveButton')}
          </button>
        </form>
      )}
    </div>
  );
}