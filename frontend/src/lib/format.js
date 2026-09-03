// Shared display formatters. All numbers passed in here are already
// backend-computed (analyticsService.js / statsService.js) - these
// functions only ever format, never calculate.

export function formatRupees(n) {
  const num = Number(n) || 0;
  const abs = Math.abs(num);
  return `${num < 0 ? '-' : ''}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatNumber(n) {
  return (Number(n) || 0).toLocaleString('en-IN');
}

export function formatPercent(n) {
  if (n === null || n === undefined) return '—';
  return `${n}%`;
}

/** Short date label for chart axes, e.g. "2026-08-05" -> "5 Aug". */
export function formatDateShort(isoDateKey) {
  const [y, m, d] = isoDateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
