import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toUFDSOrder, ORDER_STATUS_MAP } from '../src/adapters/swiggy.js';

// Synthetic payload shaped per the assumed (UNCONFIRMED) field mapping documented
// at the top of src/adapters/swiggy.js — not a real Swiggy partner API payload.
const samplePayload = {
  order_id: 'SWG-993847123',
  order_time: '2026-06-16T12:44:50Z',
  order_status: 'ACCEPTED',
  customer: {
    name: 'Priya Sharma',
    mobile: '+91XXXXXXXXXX',
    address: 'Flat 4B, Prestige Towers, Banjara Hills, Hyderabad 500034',
  },
  order_items: [
    { id: 'ITEM-001', name: 'Paneer Tikka', quantity: 1, price: 280.0 },
    { id: 'ITEM-040', name: 'Mango Lassi', quantity: 2, price: 110.0 },
  ],
  tax_amount: 35.1,
  delivery_charges: 40.0,
  discount_amount: 0,
  order_total: 575.1,
  payment_mode: 'PREPAID',
  special_instructions: 'Less spicy please',
};

test('toUFDSOrder() maps the documented (unconfirmed) Swiggy field set onto a UFDS Order', () => {
  const order = toUFDSOrder(samplePayload, { restaurantId: 'RST-IN-TS-001' });

  assert.equal(order.source.platform, 'swiggy');
  assert.equal(order.source.platform_order_id, 'SWG-993847123');
  assert.equal(order.restaurant_id, 'RST-IN-TS-001');
  assert.equal(order.status, 'ACCEPTED');
  assert.equal(order.customer.name, 'Priya Sharma');
  assert.equal(order.customer.phone, '+91XXXXXXXXXX');
  assert.equal(order.items.length, 2);
  assert.equal(order.items[0].total_price, 280.0);
  assert.equal(order.items[1].total_price, 220.0);
  assert.equal(order.pricing.total, 575.1);
  assert.equal(order.pricing.payment_status, 'PREPAID');
  assert.equal(order.timestamps.placed, '2026-06-16T12:44:50Z');
  assert.equal(order.special_instructions, 'Less spicy please');
});

test('toUFDSOrder() defaults to PENDING for an unmapped/unknown order_status', () => {
  const order = toUFDSOrder({ ...samplePayload, order_status: 'SOME_UNKNOWN_STATUS' }, { restaurantId: 'RST-IN-TS-001' });
  assert.equal(order.status, 'PENDING');
});

test('ORDER_STATUS_MAP covers every UFDS-relevant lifecycle stage (pending confirmation)', () => {
  // This only asserts internal consistency of the stub's own guesses — it does
  // NOT confirm the strings match real Swiggy payloads (see file header TODOs).
  const mappedStatuses = new Set(Object.values(ORDER_STATUS_MAP));
  for (const status of ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED', 'CANCELLED']) {
    assert.ok(mappedStatuses.has(status), `expected ORDER_STATUS_MAP to cover ${status}`);
  }
});
