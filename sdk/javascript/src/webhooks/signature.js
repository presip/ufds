import { createHmac, timingSafeEqual } from 'node:crypto';

/** Computes the hex-encoded HMAC-SHA256 signature UFDS expects for a webhook body. */
export function signPayload(secret, rawBody) {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  return createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Verifies the `X-UFDS-Signature` header against the raw (unparsed) request body.
 * Accepts either a bare hex digest or a `sha256=<digest>` prefixed value.
 */
export function verifySignature(secret, rawBody, signature) {
  if (!signature) return false;

  const provided = String(signature).startsWith('sha256=')
    ? String(signature).slice('sha256='.length)
    : String(signature);

  const expected = signPayload(secret, rawBody);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');

  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
