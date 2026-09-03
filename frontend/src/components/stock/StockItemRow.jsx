import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

const STATUS_STYLES = {
  ok: 'bg-accent/10 text-accent-green',
  low: 'bg-warning/10 text-warning',
  out: 'bg-danger/10 text-danger',
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function MovementForm({ itemId, mode, onDone, onCancel }) {
  const { t } = useTranslation();
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const label = mode === 'restock' ? t('stock.row.movementForm.restockLabel') : t('stock.row.movementForm.usageLabel');
  const endpoint = mode === 'restock' ? 'restock' : 'usage';

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const qtyNum = Number(qty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError(t('stock.row.movementForm.qtyError'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { item } = await api.post(`/api/stock/${itemId}/${endpoint}`, { qty: qtyNum, note });
      onDone(item);
    } catch (err) {
      setError(err.message || t('stock.row.movementForm.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg bg-surface-50 p-3">
      <label className="text-xs font-medium text-muted">
        {t('stock.row.movementForm.qtyLabel')}
        <input
          type="number"
          min="0"
          step="0.01"
          autoFocus
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="mt-1 block w-24 rounded-lg border border-surface-500 px-2 py-1.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>
      <label className="text-xs font-medium text-muted">
        {t('stock.row.movementForm.noteLabel')}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 block w-44 rounded-lg border border-surface-500 px-2 py-1.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>
      {error && <p className="w-full text-xs font-medium text-danger">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? t('stock.row.movementForm.saving') : label}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-surface-500 px-4 py-1.5 text-xs font-semibold text-muted hover:text-slate-700"
      >
        {t('stock.row.movementForm.cancel')}
      </button>
    </form>
  );
}

export default function StockItemRow({ item, expanded, detail, detailLoading, onToggleExpand, onMovementDone, onDelete, deleting }) {
  const { t } = useTranslation();
  const [activeForm, setActiveForm] = useState(null); // null | 'restock' | 'usage'

  const STATUS_LABELS = {
    ok: t('stock.row.statusOk'),
    low: t('stock.row.statusLow'),
    out: t('stock.row.statusOut'),
  };

  function handleMovementDone(updatedItem) {
    setActiveForm(null);
    onMovementDone(updatedItem);
  }

  return (
    <>
      <tr className="border-b border-surface-200">
        <td className="py-2.5 font-medium text-slate-800">{item.name}</td>
        <td className="py-2.5 text-muted">{item.unit}</td>
        <td className="py-2.5 text-right text-slate-700">
          {item.currentQty} <span className="text-muted">{item.unit}</span>
        </td>
        <td className="py-2.5 text-right text-muted">{item.lowStockThreshold}</td>
        <td className="py-2.5 text-center">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[item.status]}`}>
            {STATUS_LABELS[item.status]}
          </span>
        </td>
        <td className="py-2.5 text-right">
          <div className="flex justify-end gap-1">
            <button
              onClick={() => onToggleExpand(item._id)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-100 hover:text-slate-700"
            >
              {expanded ? t('stock.row.hide') : t('stock.row.details')}
            </button>
            <button
              onClick={() => onDelete(item._id)}
              disabled={deleting}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
            >
              {deleting ? t('stock.row.deleting') : t('stock.row.delete')}
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-surface-200 bg-surface-50/60">
          <td colSpan={6} className="px-3 py-4">
            {detailLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-surface-300" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-surface-300" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted">{t('stock.row.lastRestocked')}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      {formatDate(detail?.lastRestockedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">{t('stock.row.nextRestockDue')}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      {detail?.nextDueDate ? formatDate(detail.nextDueDate) : t('stock.row.notEnoughHistory')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">{t('stock.row.avgDailyUsage')}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      {detail?.avgDailyUsage
                        ? t('stock.row.perDayUsage', { value: detail.avgDailyUsage, unit: item.unit })
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveForm(activeForm === 'restock' ? null : 'restock')}
                    className="rounded-lg bg-accent/10 px-4 py-1.5 text-xs font-semibold text-accent-green hover:bg-accent/20"
                  >
                    {t('stock.row.restockButton')}
                  </button>
                  <button
                    onClick={() => setActiveForm(activeForm === 'usage' ? null : 'usage')}
                    className="rounded-lg bg-danger/10 px-4 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20"
                  >
                    {t('stock.row.usageButton')}
                  </button>
                </div>

                {activeForm && (
                  <MovementForm
                    itemId={item._id}
                    mode={activeForm}
                    onDone={handleMovementDone}
                    onCancel={() => setActiveForm(null)}
                  />
                )}

                <div>
                  <p className="text-xs font-semibold text-slate-700">{t('stock.row.movementHistory')}</p>
                  {!detail?.movements || detail.movements.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">{t('stock.row.noMovements')}</p>
                  ) : (
                    <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-surface-500/60 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-surface-500 text-muted">
                            <th className="px-3 py-1.5 font-medium">{t('stock.row.colDate')}</th>
                            <th className="px-3 py-1.5 font-medium">{t('stock.row.colType')}</th>
                            <th className="px-3 py-1.5 text-right font-medium">{t('stock.row.colChange')}</th>
                            <th className="px-3 py-1.5 text-right font-medium">{t('stock.row.colResultingQty')}</th>
                            <th className="px-3 py-1.5 font-medium">{t('stock.row.colNote')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.movements.map((m) => (
                            <tr key={m._id} className="border-b border-surface-200 last:border-0">
                              <td className="px-3 py-1.5 text-muted">{formatDate(m.date)}</td>
                              <td className="px-3 py-1.5 capitalize text-slate-700">{m.type}</td>
                              <td
                                className={`px-3 py-1.5 text-right font-semibold ${
                                  m.changeQty >= 0 ? 'text-accent-green' : 'text-danger'
                                }`}
                              >
                                {m.changeQty >= 0 ? '+' : ''}
                                {m.changeQty}
                              </td>
                              <td className="px-3 py-1.5 text-right text-slate-700">{m.resultingQty}</td>
                              <td className="px-3 py-1.5 max-w-[160px] truncate text-muted">{m.note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}