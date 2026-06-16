/**
 * Swiggy Partner API Adapter — STUB, UNVERIFIED.
 *
 * Swiggy's Partner/Order-Stream API is only available under a signed partner
 * agreement and its schema is not publicly documented. Every field path below
 * is a best-effort placeholder inferred from commonly referenced POS-integration
 * write-ups — none of it has been verified against a real Swiggy payload.
 *
 * Before relying on this in production:
 *   1. Get partner API access and capture a real order-webhook payload.
 *   2. Walk every `// TODO: confirm` below against that payload and fix the
 *      field path / casing / status enum.
 *   3. Confirm the webhook delivery contract (retry semantics, signature
 *      scheme — Swiggy's may differ from the UFDS X-UFDS-Signature scheme).
 *
 * Menu/inventory sync with Swiggy is outbound (UFDS pushes to Swiggy's
 * Partner API), not inbound — that direction is out of scope for this file.
 *
 * ── Documented field mapping (UNCONFIRMED) ──────────────────────────────────
 *
 *   Swiggy (assumed)                  → UFDS
 *   ─────────────────────────────────────────────────────────────────────────
 *   order_id                          → source.platform_order_id
 *   order_time | created_at           → timestamps.placed
 *   customer.name                     → customer.name
 *   customer.mobile                   → customer.phone
 *   customer.address                  → customer.address.full
 *   order_items[].id                  → items[].item_id
 *   order_items[].name                → items[].name
 *   order_items[].quantity            → items[].quantity
 *   order_items[].price               → items[].unit_price
 *   order_items[].variants[]          → items[].customisations  (TODO: confirm shape)
 *   order_total | bill_total          → pricing.total
 *   tax_amount                        → pricing.taxes
 *   delivery_charges                  → pricing.delivery_fee
 *   discount_amount                   → pricing.discount
 *   payment_mode ('PREPAID' | 'COD')  → pricing.payment_status
 *   order_status                      → status                  (see ORDER_STATUS_MAP)
 *   special_instructions              → special_instructions
 */

// TODO: confirm every key here against a real Swiggy payload — these are guesses.
export const ORDER_STATUS_MAP = {
  PLACED: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  FOOD_PREPARING: 'PREPARING',
  FOOD_READY: 'READY',
  OUT_FOR_PICKUP: 'READY', // TODO: confirm — may warrant its own intermediate state
  PICKED_UP: 'PICKED_UP',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

/**
 * Normalizes an (assumed) Swiggy order webhook payload into a UFDS Order.
 * STUB — see file header. Every field access below is unconfirmed.
 */
export function toUFDSOrder(swiggyPayload, { restaurantId } = {}) {
  const order = swiggyPayload || {};

  return {
    source: {
      platform: 'swiggy',
      platform_order_id: order.order_id, // TODO: confirm field name
      received_at: new Date().toISOString(),
    },
    restaurant_id: restaurantId,
    status: ORDER_STATUS_MAP[order.order_status] || 'PENDING', // TODO: confirm status enum values
    customer: {
      name: order.customer?.name, // TODO: confirm
      phone: order.customer?.mobile, // TODO: confirm
      address: order.customer?.address ? { full: order.customer.address } : undefined, // TODO: confirm — may be structured (street/city/pincode) rather than a single string
    },
    items: (order.order_items || []).map((item) => ({
      item_id: item.id, // TODO: confirm
      name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      customisations: [], // TODO: confirm variant/add-on shape (item.variants? item.addons?)
      total_price: round2((item.price || 0) * (item.quantity || 1)),
    })),
    pricing: {
      // TODO: confirm whether Swiggy sends `subtotal` directly, or whether it
      // must be derived as total - taxes - delivery + discount once field
      // names below are confirmed.
      taxes: order.tax_amount, // TODO: confirm
      delivery_fee: order.delivery_charges, // TODO: confirm
      discount: order.discount_amount, // TODO: confirm
      total: order.order_total ?? order.bill_total, // TODO: confirm which field is authoritative
      currency: 'INR',
      payment_status: order.payment_mode === 'COD' ? 'COD' : 'PREPAID', // TODO: confirm payment_mode values
    },
    timestamps: {
      placed: order.order_time || order.created_at, // TODO: confirm
    },
    special_instructions: order.special_instructions, // TODO: confirm field name
  };
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const SwiggyAdapter = { toUFDSOrder, ORDER_STATUS_MAP };
export default SwiggyAdapter;
