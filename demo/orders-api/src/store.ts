import type { LineItem } from './pricing.js';

export interface Order {
  id: string;
  items: LineItem[];
  total: number;
  createdAt: string;
}

/** In-memory order store; the real service persists to the orders database. */
export class OrderStore {
  private readonly orders = new Map<string, Order>();
  private nextId = 1;

  create(items: LineItem[], total: number): Order {
    const order: Order = {
      id: String(this.nextId++),
      items,
      total,
      createdAt: new Date().toISOString(),
    };
    this.orders.set(order.id, order);
    return order;
  }

  get(id: string): Order | undefined {
    return this.orders.get(id);
  }
}
