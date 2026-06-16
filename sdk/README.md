# UFDS SDKs

Official SDKs for the [Universal Food Delivery Standard](../ufds-spec/api/ufds_v1.0_openapi.yaml) (UFDS) — a single integration point for cloud kitchens connecting to Swiggy, Zomato, ONDC, and direct ordering.

| Package | Language | Path | Registry |
| --- | --- | --- | --- |
| `@ufds/sdk` | JavaScript / TypeScript | [`sdk/javascript`](javascript) | npm |
| `ufds-sdk` | Python | [`sdk/python`](python) | PyPI |

Both SDKs cover the same surface: menu, orders, inventory, analytics, webhook signature verification, and (JavaScript only, for now) platform adapters that normalize raw Swiggy/Zomato/ONDC payloads into UFDS objects.

All endpoints require a Bearer JWT, scoped per restaurant, expiring after 24 hours. Get one from your UFDS dashboard/account before using either SDK.

---

## JavaScript — `@ufds/sdk`

### Install

```bash
npm install @ufds/sdk
```

Ships as a dual ESM/CJS package with hand-written TypeScript declarations (`src/index.d.ts`) — no `@types/` package needed. Requires Node.js >= 18 (uses the global `fetch`).

### Quickstart

```js
import UFDSClient from '@ufds/sdk';

const client = new UFDSClient({
  token: process.env.UFDS_API_TOKEN,
  environment: 'sandbox', // 'production' (default) | 'sandbox'
});

const menu = await client.menu.get('RST-IN-MH-001');
const { orders } = await client.orders.list('RST-IN-MH-001', { status: 'PENDING' });
await client.orders.updateStatus('RST-IN-MH-001', orders[0].id, { status: 'ACCEPTED' });
```

CommonJS:

```js
const { default: UFDSClient } = require('@ufds/sdk');
```

### Menu

```js
await client.menu.get('RST-IN-MH-001');
await client.menu.replace('RST-IN-MH-001', menu); // full Menu object — fans out to all connected platforms
await client.menu.updateItem('RST-IN-MH-001', 'ITEM-001', { available: false, base_price: 299 });
await client.menu.deleteItem('RST-IN-MH-001', 'ITEM-099');
```

### Orders

```js
await client.orders.list('RST-IN-MH-001', { status: 'PENDING', platform: 'swiggy', page: 1, perPage: 20 });
await client.orders.get('RST-IN-MH-001', 'UFDS-ORD-20260616-00142');
await client.orders.updateStatus('RST-IN-MH-001', orderId, { status: 'PREPARING', eta_minutes: 18 });
await client.orders.updateStatus('RST-IN-MH-001', orderId, { status: 'CANCELLED', cancellation_reason: 'ITEM_UNAVAILABLE' });
await client.orders.simulate('RST-IN-MH-001', { platform: 'swiggy', item_ids: ['ITEM-001'] }); // sandbox only
```

### Inventory

```js
await client.inventory.bulkUpdate('RST-IN-MH-001', [
  { item_id: 'ITEM-001', available: true },
  { item_id: 'ITEM-005', available: false, reason: 'SOLD_OUT' },
]);
await client.inventory.updateAvailability('RST-IN-MH-001', 'ITEM-005', { available: true });
```

### Analytics

```js
await client.analytics.get('RST-IN-MH-001', { from: '2026-06-01', to: '2026-06-15', platform: 'swiggy' });
```

### Webhooks

Signature verification is HMAC-SHA256 over the **raw** request body — mount `express.raw()` ahead of the UFDS middleware, not `express.json()`.

```js
import express from 'express';
import UFDSClient from '@ufds/sdk';

const app = express();
const client = new UFDSClient({ token: process.env.UFDS_API_TOKEN });
const webhooks = client.webhooks({ secret: process.env.UFDS_WEBHOOK_SECRET });

webhooks.on('order.new', (payload) => console.log('New order:', payload.order.id));
webhooks.on('order.status_update', (payload) => console.log(payload.order_id, payload.status));
webhooks.on('invalid_signature', (err) => console.warn('Rejected webhook:', err.message));

app.post(
  '/webhooks/ufds',
  express.raw({ type: 'application/json' }),
  webhooks.middleware(),
);
```

