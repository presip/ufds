import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UFDSHttpClient } from '../src/client.js';
import { MenuResource } from '../src/resources/menu.js';
import { createFakeFetch } from './helpers/fakeFetch.js';
import { loadFixture } from './helpers/fixtures.js';

const menuFixture = loadFixture('menu_full.json');

function buildMenu(fetch) {
  const http = new UFDSHttpClient({ token: 't', fetch });
  return new MenuResource(http);
}

test('get() fetches the full menu for a restaurant', async () => {
  const fetch = createFakeFetch([{ status: 200, body: menuFixture }]);
  const menu = buildMenu(fetch);

  const result = await menu.get('RST-IN-TS-001');

  assert.equal(fetch.calls[0].init.method, 'GET');
  assert.match(fetch.calls[0].url, /\/menu\/RST-IN-TS-001$/);
  assert.deepEqual(result, menuFixture);
});

test('replace() PUTs the full menu payload', async () => {
  const fetch = createFakeFetch([{ status: 200, body: menuFixture }]);
  const menu = buildMenu(fetch);

  await menu.replace('RST-IN-TS-001', menuFixture);

  const { url, init } = fetch.calls[0];
  assert.equal(init.method, 'PUT');
  assert.match(url, /\/menu\/RST-IN-TS-001$/);
  assert.deepEqual(JSON.parse(init.body), menuFixture);
});

test('updateItem() PATCHes a single item by id', async () => {
  const updatedItem = { ...menuFixture.menu.categories[0].items[0], available: false };
  const fetch = createFakeFetch([{ status: 200, body: updatedItem }]);
  const menu = buildMenu(fetch);

  const result = await menu.updateItem('RST-IN-TS-001', 'ITEM-001', { available: false });

  const { url, init } = fetch.calls[0];
  assert.equal(init.method, 'PATCH');
  assert.match(url, /\/menu\/RST-IN-TS-001\/items\/ITEM-001$/);
  assert.deepEqual(JSON.parse(init.body), { available: false });
  assert.equal(result.available, false);
});

test('deleteItem() DELETEs an item and resolves to null on 204', async () => {
  const fetch = createFakeFetch([{ status: 204 }]);
  const menu = buildMenu(fetch);

  const result = await menu.deleteItem('RST-IN-TS-001', 'ITEM-003');

  const { url, init } = fetch.calls[0];
  assert.equal(init.method, 'DELETE');
  assert.match(url, /\/menu\/RST-IN-TS-001\/items\/ITEM-003$/);
  assert.equal(result, null);
});

test('encodes restaurant and item ids that contain special characters', async () => {
  const fetch = createFakeFetch([{ status: 200, body: {} }]);
  const menu = buildMenu(fetch);

  await menu.updateItem('RST IN/MH 001', 'ITEM 001', { available: true });

  assert.match(fetch.calls[0].url, /\/menu\/RST%20IN%2FMH%20001\/items\/ITEM%20001$/);
});
