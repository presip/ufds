import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UFDSClient, UFDSWebhookHandler } from '../src/index.js';
import { createFakeFetch } from './helpers/fakeFetch.js';
import { loadFixture } from './helpers/fixtures.js';

test('UFDSClient wires up menu and orders resources sharing one http client', async () => {
  const menuFixture = loadFixture('menu_full.json');
  const fetch = createFakeFetch([{ status: 200, body: menuFixture }]);
  const client = new UFDSClient({ token: 'jwt', environment: 'sandbox', fetch });

  const menu = await client.menu.get('RST-IN-TS-001');

  assert.deepEqual(menu, menuFixture);
  assert.match(fetch.calls[0].url, /^https:\/\/sandbox\.ufds\.dev\/v1\/menu\/RST-IN-TS-001$/);
  assert.equal(client.menu.http, client.http);
  assert.equal(client.orders.http, client.http);
  assert.equal(client.inventory.http, client.http);
  assert.equal(client.analytics.http, client.http);
});

test('UFDSClient.webhooks() returns a bound UFDSWebhookHandler', () => {
  const client = new UFDSClient({ token: 'jwt', fetch: createFakeFetch([]) });
  const handler = client.webhooks({ secret: 'whsec_test' });

  assert.ok(handler instanceof UFDSWebhookHandler);
  assert.equal(handler.secret, 'whsec_test');
});
