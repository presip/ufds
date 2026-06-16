import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UFDSHttpClient } from '../src/client.js';
import { InventoryResource } from '../src/resources/inventory.js';
import { createFakeFetch } from './helpers/fakeFetch.js';
import { loadFixture } from './helpers/fixtures.js';

const inventoryFixture = loadFixture('inventory_bulk_update.json');

function buildInventory(fetch) {
  const http = new UFDSHttpClient({ token: 't', fetch });
  return new InventoryResource(http);
}

test('bulkUpdate() POSTs an InventoryUpdate envelope with the given items', async () => {
  const fetch = createFakeFetch([
    { status: 200, body: { ufds_version: '1.0', synced_platforms: ['swiggy', 'zomato', 'ondc'], failed_platforms: [] } },
  ]);
  const inventory = buildInventory(fetch);

  const result = await inventory.bulkUpdate(inventoryFixture.restaurant_id, inventoryFixture.items, {
    timestamp: inventoryFixture.timestamp,
  });

  const { url, init } = fetch.calls[0];
  assert.equal(init.method, 'POST');
  assert.match(url, /\/inventory\/RST-IN-TS-001$/);
  const body = JSON.parse(init.body);
  assert.equal(body.ufds_version, '1.0');
  assert.equal(body.timestamp, inventoryFixture.timestamp);
  assert.equal(body.restaurant_id, 'RST-IN-TS-001');
  assert.deepEqual(body.items, inventoryFixture.items);
  assert.deepEqual(result.synced_platforms, ['swiggy', 'zomato', 'ondc']);
});

test('bulkUpdate() defaults timestamp to now when not provided', async () => {
  const fetch = createFakeFetch([{ status: 200, body: {} }]);
  const inventory = buildInventory(fetch);

  const before = Date.now();
  await inventory.bulkUpdate('RST-IN-TS-001', [{ item_id: 'ITEM-001', available: true }]);

  const body = JSON.parse(fetch.calls[0].init.body);
  assert.ok(Date.parse(body.timestamp) >= before);
});

test('updateAvailability() PATCHes a single InventoryItem and injects item_id', async () => {
  const fetch = createFakeFetch([{ status: 200, body: { item_id: 'ITEM-003', available: false, reason: 'SOLD_OUT' } }]);
  const inventory = buildInventory(fetch);

  const result = await inventory.updateAvailability('RST-IN-TS-001', 'ITEM-003', {
    available: false,
    reason: 'SOLD_OUT',
  });

  const { url, init } = fetch.calls[0];
  assert.equal(init.method, 'PATCH');
  assert.match(url, /\/inventory\/RST-IN-TS-001\/ITEM-003$/);
  assert.deepEqual(JSON.parse(init.body), { item_id: 'ITEM-003', available: false, reason: 'SOLD_OUT' });
  assert.equal(result.available, false);
});
