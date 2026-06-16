/**
 * Zomato Order Partner API Adapter — STUB, UNVERIFIED.
 *
 * Zomato's order/POS-integration API is only available under a signed partner
 * agreement and its schema is not publicly documented. Every field path below
 * is a best-effort placeholder inferred from commonly referenced POS-integration
 * write-ups — none of it has been verified against a real Zomato payload.
 *
 * Before relying on this in production:
 *   1. Get partner API access and capture a real order-webhook payload.
 *   2. Walk every `// TODO: confirm` below against that payload and fix the
 *      field path / casing / status enum.
 *   3. Confirm the webhook delivery contract (retry semantics, signature
 *      scheme — Zomato's may differ from the UFDS X-UFDS-Signature scheme).
 *
 * Menu/inventory sync with Zomato is outbound (UFDS pushes to Zomato's
 * partner API), not inbound — that direction is out of scope for this file.
 *
 * ── Documented field mapping (UNCONFIRMED) ──────────────────────────────────
 *
 *   Zomato (assumed)                       → UFDS
 *   ─────────────────────────────────────────────────────────────────────────
 *   orderId                                → source.platform_order_id
 *   orderTime | placedAt                   → timestamps.placed
 *   customerInfo.name                      → customer.name
 *   customerInfo.phoneNumber                → customer.phone
 *   customerInfo.deliveryAddress           → customer.address.full
 *   items[].itemId                         → items[].item_id
 *   items[].itemName                       → items[].name
 *   items[].qty                            → items[].quantity
 *   items[].unitPrice                      → items[].unit_price
 *   items[].addons[]                       → items[].customisations  (TODO: confirm shape)
 *   charges.totalCost | charges.grandTotal → pricing.total
 *   charges.taxes                          → pricing.taxes
 *   charges.deliveryFee                    → pricing.delivery_fee
 *   charges.discount                       → pricing.discount
 *   paymentType ('ONLINE' | 'COD')         → pricing.payment_status
 *   orderStatus                            → status                  (see ORDER_STATUS_MAP)
 *   instructions                           → special_instructions
 */

// TODO: confirm every key here against a real Zomato payload — these are guesses.
export const ORDER_STATUS_MAP = {
  PLACED: 'PENDING',
  CONFIRMED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY', // TODO: confirm exact enum string
  RIDER_ASSIGNED: 'READY', // TODO: confirm — may warrant its own intermediate state
  PICKED_UP: 'PICKED_UP',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

/**
 * Normalizes an (assumed) Zomato order webhook payload into a UFDS Order.
 * STUB — see file header. Every field access below is unconfirmed.
 */
export function toUFDSOrder(zomatoPayload, { restaurantId } = {}) {
  const order = zomatoPayload || {};

  return {
    source: {
      platform: 'zomato',
      platform_order_id: order.orderId, // TODO: confirm field name
      received_at: new Date().toISOString(),
    },
    restaurant_id: restaurantId,
    status: ORDER_STATUS_MAP[order.orderStatus] || 'PENDING', // TODO: confirm status enum values
    customer: {
      name: order.customerInfo?.name, // TODO: confirm
      phone: order.customerInfo?.phoneNumber, // TODO: confirm
      address: order.customerInfo?.deliveryAddress
        ? { full: order.customerInfo.deliveryAddress }
        : undefined, // TODO: confirm — may be structured rather than a single string
    },
    items: (order.items || []).map((item) => ({
      item_id: item.itemId, // TODO: confirm
      name: item.itemName,
      quantity: item.qty,
      unit_price: item.unitPrice,
      customisations: [], // TODO: confirm addon/customisation shape (item.addons? item.modifiers?)
      total_price: round2((item.unitPrice || 0) * (item.qty || 1)),
    })),
    pricing: {
      // TODO: confirm whether Zomato sends `subtotal` directly, or whether it
      // must be derived once the charges field names below are confirmed.
      taxes: order.charges?.taxes, // TODO: confirm
      delivery_fee: order.charges?.deliveryFee, // TODO: confirm
      discount: order.charges?.discount, // TODO: confirm
      total: order.charges?.totalCost ?? order.charges?.grandTotal, // TODO: confirm which field is authoritative
      currency: 'INR',
      payment_status: order.paymentType === 'COD' ? 'COD' : 'PREPAID', // TODO: confirm paymentType values
    },
    timestamps: {
      placed: order.orderTime || order.placedAt, // TODO: confirm
    },
    special_instructions: order.instructions, // TODO: confirm field name
  };
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const ZomatoAdapter = { toUFDSOrder, ORDER_STATUS_MAP };
export default ZomatoAdapter;
