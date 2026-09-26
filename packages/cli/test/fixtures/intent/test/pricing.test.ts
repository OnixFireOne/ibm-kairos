import { describe, expect, it } from 'vitest';
import { applyDiscount } from '../src/pricing/discount';

// filler 1
// filler 2
// filler 3
// filler 4
// filler 5
// filler 6
// filler 7
// filler 8
// filler 9
// filler 10
// filler 11
// filler 12
// filler 13
// filler 14
// filler 15
// filler 16
// filler 17
// filler 18
// filler 19
// filler 20
// filler 21
// filler 22
// filler 23
// filler 24
// filler 25

describe('applyDiscount', () => {
  it('gives 10% above 100', () => {
    expect(applyDiscount(200)).toBe(180);
  });
});
