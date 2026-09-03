import { useTranslation } from 'react-i18next';
import { formatRupees } from '../../lib/format';

export default function CustomerList({ customers, loading, selectedId, onSelect, deletingId, onDelete }) {
  const { t } = useTranslation();

  return (
    <div className="panel-card p-5">
      <h3 className="text-sm font-semibold text-slate-800">{t('udhaar.list.title')}</h3>
      {!loading && customers.length > 0 && (
        <p className="mt-1 text-xs text-muted">Tap a customer to view their full details on the right.</p>
      )}

      {loading ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-200" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <p className="mt-6 py-6 text-center text-sm text-muted">
          {t('udhaar.list.empty')}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {customers.map((c) => {
            const isSelected = selectedId === c._id;
            return (
              <li key={c._id}>
                <button
                  onClick={() => onSelect(c._id)}
                  className={`group flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-3 text-left transition ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-surface-500/60 hover:border-primary/40 hover:bg-surface-50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{c.name}</p>
                    <p className="text-xs text-muted">{c.phone || t('udhaar.list.noPhone')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${c.balance > 0 ? 'text-danger' : 'text-accent-green'}`}>
                        {formatRupees(c.balance)}
                      </p>
                      <p className="text-xs text-muted">{t('udhaar.list.balanceLabel')}</p>
                    </div>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={`h-4 w-4 shrink-0 transition ${
                        isSelected ? 'text-primary' : 'text-muted-light group-hover:text-primary'
                      }`}
                    >
                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>
                <div className="flex justify-end px-1 pt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c._id);
                    }}
                    disabled={deletingId === c._id}
                    className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                  >
                    {deletingId === c._id ? t('udhaar.list.deleting') : t('udhaar.list.delete')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}