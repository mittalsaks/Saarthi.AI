const {
  round2,
  percentChange,
  computeTotals,
  getPeriodRanges,
} = require('../src/services/statsService');

const {
  computeAnalyticsTotals,
  buildDailySeries,
  topCategories,
  getRangeWindow,
  isValidRange,
} = require('../src/services/analyticsService');

/**
 * Pure-function math tests only - no Mongo, no Gemini, no HTTP server.
 * These lock in the "golden rule" numbers (totals, %, margins) so a
 * future refactor can't silently change what the AI ends up narrating.
 */

describe('statsService (pure math)', () => {
  test('round2 rounds to 2 decimals and fixes float drift', () => {
    expect(round2(10.005)).toBeCloseTo(10.01, 2);
    expect(round2(19.999999)).toBe(20);
    expect(round2(0)).toBe(0);
  });

  test('percentChange: normal increase and decrease', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(100, 100)).toBe(0);
  });

  test('percentChange: previous is zero', () => {
    expect(percentChange(0, 0)).toBe(0); // no change, both zero
    expect(percentChange(500, 0)).toBeNull(); // undefined growth, never Infinity
  });

  test('percentChange: uses abs(previous) so a negative previous still gives a sane sign', () => {
    // previous -100 -> current -50 is an improvement (loss shrank)
    expect(percentChange(-50, -100)).toBe(50);
  });

  test('computeTotals sums sales/expenses and ignores unknown types', () => {
    const entries = [
      { type: 'sale', amount: 500 },
      { type: 'sale', amount: 250.5 },
      { type: 'expense', amount: 100 },
      { type: 'refund', amount: 9999 }, // unknown type must be ignored
    ];
    const totals = computeTotals(entries);
    expect(totals.sales).toBe(750.5);
    expect(totals.expenses).toBe(100);
    expect(totals.netProfit).toBe(650.5);
    expect(totals.entryCount).toBe(4);
  });

  test('computeTotals coerces non-numeric/missing amount to 0 instead of NaN', () => {
    const entries = [
      { type: 'sale', amount: 'not-a-number' },
      { type: 'sale' }, // amount missing entirely
      { type: 'expense', amount: 50 },
    ];
    const totals = computeTotals(entries);
    expect(totals.sales).toBe(0);
    expect(totals.expenses).toBe(50);
    expect(Number.isNaN(totals.netProfit)).toBe(false);
  });

  test('getPeriodRanges: "today" is a 1-day window, "yesterday" immediately precedes it', () => {
    const now = new Date('2026-06-15T12:00:00');
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodRanges('today', now);
    expect(currentStart.toISOString().slice(0, 10)).toBe('2026-06-15');
    expect((currentEnd - currentStart) / (24 * 60 * 60 * 1000)).toBe(1);
    expect(previousEnd.getTime()).toBe(currentStart.getTime());
    expect((currentStart - previousStart) / (24 * 60 * 60 * 1000)).toBe(1);
  });

  test('getPeriodRanges: "week" covers the last 7 days inclusive of today', () => {
    const now = new Date('2026-06-15T12:00:00');
    const { currentStart, currentEnd } = getPeriodRanges('week', now);
    expect((currentEnd - currentStart) / (24 * 60 * 60 * 1000)).toBe(7);
    expect(currentStart.toISOString().slice(0, 10)).toBe('2026-06-09');
  });

  test('getPeriodRanges: unknown period falls back to "today" behaviour', () => {
    const now = new Date('2026-06-15T12:00:00');
    const todayRange = getPeriodRanges('today', now);
    const bogusRange = getPeriodRanges('bogus-period', now);
    expect(bogusRange.currentStart.getTime()).toBe(todayRange.currentStart.getTime());
  });
});

describe('analyticsService (pure math)', () => {
  test('computeAnalyticsTotals: sales, expenses, margin, avg sale value', () => {
    const entries = [
      { type: 'sale', amount: 1000 },
      { type: 'sale', amount: 500 },
      { type: 'expense', amount: 300 },
    ];
    const totals = computeAnalyticsTotals(entries);
    expect(totals.sales).toBe(1500);
    expect(totals.expenses).toBe(300);
    expect(totals.netProfit).toBe(1200);
    expect(totals.customersServed).toBe(2);
    expect(totals.avgSaleValue).toBe(750);
    expect(totals.profitMarginPct).toBe(80); // 1200/1500 * 100
  });

  test('computeAnalyticsTotals: zero sales gives null margin, not division-by-zero garbage', () => {
    const totals = computeAnalyticsTotals([{ type: 'expense', amount: 200 }]);
    expect(totals.sales).toBe(0);
    expect(totals.profitMarginPct).toBeNull();
    expect(totals.avgSaleValue).toBe(0);
  });

  test('topCategories: sums per category and sorts descending, respects topN', () => {
    const entries = [
      { type: 'sale', category: 'grocery', amount: 100 },
      { type: 'sale', category: 'grocery', amount: 50 },
      { type: 'sale', category: 'dairy', amount: 300 },
      { type: 'sale', category: 'snacks', amount: 20 },
      { type: 'expense', category: 'grocery', amount: 999 }, // wrong type, must be excluded
    ];
    const top = topCategories(entries, 'sale', 2);
    expect(top).toHaveLength(2);
    expect(top[0]).toMatchObject({ category: 'dairy', amount: 300, count: 1 });
    expect(top[1]).toMatchObject({ category: 'grocery', amount: 150, count: 2 });
  });

  test('topCategories: missing category defaults to "general"', () => {
    const top = topCategories([{ type: 'sale', amount: 40 }], 'sale');
    expect(top[0].category).toBe('general');
  });

  test('buildDailySeries: fills every day in range with zeros even if no entries that day', () => {
    const start = new Date('2026-06-01T00:00:00');
    const end = new Date('2026-06-04T00:00:00'); // 3 days: 06-01, 06-02, 06-03
    const entries = [{ type: 'sale', amount: 100, date: '2026-06-02T10:00:00' }];
    const series = buildDailySeries(entries, start, end);
    expect(series).toHaveLength(3);
    expect(series.map((d) => d.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
    expect(series[0]).toMatchObject({ sales: 0, expenses: 0 });
    expect(series[1]).toMatchObject({ sales: 100, expenses: 0 });
  });

  test('isValidRange / getRangeWindow: known ranges accepted, unknown falls back to 30d', () => {
    expect(isValidRange('7d')).toBe(true);
    expect(isValidRange('1y')).toBe(false);

    const now = new Date('2026-06-15T12:00:00');
    const week = getRangeWindow('7d', now);
    expect(week.days).toBe(7);
    // prev window is the same length, immediately before start
    expect(week.prevEnd.getTime()).toBe(week.start.getTime());
    expect((week.start - week.prevStart) / (24 * 60 * 60 * 1000)).toBe(7);

    const fallback = getRangeWindow('nonsense', now);
    expect(fallback.range).toBe('30d');
    expect(fallback.days).toBe(30);
  });
});
