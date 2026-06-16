import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signPayload, verifySignature } from '../src/webhooks/signature.js';
import { UFDSWebhookHandler } from '../src/webhooks/handler.js';
import { loadFixture } from './helpers/fixtures.js';

const SECRET = 'whsec_test_secret';

function rawBodyFor(fixtureName) {
  const json = loadFixture(fixtureName);
  return Buffer.from(JSON.stringify(json), 'utf8');
}

test('signPayload() produces a deterministic hex HMAC-SHA256 digest', () => {
  const body = rawBodyFor('order_new.json');
  const sig1 = signPayload(SECRET, body);
  const sig2 = signPayload(SECRET, body);

  assert.equal(sig1, sig2);
  assert.match(sig1, /^[0-9a-f]{64}$/);
});

test('verifySignature() accepts a correctly signed body', () => {
  const body = rawBodyFor('order_new.json');
  const signature = signPayload(SECRET, body);

  assert.equal(verifySignature(SECRET, body, signature), true);
});

test('verifySignature() accepts a sha256= prefixed signature', () => {
  const body = rawBodyFor('order_new.json');
  const signature = signPayload(SECRET, body);

  assert.equal(verifySignature(SECRET, body, `sha256=${signature}`), true);
});

test('verifySignature() rejects a tampered body', () => {
  const body = rawBodyFor('order_new.json');
  const signature = signPayload(SECRET, body);
  const tampered = Buffer.from(body.toString('utf8').replace('Priya Sharma', 'Eve Attacker'), 'utf8');

  assert.equal(verifySignature(SECRET, tampered, signature), false);
});

test('verifySignature() rejects the wrong secret', () => {
  const body = rawBodyFor('order_new.json');
  const signature = signPayload(SECRET, body);

  assert.equal(verifySignature('wrong_secret', body, signature), false);
});

test('verifySignature() rejects a missing signature', () => {
  const body = rawBodyFor('order_new.json');
  assert.equal(verifySignature(SECRET, body, undefined), false);
});

function fakeReqRes(body, signature) {
  const req = { body, headers: { 'x-ufds-signature': signature } };
  const res = {
    statusCode: null,
    jsonBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    },
  };
  return { req, res };
}

test('middleware() verifies, parses, and emits the typed event on success', async () => {
  const handler = new UFDSWebhookHandler({ secret: SECRET });
  const body = rawBodyFor('order_new.json');
  const signature = signPayload(SECRET, body);
  const { req, res } = fakeReqRes(body, signature);

  const received = await new Promise((resolve) => {
    handler.on('order.new', resolve);
    handler.middleware()(req, res, (err) => assert.fail(err));
  });

  assert.equal(received.event, 'order.new');
  assert.equal(received.order.id, 'UFDS-ORD-20260616-00142');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonBody, { received: true });
  assert.equal(req.ufdsEvent.event, 'order.new');
});

test('middleware() emits order.status_update for status webhooks', async () => {
  const handler = new UFDSWebhookHandler({ secret: SECRET });
  const body = rawBodyFor('order_status_update.json');
  const signature = signPayload(SECRET, body);
  const { req, res } = fakeReqRes(body, signature);

  const received = await new Promise((resolve) => {
    handler.on('order.status_update', resolve);
    handler.middleware()(req, res, (err) => assert.fail(err));
  });

  assert.equal(received.status, 'ACCEPTED');
  assert.equal(res.statusCode, 200);
});

test('middleware() rejects an invalid signature with 401 and does not emit the typed event', async () => {
  const handler = new UFDSWebhookHandler({ secret: SECRET });
  const body = rawBodyFor('order_cancelled.json');
  const { req, res } = fakeReqRes(body, 'deadbeef');

  let emitted = false;
  let invalidSignatureError = null;
  handler.on('order.cancelled', () => {
    emitted = true;
  });
  handler.on('invalid_signature', (err) => {
    invalidSignatureError = err;
  });

  handler.middleware()(req, res, (err) => assert.fail(err));

  assert.equal(res.statusCode, 401);
  assert.equal(emitted, false);
  assert.ok(invalidSignatureError instanceof Error);
});

test('middleware() does not throw when no invalid_signature listener is attached', () => {
  const handler = new UFDSWebhookHandler({ secret: SECRET });
  const body = rawBodyFor('order_cancelled.json');
  const { req, res } = fakeReqRes(body, 'deadbeef');

  assert.doesNotThrow(() => {
    handler.middleware()(req, res, (err) => assert.fail(err));
  });
  assert.equal(res.statusCode, 401);
});

test('middleware() calls next() with an error when body is not a raw Buffer', () => {
  const handler = new UFDSWebhookHandler({ secret: SECRET });
  const req = { body: { already: 'parsed' }, headers: {} };
  const res = { status() { return this; }, json() { return this; } };

  let nextError = null;
  handler.middleware()(req, res, (err) => {
    nextError = err;
  });

  assert.ok(nextError instanceof Error);
  assert.match(nextError.message, /raw request body/);
});