Or verify signatures manually without Express:

```js
import { verifySignature } from '@ufds/sdk';

const isValid = verifySignature(secret, rawBodyBuffer, req.headers['x-ufds-signature']);
```

### Platform adapters

`src/adapters/` normalizes platform-native payloads into UFDS Order/Menu objects:

- **`ONDCAdapter`** — real implementation of the Beckn protocol (`on_search` → Menu, `on_confirm`/`on_status` → Order). A handful of ONDC tag-taxonomy fields that vary by BPP are marked `TODO: confirm` in the source rather than guessed.
- **`SwiggyAdapter`** / **`ZomatoAdapter`** — **stubs**. Both platforms' partner APIs are private/NDA-gated, so every field path is an documented, unverified guess (see the `TODO: confirm` comments at the top of each file). Replace them once you have real partner API access.

```js
import { ONDCAdapter } from '@ufds/sdk';

const order = ONDCAdapter.toUFDSOrder(onConfirmPayload, { restaurantId: 'RST-IN-MH-001' });
const menu = ONDCAdapter.toUFDSMenu(onSearchPayload, { restaurantId: 'RST-IN-MH-001' });
```

### TypeScript

```ts
import UFDSClient, { type Order, type OrderStatus, UFDSError } from '@ufds/sdk';

const client = new UFDSClient({ token, environment: 'sandbox' });
const order: Order = (await client.orders.get('RST-IN-MH-001', orderId)).order;
```

Schema types (`Menu`, `Order`, `OrderStatus`, ...) are generated from the OpenAPI spec into `src/types/openapi.d.ts`. Regenerate after a spec change:

```bash
npm run generate:types   # openapi-typescript ../../ufds-spec/api/ufds_v1.0_openapi.yaml -o src/types/openapi.d.ts
npm run typecheck        # tsc --noEmit — also exercises src/index.d.ts via tests/types/smoke.ts
```

### Errors, retries, rate limits

Every non-2xx response raises `UFDSError` (`code`, `category`, `message`, `field?`, `docs?`, `httpStatus`), mapped from the spec's `ErrorResponse` envelope:

```js
import { UFDSError } from '@ufds/sdk';

try {
  await client.orders.updateStatus('RST-IN-MH-001', orderId, { status: 'PREPARING' });
} catch (err) {
  if (err instanceof UFDSError) console.error(err.httpStatus, err.code, err.message);
}
```

5xx responses are retried automatically (3 attempts by default, exponential backoff); 429 responses respect `Retry-After`. Tune via client options: `maxAttempts`, `retryBaseDelayMs`, `timeoutMs`.

### Development

```bash
cd sdk/javascript
npm ci
npm run typecheck
npm test
npm run build
```

---

## Python — `ufds-sdk`

### Install

```bash
pip install ufds-sdk
```

