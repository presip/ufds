/**
 * Hand-written type declarations for the @ufds/sdk public API.
 *
 * Schema types (Menu, Order, OrderStatus, ...) are NOT hand-written — they're
 * imported from `./types/openapi.d.ts`, which is auto-generated from the spec:
 *
 *   npm run generate:types
 *   # runs: openapi-typescript ../../ufds-spec/api/ufds_v1.0_openapi.yaml -o src/types/openapi.d.ts
 *
 * Re-run that whenever ufds-spec/api/ufds_v1.0_openapi.yaml changes, then update
 * the method signatures below if the shapes they reference moved.
 */

import type { components } from './types/openapi.js';

// ── Schema type aliases (re-exported for consumer convenience) ─────────────

export type UFDSEnvelope = components['schemas']['UFDSEnvelope'];
export type ErrorResponse = components['schemas']['ErrorResponse'];

export type FoodType = components['schemas']['FoodType'];
export type OrderStatus = components['schemas']['OrderStatus'];
export type Platform = components['schemas']['Platform'];
export type CancellationReason = components['schemas']['CancellationReason'];
export type UnavailabilityReason = components['schemas']['UnavailabilityReason'];

export type CustomisationOption = components['schemas']['CustomisationOption'];
export type CustomisationGroup = components['schemas']['CustomisationGroup'];
export type MenuItem = components['schemas']['MenuItem'];
export type MenuCategory = components['schemas']['MenuCategory'];
export type Menu = components['schemas']['Menu'];

export type Address = components['schemas']['Address'];
export type Customer = components['schemas']['Customer'];
export type OrderItemCustomisation = components['schemas']['OrderItemCustomisation'];
export type OrderItem = components['schemas']['OrderItem'];
export type OrderPricing = components['schemas']['OrderPricing'];
export type OrderTimestamps = components['schemas']['OrderTimestamps'];
export type OrderSource = components['schemas']['OrderSource'];
export type Order = components['schemas']['Order'];
export type OrderResponse = components['schemas']['OrderResponse'];
export type OrderListResponse = components['schemas']['OrderListResponse'];
export type OrderStatusUpdate = components['schemas']['OrderStatusUpdate'];

export type InventoryItem = components['schemas']['InventoryItem'];
export type InventoryUpdate = components['schemas']['InventoryUpdate'];

export type PlatformMetrics = components['schemas']['PlatformMetrics'];
export type TopItem = components['schemas']['TopItem'];
export type AnalyticsResponse = components['schemas']['AnalyticsResponse'];

export type WebhookOrderNew = components['schemas']['WebhookOrderNew'];
export type WebhookOrderStatusUpdate = components['schemas']['WebhookOrderStatusUpdate'];
export type WebhookOrderCancelled = components['schemas']['WebhookOrderCancelled'];
export type WebhookPlatformOffline = components['schemas']['WebhookPlatformOffline'];
export type WebhookMenuSyncFailed = components['schemas']['WebhookMenuSyncFailed'];

export type UFDSWebhookPayload =
  | WebhookOrderNew
  | WebhookOrderStatusUpdate
  | WebhookOrderCancelled
  | WebhookPlatformOffline
  | WebhookMenuSyncFailed;

// ── client.js ────────────────────────────────────────────────────────────

export type Environment = 'production' | 'sandbox';

export const ENVIRONMENTS: Readonly<Record<Environment, string>>;

export type ErrorCategory = 'AUTH' | 'VALIDATION' | 'STATE' | 'PLATFORM' | 'INTERNAL';

export interface UFDSErrorOptions {
  message: string;
  code?: string;
  category?: ErrorCategory;
  field?: string;
  docs?: string;
  httpStatus?: number;
  cause?: unknown;
}

export class UFDSError extends Error {
  constructor(options: UFDSErrorOptions);
  code: string;
  category: ErrorCategory;
  field?: string;
  docs?: string;
  httpStatus?: number;

  static fromResponseBody(body: ErrorResponse | null | undefined, httpStatus: number): UFDSError;
  static network(message: string, cause?: unknown): UFDSError;
}

export interface UFDSHttpClientOptions {
  token: string;
  environment?: Environment;
  baseUrl?: string;
  /** Total number of HTTP attempts (initial + retries) before giving up. Default 3. */
  maxAttempts?: number;
  /** Base delay in ms for exponential backoff between retries. Default 300. */
  retryBaseDelayMs?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export class UFDSHttpClient {
  constructor(options: UFDSHttpClientOptions);
  token: string;
  baseUrl: string;
  maxAttempts: number;

  get<T = unknown>(path: string, opts?: RequestOptions): Promise<T>;
  post<T = unknown>(path: string, opts?: RequestOptions): Promise<T>;
  put<T = unknown>(path: string, opts?: RequestOptions): Promise<T>;
  patch<T = unknown>(path: string, opts?: RequestOptions): Promise<T>;
  delete<T = unknown>(path: string, opts?: RequestOptions): Promise<T>;
  request<T = unknown>(method: string, path: string, opts?: RequestOptions): Promise<T>;
}

// ── resources/menu.js ────────────────────────────────────────────────────

export class MenuResource {
  constructor(http: UFDSHttpClient);
  http: UFDSHttpClient;

