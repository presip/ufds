import { UFDSHttpClient, UFDSError, ENVIRONMENTS } from './client.js';
import { MenuResource } from './resources/menu.js';
import { OrdersResource } from './resources/orders.js';
import { InventoryResource } from './resources/inventory.js';
import { AnalyticsResource } from './resources/analytics.js';
import { UFDSWebhookHandler, WEBHOOK_EVENTS } from './webhooks/handler.js';
import { signPayload, verifySignature } from './webhooks/signature.js';
import { ONDCAdapter } from './adapters/ondc.js';
import { SwiggyAdapter } from './adapters/swiggy.js';
import { ZomatoAdapter } from './adapters/zomato.js';

/**
 * Main UFDS SDK entry point.
 *
 *   const client = new UFDSClient({ token, environment: 'sandbox' });
 *   const menu = await client.menu.get('RST-IN-MH-001');
 *   const orders = await client.orders.list('RST-IN-MH-001', { status: 'PENDING' });
 *   const webhooks = client.webhooks({ secret: process.env.UFDS_WEBHOOK_SECRET });
 */
export class UFDSClient {
  constructor(options = {}) {
    this.http = new UFDSHttpClient(options);
    this.menu = new MenuResource(this.http);
    this.orders = new OrdersResource(this.http);
    this.inventory = new InventoryResource(this.http);
    this.analytics = new AnalyticsResource(this.http);
  }

  /** Creates a UFDSWebhookHandler bound to this client's webhook secret. */
  webhooks(options = {}) {
    return new UFDSWebhookHandler(options);
  }
}

export {
  UFDSHttpClient,
  UFDSError,
  ENVIRONMENTS,
  MenuResource,
  OrdersResource,
  InventoryResource,
  AnalyticsResource,
  UFDSWebhookHandler,
  WEBHOOK_EVENTS,
  signPayload,
  verifySignature,
  ONDCAdapter,
  SwiggyAdapter,
  ZomatoAdapter,
};

export default UFDSClient;
