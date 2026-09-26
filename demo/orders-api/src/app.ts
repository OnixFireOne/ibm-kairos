import express from 'express';
import { ordersRouter } from './routes/orders.js';
import { OrderStore } from './store.js';

export function createApp(store = new OrderStore()) {
  const app = express();
  app.use(express.json());
  app.use(ordersRouter(store));
  return app;
}