Requires Python >= 3.9. Uses [httpx](https://www.python-httpx.org/) for HTTP.

### Quickstart

```python
import os
from ufds_sdk import UFDSClient

client = UFDSClient(os.environ["UFDS_API_TOKEN"], environment="sandbox")

menu = client.menu.get("RST-IN-MH-001")
orders = client.orders.list("RST-IN-MH-001", status="PENDING")
client.orders.update_status("RST-IN-MH-001", orders["orders"][0]["id"], {"status": "ACCEPTED"})
```

Use as a context manager to close the underlying HTTP connection pool automatically:

```python
with UFDSClient(token, environment="sandbox") as client:
    ...
```

### Menu

```python
client.menu.get("RST-IN-MH-001")
client.menu.replace("RST-IN-MH-001", menu)
client.menu.update_item("RST-IN-MH-001", "ITEM-001", {"available": False, "base_price": 299})
client.menu.delete_item("RST-IN-MH-001", "ITEM-099")
```

### Orders

```python
client.orders.list("RST-IN-MH-001", status="PENDING", platform="swiggy", page=1, per_page=20)
client.orders.get("RST-IN-MH-001", "UFDS-ORD-20260616-00142")
client.orders.update_status("RST-IN-MH-001", order_id, {"status": "PREPARING", "eta_minutes": 18})
client.orders.update_status("RST-IN-MH-001", order_id, {"status": "CANCELLED", "cancellation_reason": "ITEM_UNAVAILABLE"})
client.orders.simulate("RST-IN-MH-001", {"platform": "swiggy", "item_ids": ["ITEM-001"]})  # sandbox only
```

### Inventory

```python
client.inventory.bulk_update(
    "RST-IN-MH-001",
    [
        {"item_id": "ITEM-001", "available": True},
        {"item_id": "ITEM-005", "available": False, "reason": "SOLD_OUT"},
    ],
)
client.inventory.update_availability("RST-IN-MH-001", "ITEM-005", {"available": True})
```

### Analytics

`from_`/`to` (note the trailing underscore on `from_` — `from` is a Python keyword):

```python
client.analytics.get("RST-IN-MH-001", from_="2026-06-01", to="2026-06-15", platform="swiggy")
```

### Webhooks

The Python handler is framework-agnostic — pass it the raw request body and the `X-UFDS-Signature` header from whatever framework you use:

```python
import os
from ufds_sdk import UFDSClient

client = UFDSClient(os.environ["UFDS_API_TOKEN"])
webhooks = client.webhooks(os.environ["UFDS_WEBHOOK_SECRET"])
webhooks.on("order.new", lambda payload: print("New order:", payload["order"]["id"]))

# Flask
from flask import Flask, request

app = Flask(__name__)

@app.post("/webhooks/ufds")
def ufds_webhook():
    webhooks.handle(request.get_data(), request.headers.get("X-UFDS-Signature"))
    return {"received": True}
```

`handle()` raises `UFDSWebhookError` (`code`, `category`) on an invalid signature or malformed payload — catch it to return your own error response.

### Errors, retries, rate limits

Same semantics as the JavaScript SDK: `UFDSError` (`code`, `category`, `field`, `docs`, `http_status`), 3-attempt exponential backoff on 5xx, `Retry-After`-aware 429 handling, tunable via `max_attempts` / `retry_base_delay` / `timeout`.

```python
from ufds_sdk import UFDSError

try:
    client.orders.update_status("RST-IN-MH-001", order_id, {"status": "PREPARING"})
except UFDSError as err:
    print(err.http_status, err.code, err.message)
```

### Development

```bash
cd sdk/python
python -m venv .venv
.venv/bin/pip install -e ".[test]"   # Windows: .venv\Scripts\pip install -e ".[test]"
.venv/bin/pytest -v
```

---

## Environments

| Environment | Base URL |
| --- | --- |
| `production` (default) | `https://api.ufds.dev/v1` |
| `sandbox` | `https://sandbox.ufds.dev/v1` — test orders, no real platform calls |

## CI

[`.github/workflows/test.yml`](../.github/workflows/test.yml) runs on every push/PR to `main`: the JavaScript suite across Node 18/20/22 (type-check, build, test) and the Python suite across Python 3.9–3.13 (install with test extras, pytest).

## Releasing

Each SDK is tagged and published independently:

- **npm**: bump the version in `sdk/javascript/package.json`, then push a tag matching `js-vX.Y.Z` (e.g. `js-v0.2.0`). [`publish-npm.yml`](../.github/workflows/publish-npm.yml) verifies the tag matches `package.json`, runs the full test suite, builds, and publishes with npm provenance. Requires an `NPM_TOKEN` repo secret.
- **PyPI**: bump the version in `sdk/python/pyproject.toml`, then push a tag matching `py-vX.Y.Z` (e.g. `py-v0.2.0`). [`publish-pypi.yml`](../.github/workflows/publish-pypi.yml) verifies the tag, runs pytest, builds the sdist/wheel, and publishes via PyPI trusted publishing (OIDC — no token, but the `ufds-sdk` PyPI project must register this repo + workflow as a trusted publisher once, in PyPI project settings).
