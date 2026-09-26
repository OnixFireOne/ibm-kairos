import { describe, expect, it } from 'vitest';
import { orderTotal } from '../src/pricing.js';

const item = (unitPrice: number, quantity = 1) => ({ sku: 'SKU-1', unitPrice, quantity });

describe('orderTotal', () => {
  it('charges the subtotal up to $100', () => {
    expect(orderTotal([item(40, 2)])).toBe(80);
    expect(orderTotal([item(100)])).toBe(100);
  });

  it('gives 10% off above $100', () => {
    expect(orderTotal([item(60, 2)])).toBe(108);
  });
});
