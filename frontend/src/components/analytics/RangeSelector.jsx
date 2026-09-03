import { useTranslation } from 'react-i18next';

export default function RangeSelector({ value, onChange }) {
  const { t } = useTranslation();

  const RANGES = [
    { key: '7d', label: t('analytics.range.7d') },
    { key: '30d', label: t('analytics.range.30d') },
    { key: '90d', label: t('analytics.range.90d') },
  ];

  return (
    <div className="flex rounded-lg border border-surface-500 bg-white p-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            value === r.key ? 'bg-primary text-white' : 'text-muted hover:text-slate-700'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}