const {
  getStatus,
  getAvgDailyUsage,
  getProjection,
  serializeItem,
  summarize,
} = require('../src/services/stockService');

/**
 * Pure-function tests for stock/inventory math - deterministic
 * threshold + velocity logic that Gemini is only ever allowed to
 * phrase, never decide. No Mongo needed.
 */

describe('stockService (pure math)', () => {
  test('getStatus: out when qty is 0 or negative', () => {
    expect(getStatus({ currentQty: 0, lowStockThreshold: 5 })).toBe('out');
    expect(getStatus({ currentQty: -2, lowStockThreshold: 5 })).toBe('out');
  });

  test('getStatus: low when qty is above zero but at/under threshold', () => {
    expect(getStatus({ currentQty: 5, lowStockThreshold: 5 })).toBe('low');
    expect(getStatus({ currentQty: 3, lowStockThreshold: 5 })).toBe('low');
  });

  test('getStatus: ok when comfortably above threshold', () => {
    expect(getStatus({ currentQty: 50, lowStockThreshold: 5 })).toBe('ok');
  });

  test('getAvgDailyUsage: 0 when there is no usage history', () => {
    expect(getAvgDailyUsage({ movements: [] })).toBe(0);
    expect(getAvgDailyUsage({ movements: [{ type: 'restock', changeQty: 50, date: new Date() }] })).toBe(0);
  });

  test('getAvgDailyUsage: averages negative (usage) movements over the days they span', () => {
    const now = Date.now();
    const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000);
    const item = {
      movements: [
        { type: 'usage', changeQty: -10, date: daysAgo(10) },
        { type: 'usage', changeQty: -10, date: daysAgo(0) },
      ],
    };
    // 20 units used over a 10-day span -> 2/day
    expect(getAvgDailyUsage(item)).toBeCloseTo(2, 5);
  });

  test('getAvgDailyUsage: ignores movements outside the lookback window', () => {
    const now = Date.now();
    const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000);
    const item = {
      movements: [
        { type: 'usage', changeQty: -1000, date: daysAgo(90) }, // way outside 30d window
        { type: 'usage', changeQty: -5, date: daysAgo(1) },
      ],
    };
    const avg = getAvgDailyUsage(item, 30);
    expect(avg).toBeGreaterThan(0);
    expect(avg).toBeLessThan(1000); // must not be dragged up by the old spike
  });

  test('getProjection: no usage history -> daysUntilOut and nextDueDate are null', () => {
    const projection = getProjection({ currentQty: 20, movements: [] });
    expect(projection.avgDailyUsage).toBe(0);
    expect(projection.daysUntilOut).toBeNull();
    expect(projection.nextDueDate).toBeNull();
    expect(projection.lastRestockedAt).toBeNull();
  });

  test('getProjection: picks the most recent restock as lastRestockedAt', () => {
    const older = new Date('2026-01-01T00:00:00Z');
    const newer = new Date('2026-03-01T00:00:00Z');
    const item = {
      currentQty: 10,
      movements: [
        { type: 'restock', changeQty: 20, date: older },
        { type: 'restock', changeQty: 15, date: newer },
      ],
    };
    const projection = getProjection(item);
    expect(new Date(projection.lastRestockedAt).getTime()).toBe(newer.getTime());
  });

  test('getProjection: estimates daysUntilOut from currentQty / avgDailyUsage', () => {
    const now = Date.now();
    const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000);
    const item = {
      currentQty: 20,
      movements: [
        { type: 'usage', changeQty: -10, date: daysAgo(10) },
        { type: 'usage', changeQty: -10, date: daysAgo(0) },
      ], // avg usage = 2/day
    };
    const projection = getProjection(item);
    expect(projection.avgDailyUsage).toBeCloseTo(2, 5);
    expect(projection.daysUntilOut).toBe(10); // 20 qty / 2 per day
    expect(projection.nextDueDate).not.toBeNull();
  });

  test('serializeItem: bundles status + projection, omits movements by default', () => {
    const item = {
      _id: 'abc123',
      name: 'Rice 1kg',
      unit: 'kg',
      currentQty: 2,
      lowStockThreshold: 5,
      movements: [{ type: 'restock', changeQty: 10, date: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const serialized = serializeItem(item);
    expect(serialized.status).toBe('low');
    expect(serialized.movements).toBeUndefined();
  });

  test('serializeItem: includes movements sorted newest-first when requested', () => {
    const older = new Date('2026-01-01T00:00:00Z');
    const newer = new Date('2026-02-01T00:00:00Z');
    const item = {
      _id: 'abc123',
      name: 'Rice 1kg',
      currentQty: 10,
      lowStockThreshold: 5,
      movements: [
        { type: 'restock', changeQty: 5, date: older },
        { type: 'restock', changeQty: 5, date: newer },
      ],
    };
    const serialized = serializeItem(item, { includeHistory: true });
    expect(serialized.movements).toHaveLength(2);
    expect(new Date(serialized.movements[0].date).getTime()).toBe(newer.getTime());
  });

  test('summarize: counts low/out items and builds the sidebar badge count', () => {
    const items = [
      { _id: 1, name: 'A', currentQty: 0, lowStockThreshold: 5, movements: [] }, // out
      { _id: 2, name: 'B', currentQty: 3, lowStockThreshold: 5, movements: [] }, // low
      { _id: 3, name: 'C', currentQty: 100, lowStockThreshold: 5, movements: [] }, // ok
    ];
    const summary = summarize(items);
    expect(summary.totalItems).toBe(3);
    expect(summary.outOfStockCount).toBe(1);
    expect(summary.lowStockCount).toBe(1);
    expect(summary.badgeCount).toBe(2);
    expect(summary.lowStockItems).toHaveLength(1);
    expect(summary.outOfStockItems).toHaveLength(1);
  });

  test('summarize: badgeCount is 0 when everything is healthy', () => {
    const items = [{ _id: 1, name: 'A', currentQty: 100, lowStockThreshold: 5, movements: [] }];
    expect(summarize(items).badgeCount).toBe(0);
  });
});
