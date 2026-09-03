const { computeBalance, serializeCustomer, summarize } = require('../src/services/udhaarService');

/**
 * Pure-function tests for udhaar (credit) balance math. Balance is
 * NEVER stored - always re-derived from transactions - so these tests
 * are effectively the entire correctness guarantee for money the shop
 * is owed. No Mongo needed.
 */

describe('udhaarService (pure math)', () => {
  test('computeBalance: credit increases balance, payment decreases it', () => {
    const transactions = [
      { type: 'credit', amount: 500 },
      { type: 'credit', amount: 200 },
      { type: 'payment', amount: 300 },
    ];
    expect(computeBalance(transactions)).toBe(400);
  });

  test('computeBalance: fully paid off nets to exactly 0', () => {
    const transactions = [
      { type: 'credit', amount: 1000 },
      { type: 'payment', amount: 1000 },
    ];
    expect(computeBalance(transactions)).toBe(0);
  });

  test('computeBalance: no transactions is a 0 balance', () => {
    expect(computeBalance([])).toBe(0);
  });

  test('computeBalance: overpayment is not clamped, stays visible as negative', () => {
    const transactions = [
      { type: 'credit', amount: 100 },
      { type: 'payment', amount: 150 },
    ];
    expect(computeBalance(transactions)).toBe(-50);
  });

  test('computeBalance: rounds to 2 decimals', () => {
    const transactions = [
      { type: 'credit', amount: 10.1 },
      { type: 'credit', amount: 10.2 },
    ];
    expect(computeBalance(transactions)).toBe(20.3);
  });

  test('serializeCustomer: totals credit/paid separately from net balance', () => {
    const customer = { _id: 'c1', name: 'Suresh', phone: '9999999999', note: '', createdAt: new Date() };
    const transactions = [
      { type: 'credit', amount: 500, date: '2026-01-01' },
      { type: 'credit', amount: 300, date: '2026-01-05' },
      { type: 'payment', amount: 200, date: '2026-01-10' },
    ];
    const serialized = serializeCustomer(customer, transactions);
    expect(serialized.totalCredit).toBe(800);
    expect(serialized.totalPaid).toBe(200);
    expect(serialized.balance).toBe(600);
    expect(serialized.transactionCount).toBe(3);
    expect(serialized.lastTransactionAt).toBe('2026-01-10'); // most recent, sorted desc
  });

  test('serializeCustomer: lastTransactionAt is null with no transactions', () => {
    const customer = { _id: 'c1', name: 'Suresh', createdAt: new Date() };
    const serialized = serializeCustomer(customer, []);
    expect(serialized.lastTransactionAt).toBeNull();
    expect(serialized.balance).toBe(0);
  });

  test('summarize: only counts customers who currently owe (balance > 0) toward the badge', () => {
    const customers = [
      { balance: 500 },
      { balance: 0 }, // settled, excluded
      { balance: -50 }, // overpaid, excluded (not owing)
      { balance: 250 },
    ];
    const summary = summarize(customers);
    expect(summary.customersOwingCount).toBe(2);
    expect(summary.badgeCount).toBe(2);
    expect(summary.totalOutstanding).toBe(750);
  });

  test('summarize: zero outstanding when nobody owes anything', () => {
    const summary = summarize([{ balance: 0 }, { balance: -20 }]);
    expect(summary.customersOwingCount).toBe(0);
    expect(summary.totalOutstanding).toBe(0);
  });
});
