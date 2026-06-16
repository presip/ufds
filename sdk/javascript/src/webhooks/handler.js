import { EventEmitter } from 'node:events';
import { verifySignature } from './signature.js';

const SIGNATURE_HEADER = 'x-ufds-signature';

export const WEBHOOK_EVENTS = Object.freeze([
  'order.new',
  'order.status_update',
  'order.cancelled',
  'platform.offline',
  'menu.sync_failed',
]);

/**
 * Verifies inbound UFDS webhook deliveries and emits typed events.
 *
 * Mount `express.raw({ type: 'application/json' })` ahead of this
 * middleware so `req.body` is the untouched Buffer the signature was
 * computed over — re-serialized JSON will not match the signature.
 *
 *   const handler = new UFDSWebhookHandler({ secret });
 *   app.post('/webhooks/ufds', express.raw({ type: 'application/json' }), handler.middleware());
 *   handler.on('order.new', (payload) => { ... });
 */
export class UFDSWebhookHandler extends EventEmitter {
  constructor({ secret } = {}) {
    super();
    if (!secret) throw new Error('UFDSWebhookHandler requires a `secret`.');
    this.secret = secret;
  }

  middleware() {
    return (req, res, next) => {
      const rawBody = req.body;
      if (!Buffer.isBuffer(rawBody)) {
        return next(
          new Error(
            'UFDSWebhookHandler requires the raw request body as a Buffer. ' +
              'Mount express.raw({ type: "application/json" }) before this middleware.',
          ),
        );
      }

      const signature = req.headers[SIGNATURE_HEADER];
      if (!verifySignature(this.secret, rawBody, signature)) {
        const error = new Error('Invalid X-UFDS-Signature header.');
        // Note: deliberately not emitted as 'error' — EventEmitter throws
        // synchronously on an unhandled 'error' event, which would crash
        // the host process for a routine bad-signature request.
        this.emit('invalid_signature', error);
        return res.status(401).json({
          error: {
            code: 'UFDS_4001',
            category: 'AUTH',
            message: error.message,
          },
        });
      }

      let payload;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch (cause) {
        this.emit('malformed_payload', cause);
        return res.status(400).json({
          error: {
            code: 'UFDS_4000',
            category: 'VALIDATION',
            message: 'Malformed webhook payload.',
          },
        });
      }

      req.ufdsEvent = payload;
      this.emit(payload.event, payload);
      this.emit('event', payload);

      return res.status(200).json({ received: true });
    };
  }
}
