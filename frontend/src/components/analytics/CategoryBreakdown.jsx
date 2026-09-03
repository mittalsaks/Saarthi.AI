import { useTranslation } from 'react-i18next';
import { formatRupees } from '../../lib/format';

function CategoryList({ title, categories, barColorClass, noDataText }) {
  const max = categories.length ? Math.max(...categories.map((c) => c.amount)) : 0;

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      {!categories.length ? (
        <p className="mt-2 text-sm text-muted">{noDataText}</p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {categories.map((c) => (
            <li key={c.category}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium capitalize text-slate-700">{c.category}</span>
                <span className="font-semibold text-slate-800">{formatRupees(c.amount)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-surface-200">
                <div
                  className={`h-1.5 rounded-full ${barColorClass}`}
                  style={{ width: max > 0 ? `${Math.max((c.amount / max) * 100, 4)}%` : '0%' }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CategoryBreakdown({ topSaleCategories, topExpenseCategories, loading }) {
  const { t } = useTranslation();

  return (
    <div className="panel-card p-5">
      <h3 className="text-sm font-semibold text-slate-800">{t('analytics.categoryBreakdown.title')}</h3>
      <p className="mt-1 text-xs text-muted">{t('analytics.categoryBreakdown.subtitle')}</p>

      {loading ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-6 w-full animate-pulse rounded bg-surface-300" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <CategoryList
            title={t('analytics.categoryBreakdown.salesLabel')}
            categories={topSaleCategories}
            barColorClass="bg-primary"
            noDataText={t('analytics.categoryBreakdown.noData')}
          />
          <CategoryList
            title={t('analytics.categoryBreakdown.expensesLabel')}
            categories={topExpenseCategories}
            barColorClass="bg-danger"
            noDataText={t('analytics.categoryBreakdown.noData')}
          />
        </div>
      )}
    </div>
  );
}