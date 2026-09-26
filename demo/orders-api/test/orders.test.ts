import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

let server: Server;
let url: string;

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const post = (body: unknown) =>
  fetch(`${url}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('orders API', () => {
  it('creates an order and reads it back', async () => {
    const created = await post({ items: [{ sku: 'SKU-1', unitPrice: 60, quantity: 2 }] });
    expect(created.status).toBe(201);
    const order = await created.json();
    expect(order.total).toBe(108);

    const read = await fetch(`${url}/orders/${order.id}`);
    expect(read.status).toBe(200);
    expect((await read.json()).id).toBe(order.id);
  });

  it('rejects an empty order', async () => {
    expect((await post({ items: [] })).status).toBe(400);
  });

  it('returns 404 for an unknown order', async () => {
    expect((await fetch(`${url}/orders/999`)).status).toBe(404);
  });
});
