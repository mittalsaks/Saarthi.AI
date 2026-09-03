import { useTranslation } from 'react-i18next';

function formatRupees(n) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function EntriesTable({ entries, loading, deletingId, onDelete }) {
  const { t } = useTranslation();
  return (
    <div className="panel-card p-5">
      <h3 className="text-sm font-semibold text-slate-800">{t('dashboard.entriesTable.title')}</h3>

      {loading ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-200" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-6 py-6 text-center text-sm text-muted">{t('dashboard.entriesTable.empty')}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-surface-500 text-xs text-muted">
                <th className="py-2 font-medium">{t('dashboard.entriesTable.colDate')}</th>
                <th className="py-2 font-medium">{t('dashboard.entriesTable.colType')}</th>
                <th className="py-2 font-medium">{t('dashboard.entriesTable.colCategory')}</th>
                <th className="py-2 font-medium">{t('dashboard.entriesTable.colDescription')}</th>
                <th className="py-2 text-right font-medium">{t('dashboard.entriesTable.colAmount')}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry._id} className="border-b border-surface-200 last:border-0">
                  <td className="py-2.5 text-muted">{formatDate(entry.date)}</td>
                  <td className="py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        entry.type === 'sale' ? 'bg-accent/10 text-accent-green' : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {entry.type === 'sale' ? t('dashboard.entriesTable.typeSale') : t('dashboard.entriesTable.typeExpense')}
                    </span>
                  </td>
                  <td className="py-2.5 text-muted">{entry.category}</td>
                  <td className="py-2.5 max-w-[220px] truncate text-slate-700">{entry.description || '—'}</td>
                  <td
                    className={`py-2.5 text-right font-semibold ${
                      entry.type === 'sale' ? 'text-accent-green' : 'text-danger'
                    }`}
                  >
                    {entry.type === 'sale' ? '+' : '-'}
                    {formatRupees(entry.amount)}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => onDelete(entry._id)}
                      disabled={deletingId === entry._id}
                      className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                    >
                      {deletingId === entry._id ? t('dashboard.entriesTable.deleting') : t('dashboard.entriesTable.deleteLabel')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