  get(restaurantId: string): Promise<Menu>;
  replace(restaurantId: string, menu: Menu): Promise<Menu>;
  updateItem(restaurantId: string, itemId: string, patch: Partial<MenuItem>): Promise<MenuItem>;
  deleteItem(restaurantId: string, itemId: string): Promise<null>;
}

// ── resources/orders.js ──────────────────────────────────────────────────

export interface OrdersListParams {
  status?: OrderStatus;
  platform?: Platform;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}

export interface OrderSimulatePayload {
  platform?: Platform;
  item_ids?: string[];
}

export class OrdersResource {
  constructor(http: UFDSHttpClient);
  http: UFDSHttpClient;

  list(restaurantId: string, params?: OrdersListParams): Promise<OrderListResponse>;
  get(restaurantId: string, orderId: string): Promise<OrderResponse>;
  updateStatus(restaurantId: string, orderId: string, statusUpdate: OrderStatusUpdate): Promise<OrderResponse>;
  simulate(restaurantId: string, payload?: OrderSimulatePayload): Promise<OrderResponse>;
}

// ── resources/inventory.js ───────────────────────────────────────────────

export interface InventoryBulkUpdateOptions {
  ufdsVersion?: string;
  timestamp?: string;
}

export interface InventoryBulkUpdateResult {
  ufds_version: string;
  synced_platforms: string[];
  failed_platforms: string[];
}

export class InventoryResource {
  constructor(http: UFDSHttpClient);
  http: UFDSHttpClient;

  bulkUpdate(
    restaurantId: string,
    items: InventoryItem[],
    options?: InventoryBulkUpdateOptions,
  ): Promise<InventoryBulkUpdateResult>;
  updateAvailability(restaurantId: string, itemId: string, patch: Partial<InventoryItem>): Promise<InventoryItem>;
}

// ── resources/analytics.js ───────────────────────────────────────────────

export interface AnalyticsGetParams {
  from: string;
  to: string;
  platform?: Platform;
}

export class AnalyticsResource {
  constructor(http: UFDSHttpClient);
  http: UFDSHttpClient;

  get(restaurantId: string, params: AnalyticsGetParams): Promise<AnalyticsResponse>;
}

// ── webhooks/signature.js ────────────────────────────────────────────────

export function signPayload(secret: string, rawBody: Buffer | string): string;
export function verifySignature(
  secret: string,
  rawBody: Buffer | string,
  signature: string | null | undefined,
): boolean;

// ── webhooks/handler.js ──────────────────────────────────────────────────

export const WEBHOOK_EVENTS: readonly [
  'order.new',
  'order.status_update',
  'order.cancelled',
  'platform.offline',
  'menu.sync_failed',
];

export interface UFDSWebhookRequest {
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
  ufdsEvent?: UFDSWebhookPayload;
  [key: string]: unknown;
}

export interface UFDSWebhookResponse {
  status(code: number): UFDSWebhookResponse;
  json(body: unknown): UFDSWebhookResponse;
}

export type UFDSWebhookNextFunction = (err?: unknown) => void;

export type UFDSWebhookMiddleware = (
  req: UFDSWebhookRequest,
  res: UFDSWebhookResponse,
  next: UFDSWebhookNextFunction,
) => void;

export class UFDSWebhookHandler {
  constructor(options: { secret: string });
  secret: string;

  middleware(): UFDSWebhookMiddleware;

  on(event: 'order.new', listener: (payload: WebhookOrderNew) => void): this;
  on(event: 'order.status_update', listener: (payload: WebhookOrderStatusUpdate) => void): this;
  on(event: 'order.cancelled', listener: (payload: WebhookOrderCancelled) => void): this;
  on(event: 'platform.offline', listener: (payload: WebhookPlatformOffline) => void): this;
  on(event: 'menu.sync_failed', listener: (payload: WebhookMenuSyncFailed) => void): this;
  on(event: 'event', listener: (payload: UFDSWebhookPayload) => void): this;
  on(event: 'invalid_signature' | 'malformed_payload', listener: (error: Error) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

// ── adapters/ondc.js ─────────────────────────────────────────────────────

export interface ONDCAdapterOptions {
  restaurantId?: string;
}

export interface ONDCAdapterApi {
  toUFDSOrder(becknPayload: unknown, options?: ONDCAdapterOptions): Order;
  toUFDSMenu(becknPayload: unknown, options?: ONDCAdapterOptions): Menu;
  mapOrderStatus(becknOrder: unknown): OrderStatus;
  mapCancellationReason(becknOrder: unknown): CancellationReason | undefined;
}

export const ONDCAdapter: ONDCAdapterApi;

// ── adapters/swiggy.js & adapters/zomato.js (STUBS — see file headers) ────

export interface PlatformAdapterOptions {
  restaurantId?: string;
}

export interface PlatformAdapterApi {
  /** STUB — field paths are unverified against the real partner API. */
  toUFDSOrder(platformPayload: unknown, options?: PlatformAdapterOptions): Order;
  ORDER_STATUS_MAP: Record<string, OrderStatus>;
}

export const SwiggyAdapter: PlatformAdapterApi;
export const ZomatoAdapter: PlatformAdapterApi;

// ── index.js ─────────────────────────────────────────────────────────────

export class UFDSClient {
  constructor(options: UFDSHttpClientOptions);
  http: UFDSHttpClient;
  menu: MenuResource;
  orders: OrdersResource;
  inventory: InventoryResource;
  analytics: AnalyticsResource;

  webhooks(options: { secret: string }): UFDSWebhookHandler;
}

export default UFDSClient;
