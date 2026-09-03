const { validateQuickAddResult } = require('../src/services/validateQuickAdd');

/**
 * This is the enforcement point for "never trust Gemini's shape
 * blindly" - every field it can hand back gets checked here before
 * anything reaches Entry.create(). Pure function, no Mongo/Gemini.
 */

describe('validateQuickAddResult', () => {
  test('accepts a well-formed parse and normalizes category/amount', () => {
    const result = validateQuickAddResult(
      { type: 'sale', amount: '250.456', category: '  Grocery  ', description: 'daily sale', date: '2026-06-01' },
      'fallback text'
    );
    expect(result.valid).toBe(true);
    expect(result.entry.type).toBe('sale');
    expect(result.entry.amount).toBe(250.46); // rounded to 2 decimals
    expect(result.entry.category).toBe('grocery'); // trimmed + lowercased
    expect(result.entry.description).toBe('daily sale');
  });

  test('rejects non-object input', () => {
    expect(validateQuickAddResult(null, 'text').valid).toBe(false);
    expect(validateQuickAddResult('a string', 'text').valid).toBe(false);
    expect(validateQuickAddResult(undefined, 'text').valid).toBe(false);
  });

  test('defaults an invalid/missing type to "expense"', () => {
    const result = validateQuickAddResult({ type: 'not-a-type', amount: 100 }, 'text');
    expect(result.valid).toBe(true);
    expect(result.entry.type).toBe('expense');
  });

  test('rejects a non-numeric or non-positive amount', () => {
    expect(validateQuickAddResult({ type: 'sale', amount: 'lots' }, 'text').valid).toBe(false);
    expect(validateQuickAddResult({ type: 'sale', amount: 0 }, 'text').valid).toBe(false);
    expect(validateQuickAddResult({ type: 'sale', amount: -50 }, 'text').valid).toBe(false);
  });

  test('rejects an unreasonably large amount (likely a Gemini misparse)', () => {
    const result = validateQuickAddResult({ type: 'sale', amount: 99999999999 }, 'text');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });

  test('falls back to "general" category when missing/blank', () => {
    const result = validateQuickAddResult({ type: 'sale', amount: 100, category: '   ' }, 'text');
    expect(result.entry.category).toBe('general');
  });

  test('falls back to the original free text when description is missing', () => {
    const result = validateQuickAddResult({ type: 'sale', amount: 100 }, 'aaj 100 ka bik gaya');
    expect(result.entry.description).toBe('aaj 100 ka bik gaya');
  });

  test('ignores an out-of-range date (too far in the future) and uses today instead', () => {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 5);
    const dateStr = farFuture.toISOString().slice(0, 10);
    const result = validateQuickAddResult({ type: 'sale', amount: 100, date: dateStr }, 'text');
    const today = new Date();
    expect(result.entry.date.getFullYear()).toBe(today.getFullYear());
  });

  test('accepts a valid recent date string', () => {
    const result = validateQuickAddResult({ type: 'sale', amount: 100, date: '2026-01-15' }, 'text');
    expect(result.entry.date.toISOString().slice(0, 10)).toBe('2026-01-15');
  });

  test('truncates overly long category and description fields', () => {
    const longStr = 'x'.repeat(500);
    const result = validateQuickAddResult({ type: 'sale', amount: 100, category: longStr, description: longStr }, 'text');
    expect(result.entry.category.length).toBe(60);
    expect(result.entry.description.length).toBe(300);
  });
});
