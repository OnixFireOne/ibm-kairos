import { Router } from 'express';
import { orderTotal, type LineItem } from '../pricing.js';
import type { OrderStore } from '../store.js';

function isLineItem(x: unknown): x is LineItem {
  const i = x as LineItem;
  return (
    typeof i?.sku === 'string' &&
    typeof i.unitPrice === 'number' &&
    i.unitPrice >= 0 &&
    Number.isInteger(i.quantity) &&
    i.quantity > 0
  );
}

export function ordersRouter(store: OrderStore): Router {
  const router = Router();

  router.post('/orders', (req, res) => {
    const items: unknown = req.body?.items;
    if (!Array.isArray(items) || items.length === 0 || !items.every(isLineItem)) {
      res.status(400).json({ error: 'items must be a non-empty array of line items' });
      return;
    }
    res.status(201).json(store.create(items, orderTotal(items)));
  });

  router.get('/orders/:id', (req, res) => {
    const order = store.get(req.params.id);
    if (!order) {
      res.status(404).json({ error: 'order not found' });
      return;
    }
    res.json(order);
  });

  return router;
}
