/**
 * ONDC (Beckn Protocol) Adapter
 *
 * Normalizes Beckn protocol payloads (https://github.com/beckn/protocol-specifications)
 * exchanged between an ONDC Buyer App (BAP) and a Seller App (BPP) into UFDS
 * canonical Menu and Order objects:
 *
 *   - on_search                 → UFDS Menu  (toUFDSMenu)
 *   - on_confirm / on_status    → UFDS Order (toUFDSOrder)
 *
 * Beckn is an open spec, but individual BPP/logistics-provider implementations
 * vary in which optional fields and tag taxonomies they actually populate.
 * Anywhere this adapter relies on a field whose presence/shape isn't guaranteed
 * by the core spec, it's called out with a `TODO: confirm` comment — verify
 * against your live network before depending on it in production.
 */

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Beckn order.state — the high-level order lifecycle (core spec, stable).
const ORDER_STATE_TO_UFDS_STATUS = {
  Created: 'PENDING',
  Accepted: 'ACCEPTED',
  'In-progress': 'PREPARING',
  Completed: 'DELIVERED',
  Cancelled: 'CANCELLED',
};

// Beckn fulfillments[].state.descriptor.code — more granular logistics status,
// takes precedence over order.state when present. Exact code strings are set by
// the BPP's logistics provider (LOG10/LOG11 in ONDC's network extension) and can
// vary across providers.
// TODO: confirm this code list against your live ONDC logistics provider.
const FULFILLMENT_STATE_TO_UFDS_STATUS = {
  Pending: 'PENDING',
  Packed: 'PREPARING',
  'Agent-assigned': 'PREPARING',
  'Order-picked-up': 'PICKED_UP',
  'Out-for-delivery': 'PICKED_UP',
  'Order-delivered': 'DELIVERED',
  Cancelled: 'CANCELLED',
  'RTO-Initiated': 'CANCELLED', // TODO: confirm whether RTO should map to CANCELLED or a distinct UFDS state
  'RTO-Delivered': 'CANCELLED', // TODO: same as above
};

// ONDC's cancellation taxonomy assigns numeric `cancellation_reason_id` codes that
// differ by domain/version (see ONDC-Org/protocol-network-extension). Only the
// handful of self-evident codes are mapped here.
// TODO: confirm the authoritative code list for the RET11 (F&B) domain and extend.
const CANCELLATION_REASON_MAP = {
  '001': 'CUSTOMER_REQUEST', // TODO: confirm — assumed "Buyer wants to cancel/modify order"
  '012': 'ITEM_UNAVAILABLE', // TODO: confirm — assumed "Product not available"
  '017': 'RESTAURANT_CLOSED', // TODO: confirm — assumed "Seller rejected the order"
};

// RET11 (F&B) commonly tags veg/non-veg via a `veg_nonveg` tag group with a
// 'yes'/'no' value, which only distinguishes VEG from everything else.
// TODO: confirm whether EGG/VEGAN have dedicated tag values in your network, or
// whether they must be inferred from a different tag group entirely.
const FOOD_TYPE_TAG_VALUES = {
  veg: 'VEG',
  nonveg: 'NON_VEG',
  'non-veg': 'NON_VEG',
  no: 'NON_VEG',
  egg: 'EGG',
  vegan: 'VEGAN',
};

export function mapOrderStatus(becknOrder) {
  const fulfillmentCode = becknOrder?.fulfillments?.[0]?.state?.descriptor?.code;
  if (fulfillmentCode && FULFILLMENT_STATE_TO_UFDS_STATUS[fulfillmentCode]) {
    return FULFILLMENT_STATE_TO_UFDS_STATUS[fulfillmentCode];
  }
  const orderState = becknOrder?.state;
  if (orderState && ORDER_STATE_TO_UFDS_STATUS[orderState]) {
    return ORDER_STATE_TO_UFDS_STATUS[orderState];
  }
  return 'PENDING';
}

