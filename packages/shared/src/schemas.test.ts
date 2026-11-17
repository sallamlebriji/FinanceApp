import { describe, expect, it } from 'vitest';
import { amountSchema, positiveAmountSchema } from './schemas';

describe('amount validation', () => {
  it('accepts comma or dot decimals and normalises to a dot', () => {
    expect(positiveAmountSchema.parse('37,25')).toBe('37.25');
    expect(positiveAmountSchema.parse(' 1 200.5 ')).toBe('1200.5');
  });

  it('rejects malformed amounts with a validation error instead of throwing', () => {
    for (const bad of ['37,2537,25', '12.5,3', 'abc', '1.234', '']) {
      expect(() => positiveAmountSchema.safeParse(bad)).not.toThrow();
      expect(positiveAmountSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('rejects zero and negatives for positive amounts but allows them for plain amounts', () => {
    expect(positiveAmountSchema.safeParse('0').success).toBe(false);
    expect(positiveAmountSchema.safeParse('-5').success).toBe(false);
    expect(amountSchema.safeParse('-5').success).toBe(true);
  });
});
