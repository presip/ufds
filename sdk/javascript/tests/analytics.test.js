import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UFDSHttpClient } from '../src/client.js';
import { AnalyticsResource } from '../src/resources/analytics.js';
import { createFakeFetch } from './helpers/fakeFetch.js';
import { loadFixture } from './helpers/fixtures.js';

const analyticsFixture = loadFixture('analytics_response.json');

function buildAnalytics(fetch) {
  const http = new UFDSHttpClient({ token: 't', fetch });
  return new AnalyticsResource(http);
}

test('get() issues a GET with required from/to and optional platform query params', async () => {
  const fetch = createFakeFetch([{ status: 200, body: analyticsFixture }]);
  const analytics = buildAnalytics(fetch);

  const result = await analytics.get('RST-IN-TS-001', { from: '2026-06-01', to: '2026-06-15', platform: 'swiggy' });

  const { url, init } = fetch.calls[0];
  const parsed = new URL(url);
  assert.equal(init.method, 'GET');
  assert.equal(parsed.pathname, '/v1/analytics/RST-IN-TS-001');
  assert.equal(parsed.searchParams.get('from'), '2026-06-01');
  assert.equal(parsed.searchParams.get('to'), '2026-06-15');
  assert.equal(parsed.searchParams.get('platform'), 'swiggy');
  assert.deepEqual(result, analyticsFixture);
});

test('get() omits platform from the query string when not provided', async () => {
  const fetch = createFakeFetch([{ status: 200, body: analyticsFixture }]);
  const analytics = buildAnalytics(fetch);

  await analytics.get('RST-IN-TS-001', { from: '2026-06-01', to: '2026-06-15' });

  const parsed = new URL(fetch.calls[0].url);
  assert.equal(parsed.searchParams.has('platform'), false);
});
