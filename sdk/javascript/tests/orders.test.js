import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UFDSHttpClient } from '../src/client.js';
import { OrdersResource } from '../src/resources/orders.js';
import { createFakeFetch } from './helpers/fakeFetch.js';
import { loadFixture } from './helpers/fixtures.js';

const orderNew = loadFixture('order_new.json');

function buildOrders(fetch) {
  const http = new UFDSHttpClient({ token: 't', fetch });
  return new OrdersResource(http);
}

test('list() issues a GET with filter and pagination query params', async () => {
  const fetch = createFakeFetch([
    { status: 200, body: { ufds_version: '1.0', orders: [orderNew.order], pagination: { total: 1, page: 1, per_page: 20, next_cursor: null } } },
  ]);
  const orders = buildOrders(fetch);

  await orders.list('RST-IN-TS-001', { status: 'PENDING', platform: 'swiggy', page: 1, perPage: 20 });

  const url = new URL(fetch.calls[0].url);
  assert.equal(fetch.calls[0].init.method, 'GET');
  assert.equal(url.pathname, '/v1/orders/RST-IN-TS-001');
  assert.equal(url.searchParams.get('status'), 'PENDING');
  assert.equal(url.searchParams.get('platform'), 'swiggy');
  assert.equal(url.searchParams.get('per_page'), '20');
});

test('get() fetches a single order by id', async () => {
  const fetch = createFakeFetch([{ status: 200, body: { ufds_version: '1.0', timestamp: orderNew.timestamp, order: orderNew.order } }]);
  const orders = buildOrders(fetch);

  const result = await orders.get('RST-IN-TS-001', 'UFDS-ORD-20260616-00142');

  assert.match(fetch.calls[0].url, /\/orders\/RST-IN-TS-001\/UFDS-ORD-20260616-00142$/);
  assert.deepEqual(result.order, orderNew.order);
});

test('updateStatus() PATCHes the status transition payload', async () => {
  const statusUpdate = loadFixture('order_status_update.json');
  const fetch = createFakeFetch([
    { status: 200, body: { ufds_version: '1.0', order: { ...orderNew.order, status: 'ACCEPTED' } } },
  ]);
  const orders = buildOrders(fetch);

  await orders.updateStatus('RST-IN-TS-001', 'UFDS-ORD-20260616-00142', {
    status: statusUpdate.status,
    eta_minutes: statusUpdate.eta_minutes,
  });

  const { url, init } = fetch.calls[0];
  assert.equal(init.method, 'PATCH');
  assert.match(url, /\/orders\/RST-IN-TS-001\/UFDS-ORD-20260616-00142$/);
  assert.deepEqual(JSON.parse(init.body), { status: 'ACCEPTED', eta_minutes: 25 });
});

test('updateStatus() supports cancellation with a reason', async () => {
  const cancelled = loadFixture('order_cancelled.json');
  const fetch = createFakeFetch([{ status: 200, body: { ufds_version: '1.0', order: { ...orderNew.order, status: 'CANCELLED' } } }]);
  const orders = buildOrders(fetch);

  await orders.updateStatus('RST-IN-TS-001', cancelled.order_id, {
    status: 'CANCELLED',
    cancellation_reason: cancelled.reason,
  });

  const body = JSON.parse(fetch.calls[0].init.body);
  assert.equal(body.status, 'CANCELLED');
  assert.equal(body.cancellation_reason, 'ITEM_UNAVAILABLE');
});

test('simulate() POSTs to the sandbox-only simulate endpoint', async () => {
  const fetch = createFakeFetch([{ status: 201, body: { ufds_version: '1.0', order: orderNew.order } }]);
  const orders = buildOrders(fetch);

  await orders.simulate('RST-IN-TS-001', { platform: 'swiggy', item_ids: ['ITEM-001', 'ITEM-012'] });

  const { url, init } = fetch.calls[0];
  assert.equal(init.method, 'POST');
  assert.match(url, /\/orders\/RST-IN-TS-001\/simulate$/);
  assert.deepEqual(JSON.parse(init.body), { platform: 'swiggy', item_ids: ['ITEM-001', 'ITEM-012'] });
});

test('simulate() surfaces a 403 as UFDSError when run outside sandbox', async () => {
  const fetch = createFakeFetch([
    { status: 403, body: { error: { code: 'UFDS_4030', category: 'STATE', message: 'Simulation not available in production.' } } },
  ]);
  const orders = buildOrders(fetch);

  await assert.rejects(() => orders.simulate('RST-IN-TS-001', {}), (err) => {
    assert.equal(err.httpStatus, 403);
    assert.equal(err.code, 'UFDS_4030');
    return true;
  });
});
