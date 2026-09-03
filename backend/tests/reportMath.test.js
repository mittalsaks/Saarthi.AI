const {
  isValidDateStr,
  parseDateRange,
  buildReport,
  escapeCsvField,
  toCSV,
  MAX_RANGE_DAYS,
} = require('../src/services/reportService');

/**
 * Pure-function tests for custom date-range reports. Reports have zero
 * AI involvement end to end (see reportService.js header comment), so
 * these tests are the entire correctness guarantee for anything a shop
 * owner exports as CSV. No Mongo needed.
 */

describe('reportService (pure math)', () => {
  describe('isValidDateStr / parseDateRange', () => {
    test('accepts well-formed YYYY-MM-DD strings', () => {
      expect(isValidDateStr('2026-06-15')).toBe(true);
      expect(isValidDateStr('2026-13-40')).toBe(false); // invalid calendar date
      expect(isValidDateStr('15-06-2026')).toBe(false); // wrong format
      expect(isValidDateStr('')).toBe(false);
      expect(isValidDateStr(undefined)).toBe(false);
    });

    test('parseDateRange builds a half-open range that fully includes endDate', () => {
      const { start, end } = parseDateRange('2026-06-01', '2026-06-03');
      expect(start.toISOString().slice(0, 10)).toBe('2026-06-01');
      // end is 06-04 00:00 so that all of 06-03 is included
      expect(end.toISOString().slice(0, 10)).toBe('2026-06-04');
      expect((end - start) / (24 * 60 * 60 * 1000)).toBe(3);
    });

    test('same start and end date is a valid single-day range', () => {
      const { start, end } = parseDateRange('2026-06-10', '2026-06-10');
      expect((end - start) / (24 * 60 * 60 * 1000)).toBe(1);
    });

    test('throws when startDate is after endDate', () => {
      expect(() => parseDateRange('2026-06-15', '2026-06-01')).toThrow(RangeError);
    });

    test('throws on malformed dates', () => {
      expect(() => parseDateRange('not-a-date', '2026-06-10')).toThrow(RangeError);
    });

    test('throws when the range exceeds MAX_RANGE_DAYS', () => {
      expect(() => parseDateRange('2020-01-01', '2026-01-01')).toThrow(RangeError);
    });

    test('accepts a range exactly at MAX_RANGE_DAYS', () => {
      // 366 days span = a full leap year; endDate inclusive
      expect(() => parseDateRange('2024-01-01', '2024-12-31')).not.toThrow();
    });
  });

  describe('buildReport', () => {
    const entries = [
      { type: 'sale', amount: 500, category: 'grocery', description: 'daily sale', date: '2026-06-02' },
      { type: 'sale', amount: 300, category: 'dairy', description: '', date: '2026-06-01' },
      { type: 'expense', amount: 100, category: 'rent', description: 'shop rent', date: '2026-06-01' },
      { type: 'expense', amount: 50, category: 'grocery', description: 'supplies', date: '2026-06-03' },
    ];

    test('totals: sums sales/expenses and counts each type separately', () => {
      const report = buildReport(entries, '2026-06-01', '2026-06-03');
      expect(report.totals.sales).toBe(800);
      expect(report.totals.expenses).toBe(150);
      expect(report.totals.netProfit).toBe(650);
      expect(report.totals.saleCount).toBe(2);
      expect(report.totals.expenseCount).toBe(2);
      expect(report.totals.entryCount).toBe(4);
    });

    test('categoryBreakdown: reuses topCategories logic per type', () => {
      const report = buildReport(entries, '2026-06-01', '2026-06-03');
      const saleCats = report.categoryBreakdown.sales.map((c) => c.category);
      const expenseCats = report.categoryBreakdown.expenses.map((c) => c.category);
      expect(saleCats).toEqual(expect.arrayContaining(['grocery', 'dairy']));
      expect(expenseCats).toEqual(expect.arrayContaining(['rent', 'grocery']));
    });

    test('entries: sorted chronologically ascending, dates normalized to YYYY-MM-DD', () => {
      const report = buildReport(entries, '2026-06-01', '2026-06-03');
      const dates = report.entries.map((e) => e.date);
      expect(dates).toEqual(['2026-06-01', '2026-06-01', '2026-06-02', '2026-06-03']);
    });

    test('empty entry list produces zeroed totals, not errors', () => {
      const report = buildReport([], '2026-06-01', '2026-06-03');
      expect(report.totals.sales).toBe(0);
      expect(report.totals.expenses).toBe(0);
      expect(report.totals.netProfit).toBe(0);
      expect(report.entries).toEqual([]);
    });
  });

  describe('CSV export', () => {
    test('escapeCsvField wraps and escapes fields containing commas/quotes/newlines', () => {
      expect(escapeCsvField('plain')).toBe('plain');
      expect(escapeCsvField('has,comma')).toBe('"has,comma"');
      expect(escapeCsvField('has "quotes"')).toBe('"has ""quotes"""');
      expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
      expect(escapeCsvField(undefined)).toBe('');
    });

    test('toCSV produces a well-formed CSV containing the report totals', () => {
      const report = buildReport(
        [{ type: 'sale', amount: 500, category: 'grocery', description: '', date: '2026-06-01' }],
        '2026-06-01',
        '2026-06-01'
      );
      const csv = toCSV(report);
      expect(csv).toContain('Saarthi.ai Report');
      expect(csv).toContain('Total Sales,500');
      expect(csv).toContain('grocery,500,1');
      expect(csv.split('\n').length).toBeGreaterThan(5);
    });
  });

  test('MAX_RANGE_DAYS is exported and matches the documented cap', () => {
    expect(MAX_RANGE_DAYS).toBe(366);
  });
});