import { useTranslation } from 'react-i18next';

const SEVERITY_STYLES = {
  high: 'border-danger/30 bg-danger/5',
  medium: 'border-warning/30 bg-warning/5',
};

// One alert row. Renders whatever geminiService.generateAlertMessage
// produced (alert.message) under the deterministic headline
// (alert.title) - if the AI call failed when the alert was created,
// message is null and the title alone still fully explains what
// happened, so the card never looks broken.
export default function AlertCard({ alert, onMarkRead }) {
  const { t } = useTranslation();

  const TYPE_LABELS = {
    revenue_drop: t('alerts.typeRevenueDrop'),
    expense_spike: t('alerts.typeExpenseSpike'),
    low_stock: t('alerts.typeLowStock'),
    category_zero: t('alerts.typeCategoryZero'),
  };

  const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.medium;

  return (
    <div className={`rounded-xl border p-4 transition ${style} ${!alert.isRead ? 'shadow-sm' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {!alert.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
            {TYPE_LABELS[alert.type] || alert.type}
          </span>
          {alert.severity === 'high' && (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">
              {t('alerts.urgent')}
            </span>
          )}
        </div>
        <span className="shrink-0 text-[11px] text-muted-light">
          {alert.createdAt ? new Date(alert.createdAt).toLocaleDateString() : ''}
        </span>
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-800">{alert.title}</p>
      {alert.message && <p className="mt-1 text-sm text-muted">{alert.message}</p>}

      {!alert.isRead && (
        <button
          onClick={() => onMarkRead(alert._id)}
          className="mt-3 text-xs font-semibold text-primary hover:text-primary-hover"
        >
          {t('alerts.markRead')}
        </button>
      )}
    </div>
  );
}