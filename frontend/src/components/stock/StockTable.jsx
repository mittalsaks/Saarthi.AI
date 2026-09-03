import { useTranslation } from 'react-i18next';
import StockItemRow from './StockItemRow';

export default function StockTable({
  items,
  loading,
  expandedId,
  expandedDetails,
  detailLoading,
  onToggleExpand,
  onMovementDone,
  onDelete,
  deletingId,
}) {
  const { t } = useTranslation();

  return (
    <div className="panel-card p-5">
      <h3 className="text-sm font-semibold text-slate-800">{t('stock.table.title')}</h3>

      {loading ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-200" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-6 py-6 text-center text-sm text-muted">{t('stock.table.empty')}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-surface-500 text-xs text-muted">
                <th className="py-2 font-medium">{t('stock.table.colItem')}</th>
                <th className="py-2 font-medium">{t('stock.table.colUnit')}</th>
                <th className="py-2 text-right font-medium">{t('stock.table.colQty')}</th>
                <th className="py-2 text-right font-medium">{t('stock.table.colThreshold')}</th>
                <th className="py-2 text-center font-medium">{t('stock.table.colStatus')}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <StockItemRow
                  key={item._id}
                  item={item}
                  expanded={expandedId === item._id}
                  detail={expandedDetails[item._id]}
                  detailLoading={detailLoading === item._id}
                  onToggleExpand={onToggleExpand}
                  onMovementDone={onMovementDone}
                  onDelete={onDelete}
                  deleting={deletingId === item._id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}