/**
 * Type-only smoke test for src/index.d.ts. Not run by `node --test` — checked
 * via `npm run typecheck` (tsc --noEmit) to catch declaration/implementation
 * drift in the hand-written .d.ts file.
 */
import UFDSClient, {
  UFDSError,
  ENVIRONMENTS,
  UFDSWebhookHandler,
  WEBHOOK_EVENTS,
  signPayload,
  verifySignature,
  ONDCAdapter,
  SwiggyAdapter,
  ZomatoAdapter,
  type Menu,
  type Order,
  type OrderStatus,
} from '../../src/index.js';

const client = new UFDSClient({ token: 'jwt', environment: 'sandbox' });

async function exercise(): Promise<void> {
  const menu: Menu = await client.menu.get('RST-IN-MH-001');
  await client.menu.replace('RST-IN-MH-001', menu);
  await client.menu.updateItem('RST-IN-MH-001', 'ITEM-001', { available: false });
  await client.menu.deleteItem('RST-IN-MH-001', 'ITEM-001');

  const orderList = await client.orders.list('RST-IN-MH-001', { status: 'PENDING', perPage: 20 });
  const firstOrderId: string = orderList.orders[0].id;
  const orderResponse = await client.orders.get('RST-IN-MH-001', firstOrderId);
  await client.orders.updateStatus('RST-IN-MH-001', orderResponse.order.id, { status: 'ACCEPTED' });
  await client.orders.simulate('RST-IN-MH-001', { platform: 'swiggy', item_ids: ['ITEM-001'] });

  await client.inventory.bulkUpdate('RST-IN-MH-001', [{ item_id: 'ITEM-001', available: true }]);
  await client.inventory.updateAvailability('RST-IN-MH-001', 'ITEM-001', {
    available: false,
    reason: 'SOLD_OUT',
  });

  await client.analytics.get('RST-IN-MH-001', { from: '2026-06-01', to: '2026-06-15' });

  const handler: UFDSWebhookHandler = client.webhooks({ secret: 'whsec_test' });
  handler.on('order.new', (payload) => {
    const id: string = payload.order.id;
    void id;
  });
  handler.on('invalid_signature', (err) => {
    const msg: string = err.message;
    void msg;
  });

  const signature: string = signPayload('secret', 'raw-body');
  const isValid: boolean = verifySignature('secret', 'raw-body', signature);
  void isValid;

  const ondcOrder: Order = ONDCAdapter.toUFDSOrder({}, { restaurantId: 'RST-IN-MH-001' });
  const swiggyOrder: Order = SwiggyAdapter.toUFDSOrder({}, { restaurantId: 'RST-IN-MH-001' });
  const zomatoOrder: Order = ZomatoAdapter.toUFDSOrder({}, { restaurantId: 'RST-IN-MH-001' });
  void ondcOrder;
  void swiggyOrder;
  void zomatoOrder;

  const status: OrderStatus = 'PENDING';
  const productionUrl: string = ENVIRONMENTS.production;
  const events: readonly string[] = WEBHOOK_EVENTS;
  void status;
  void productionUrl;
  void events;

  // UFDSError takes a single options object, not (message, options) — verifying that shape.
  const err = new UFDSError({ message: 'boom', code: 'UFDS_TEST', category: 'INTERNAL' });
  void err;
}

void exercise;
