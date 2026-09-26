export interface LineItem {
  sku: string;
  unitPrice: number;
  quantity: number;
}

export const DISCOUNT_THRESHOLD = 100;
export const DISCOUNT_RATE = 0.1;

const round = (n: number): number => Math.round(n * 100) / 100;

export function subtotal(items: LineItem[]): number {
  return round(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));
}

/** Order total in dollars: orders above the threshold get the discount. */
export function orderTotal(items: LineItem[]): number {
  const sum = subtotal(items);
  return sum > DISCOUNT_THRESHOLD ? round(sum * (1 - DISCOUNT_RATE)) : sum;
}