export function mapCancellationReason(becknOrder) {
  const code = becknOrder?.cancellation_reason_id;
  return CANCELLATION_REASON_MAP[code]; // undefined when the code is unmapped — caller should omit the field rather than guess.
}

function mapPaymentStatus(payment) {
  if (!payment) return 'PENDING';
  // Beckn payment.status: 'PAID' | 'NOT-PAID'.
  // payment.type: 'ON-FULFILLMENT' (≈ COD) | 'PRE-FULFILLMENT' / 'PRE-ORDER' (≈ prepaid).
  if (payment.status === 'PAID') return 'PREPAID';
  if (payment.type === 'ON-FULFILLMENT') return 'COD';
  return 'PENDING';
}

function mapFoodType(item) {
  const vegTag = (item.tags || [])
    .flatMap((group) => group.list || [])
    .find((entry) => entry.code === 'veg_nonveg' || entry.code === 'type'); // TODO: confirm tag code
  if (!vegTag) return 'VEG'; // TODO: pick a safer default once the real tag is confirmed
  return FOOD_TYPE_TAG_VALUES[String(vegTag.value).toLowerCase()] || 'VEG';
}

function toUFDSAddress(location) {
  if (!location) return undefined;
  const address = location.address || {};
  const full = [address.building, address.street, address.locality, address.city, address.area_code]
    .filter(Boolean)
    .join(', ');
  const [lat, lng] = String(location.gps || '')
    .split(',')
    .map(Number);
  return {
    full: full || undefined,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
  };
}

// Beckn typically models item customisations as sibling order items carrying a
// `parent_item_id` back-reference, tagged via a 'child'/'customisation' tag group —
// but seller apps implement this inconsistently.
// TODO: confirm the exact tag/group taxonomy your BPP uses and extend this
// function. Until then, customisations are left empty rather than guessed.
function toUFDSCustomisations(_item) {
  return [];
}

function toUFDSOrderItem(item) {
  const quantity = item?.quantity?.count ?? 1;
  const unitPrice = parseFloat(item?.price?.value ?? '0');
  return {
    item_id: item.id,
    name: item.descriptor?.name || item.id, // TODO: order-line items sometimes omit `descriptor`, requiring a lookup against the original on_search catalog by item.id
    quantity,
    unit_price: unitPrice,
    customisations: toUFDSCustomisations(item),
    total_price: round2(unitPrice * quantity),
  };
}

function toUFDSPricing(order) {
  const breakup = order?.quote?.breakup || [];
  // ONDC quote.breakup entries are commonly tagged via `@ondc/org/title_type`
  // (e.g. "item", "tax", "delivery", "discount") rather than free-text `title`.
  // TODO: confirm the title_type taxonomy for RET11 and replace this substring
  // matching with exact title_type comparisons.
  const find = (pattern) =>
    breakup.find((entry) => pattern.test(entry['@ondc/org/title_type'] || entry.title || ''));

  const taxEntry = find(/tax/i);
  const deliveryEntry = find(/delivery|shipping/i);
  const discountEntry = find(/discount/i);

  const total = parseFloat(order?.quote?.price?.value ?? '0');
  const taxes = parseFloat(taxEntry?.price?.value ?? '0');
  const deliveryFee = parseFloat(deliveryEntry?.price?.value ?? '0');
  const discount = Math.abs(parseFloat(discountEntry?.price?.value ?? '0'));
  const subtotal = round2(total - taxes - deliveryFee + discount);

  return {
    subtotal,
    taxes,
    delivery_fee: deliveryFee,
    discount,
    total,
    currency: order?.quote?.price?.currency || 'INR',
    payment_status: mapPaymentStatus(order?.payment),
  };
}

/**
 * Normalizes a Beckn on_confirm/on_status payload into a UFDS Order.
 *
 * Note: this adapter is stateless and only sees the current payload, so it
 * cannot reconstruct the full accepted/ready/picked_up/delivered timestamp
 * history — only `placed` (from order.created_at) is populated. Callers
 * transitioning an order's status should stamp the corresponding UFDS
 * timestamp themselves at the moment they observe the transition.
 */
