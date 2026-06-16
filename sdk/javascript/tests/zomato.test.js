import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toUFDSOrder, ORDER_STATUS_MAP } from '../src/adapters/zomato.js';

// Synthetic payload shaped per the assumed (UNCONFIRMED) field mapping documented
// at the top of src/adapters/zomato.js — not a real Zomato partner API payload.
const samplePayload = {
  orderId: 'ZOM-554821',
  orderTime: '2026-06-16T12:44:50Z',
  orderStatus: 'CONFIRMED',
  customerInfo: {
    name: 'Priya Sharma',
    phoneNumber: '+91XXXXXXXXXX',
    deliveryAddress: 'Flat 4B, Prestige Towers, Banjara Hills, Hyderabad 500034',
  },
  items: [
    { itemId: 'ITEM-001', itemName: 'Paneer Tikka', qty: 1, unitPrice: 280.0 },
    { itemId: 'ITEM-040', itemName: 'Mango Lassi', qty: 2, unitPrice: 110.0 },
  ],
  charges: {
    taxes: 35.1,
    deliveryFee: 40.0,
    discount: 0,
    totalCost: 575.1,
  },
  paymentType: 'ONLINE',
  instructions: 'Less spicy please',
};

test('toUFDSOrder() maps the documented (unconfirmed) Zomato field set onto a UFDS Order', () => {
  const order = toUFDSOrder(samplePayload, { restaurantId: 'RST-IN-TS-001' });

  assert.equal(order.source.platform, 'zomato');
  assert.equal(order.source.platform_order_id, 'ZOM-554821');
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

test('toUFDSOrder() maps COD paymentType to the COD payment_status', () => {
  const order = toUFDSOrder({ ...samplePayload, paymentType: 'COD' }, { restaurantId: 'RST-IN-TS-001' });
  assert.equal(order.pricing.payment_status, 'COD');
});

test('toUFDSOrder() defaults to PENDING for an unmapped/unknown orderStatus', () => {
  const order = toUFDSOrder({ ...samplePayload, orderStatus: 'SOME_UNKNOWN_STATUS' }, { restaurantId: 'RST-IN-TS-001' });
  assert.equal(order.status, 'PENDING');
});

test('ORDER_STATUS_MAP covers every UFDS-relevant lifecycle stage (pending confirmation)', () => {
  const mappedStatuses = new Set(Object.values(ORDER_STATUS_MAP));
  for (const status of ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED', 'CANCELLED']) {
    assert.ok(mappedStatuses.has(status), `expected ORDER_STATUS_MAP to cover ${status}`);
  }
});
