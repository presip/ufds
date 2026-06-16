import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UFDSHttpClient, UFDSError, ENVIRONMENTS } from '../src/client.js';
import { createFakeFetch } from './helpers/fakeFetch.js';

test('sends Bearer auth header and uses the production base URL by default', async () => {
  const fetch = createFakeFetch([{ status: 200, body: { ufds_version: '1.0' } }]);
  const client = new UFDSHttpClient({ token: 'jwt-123', fetch });

  await client.get('/menu/RST-IN-MH-001');

  assert.equal(fetch.calls.length, 1);
  const { url, init } = fetch.calls[0];
  assert.equal(url, `${ENVIRONMENTS.production}/menu/RST-IN-MH-001`);
  assert.equal(init.headers.Authorization, 'Bearer jwt-123');
});

test('switches to the sandbox base URL', async () => {
  const fetch = createFakeFetch([{ status: 200, body: {} }]);
  const client = new UFDSHttpClient({ token: 't', environment: 'sandbox', fetch });

  await client.get('/menu/RST-IN-MH-001');

  assert.match(fetch.calls[0].url, /^https:\/\/sandbox\.ufds\.dev\/v1/);
});

test('serializes query params, skipping undefined/null values', async () => {
  const fetch = createFakeFetch([{ status: 200, body: {} }]);
  const client = new UFDSHttpClient({ token: 't', fetch });

  await client.get('/orders/RST-IN-MH-001', {
    query: { status: 'PENDING', platform: undefined, page: 2 },
  });

  const url = new URL(fetch.calls[0].url);
  assert.equal(url.searchParams.get('status'), 'PENDING');
  assert.equal(url.searchParams.get('platform'), null);
  assert.equal(url.searchParams.get('page'), '2');
});

test('retries on 5xx with exponential backoff and eventually succeeds', async () => {
  const fetch = createFakeFetch([
    { status: 503, body: { error: { code: 'UFDS_5000', category: 'INTERNAL', message: 'down' } } },
    { status: 502, body: { error: { code: 'UFDS_5000', category: 'INTERNAL', message: 'down' } } },
    { status: 200, body: { ufds_version: '1.0' } },
  ]);
  const client = new UFDSHttpClient({ token: 't', fetch, maxAttempts: 3, retryBaseDelayMs: 1 });

  const result = await client.get('/menu/RST-IN-MH-001');

  assert.equal(fetch.calls.length, 3);
  assert.deepEqual(result, { ufds_version: '1.0' });
});

test('throws UFDSError after exhausting retry attempts on persistent 5xx', async () => {
  const fetch = createFakeFetch([
    { status: 500, body: { error: { code: 'UFDS_5001', category: 'INTERNAL', message: 'boom' } } },
    { status: 500, body: { error: { code: 'UFDS_5001', category: 'INTERNAL', message: 'boom' } } },
    { status: 500, body: { error: { code: 'UFDS_5001', category: 'INTERNAL', message: 'boom' } } },
  ]);
  const client = new UFDSHttpClient({ token: 't', fetch, maxAttempts: 3, retryBaseDelayMs: 1 });

  await assert.rejects(
    () => client.get('/menu/RST-IN-MH-001'),
    (err) => {
      assert.ok(err instanceof UFDSError);
      assert.equal(err.code, 'UFDS_5001');
      assert.equal(err.httpStatus, 500);
      return true;
    },
  );
  assert.equal(fetch.calls.length, 3);
});

test('respects Retry-After on 429 before retrying', async () => {
  const fetch = createFakeFetch([
    { status: 429, headers: { 'Retry-After': '0' }, body: { error: { code: 'UFDS_4290', category: 'PLATFORM', message: 'slow down' } } },
    { status: 200, body: { ufds_version: '1.0' } },
  ]);
  const client = new UFDSHttpClient({ token: 't', fetch, maxAttempts: 3 });

  const result = await client.get('/orders/RST-IN-MH-001');

  assert.equal(fetch.calls.length, 2);
  assert.deepEqual(result, { ufds_version: '1.0' });
});

test('maps the ErrorResponse envelope onto UFDSError for non-retryable failures', async () => {
  const fetch = createFakeFetch([
    {
      status: 404,
      body: {
        error: {
          code: 'UFDS_4022',
          category: 'VALIDATION',
          message: 'item_id ITEM-099 not found in menu for RST-IN-MH-001',
          field: 'items[1].item_id',
          docs: 'https://ufds.dev/errors/4022',
        },
      },
    },
  ]);
  const client = new UFDSHttpClient({ token: 't', fetch });

  await assert.rejects(
    () => client.get('/menu/RST-IN-MH-001/items/ITEM-099'),
    (err) => {
      assert.ok(err instanceof UFDSError);
      assert.equal(err.code, 'UFDS_4022');
      assert.equal(err.field, 'items[1].item_id');
      assert.equal(err.httpStatus, 404);
      return true;
    },
  );
  assert.equal(fetch.calls.length, 1);
});

test('retries on network failure and throws UFDS_NETWORK once attempts are exhausted', async () => {
  const fetch = createFakeFetch(['network-error', 'network-error']);
  const client = new UFDSHttpClient({ token: 't', fetch, maxAttempts: 2, retryBaseDelayMs: 1 });

  await assert.rejects(
    () => client.get('/menu/RST-IN-MH-001'),
    (err) => {
      assert.ok(err instanceof UFDSError);
      assert.equal(err.code, 'UFDS_NETWORK');
      return true;
    },
  );
  assert.equal(fetch.calls.length, 2);
});

test('returns null for 204 No Content', async () => {
  const fetch = createFakeFetch([{ status: 204 }]);
  const client = new UFDSHttpClient({ token: 't', fetch });

  const result = await client.delete('/menu/RST-IN-MH-001/items/ITEM-099');

  assert.equal(result, null);
});