export function toUFDSOrder(becknPayload, { restaurantId } = {}) {
  const order = becknPayload?.message?.order;
  if (!order) {
    throw new Error('ONDC adapter: payload.message.order is missing.');
  }

  const billing = order.billing || {};
  const fulfillment = order.fulfillments?.[0] || {};
  const customerPerson = fulfillment.customer?.person || {};
  const customerContact = fulfillment.customer?.contact || {};
  const deliveryEnd = fulfillment.end || {};

  const status = mapOrderStatus(order);
  const cancellationReason = status === 'CANCELLED' ? mapCancellationReason(order) : undefined;

  return {
    source: {
      platform: 'ondc',
      platform_order_id: order.id,
      received_at: becknPayload?.context?.timestamp || new Date().toISOString(),
    },
    restaurant_id: restaurantId,
    status,
    customer: {
      name: customerPerson.name || billing.name, // TODO: confirm fallback precedence between fulfillment.customer.person and billing
      phone: customerContact.phone || billing.phone,
      address: toUFDSAddress(deliveryEnd.location),
    },
    items: (order.items || []).map(toUFDSOrderItem),
    pricing: toUFDSPricing(order),
    timestamps: {
      placed: order.created_at || becknPayload?.context?.timestamp,
    },
    ...(cancellationReason ? { cancellation_reason: cancellationReason } : {}),
  };
}

/**
 * Normalizes a Beckn on_search payload into a UFDS Menu for a single provider.
 * Assumes one BPP provider per restaurant (the standard topology for a cloud
 * kitchen seller app) — see TODO below if a single catalog response ever
 * bundles multiple providers.
 */
export function toUFDSMenu(becknPayload, { restaurantId } = {}) {
  const providers = becknPayload?.message?.catalog?.['bpp/providers'] || [];
  const provider = providers[0]; // TODO: confirm provider selection if a catalog response can bundle multiple providers
  if (!provider) {
    throw new Error('ONDC adapter: payload.message.catalog["bpp/providers"] is missing or empty.');
  }

  const categoriesById = new Map();
  (provider.categories || []).forEach((category, index) => {
    categoriesById.set(category.id, {
      id: category.id,
      name: category.descriptor?.name || category.id,
      display_order: index + 1, // TODO: Beckn categories don't carry an explicit display order field — confirm whether tag-based ordering should be used instead
      available: true,
      items: [],
    });
  });

  for (const item of provider.items || []) {
    const category = categoriesById.get(item.category_id);
    if (!category) continue; // TODO: decide how to handle items with no matching category_id (currently dropped)
    category.items.push(toUFDSMenuItem(item));
  }

  return {
    ufds_version: '1.0',
    timestamp: new Date().toISOString(),
    restaurant_id: restaurantId,
    menu: {
      last_updated: becknPayload?.context?.timestamp || new Date().toISOString(),
      categories: Array.from(categoriesById.values()),
    },
  };
}

function toUFDSMenuItem(item) {
  return {
    id: item.id,
    name: item.descriptor?.name,
    description: item.descriptor?.long_desc || item.descriptor?.short_desc,
    base_price: parseFloat(item.price?.value ?? '0'),
    currency: item.price?.currency || 'INR',
    food_type: mapFoodType(item),
    available: (item.quantity?.available?.count ?? 1) > 0, // TODO: confirm the field ONDC uses to flag sold-out items
    customisations: [], // TODO: see toUFDSCustomisations above — same tag-taxonomy uncertainty applies catalog-side
    tags: [],
    prep_time_minutes: undefined, // TODO: confirm the tag/field carrying prep time (commonly `@ondc/org/time_to_ship` — verify against the live BPP)
    image_url: item.descriptor?.images?.[0],
  };
}

export const ONDCAdapter = { toUFDSOrder, toUFDSMenu, mapOrderStatus, mapCancellationReason };
export default ONDCAdapter;
