import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toUFDSOrder, toUFDSMenu, mapOrderStatus, mapCancellationReason } from '../src/adapters/ondc.js';
import { loadLocalFixture } from './helpers/fixtures.js';

const onSearch = loadLocalFixture('ondc_on_search.json');
const onConfirm = loadLocalFixture('ondc_on_confirm.json');

test('toUFDSMenu() normalizes an on_search catalog into a UFDS Menu', () => {
  const menu = toUFDSMenu(onSearch, { restaurantId: 'RST-IN-TS-001' });

  assert.equal(menu.restaurant_id, 'RST-IN-TS-001');
  assert.equal(menu.menu.categories.length, 2);

  const starters = menu.menu.categories.find((c) => c.id === 'CAT-001');
  assert.equal(starters.name, 'Starters');
  assert.equal(starters.items.length, 1);

  const paneerTikka = starters.items[0];
  assert.equal(paneerTikka.id, 'ITEM-001');
  assert.equal(paneerTikka.name, 'Paneer Tikka');
  assert.equal(paneerTikka.base_price, 280.0);
  assert.equal(paneerTikka.currency, 'INR');
  assert.equal(paneerTikka.food_type, 'VEG');
  assert.equal(paneerTikka.available, true);

  const mainCourse = menu.menu.categories.find((c) => c.id === 'CAT-002');
  const butterChicken = mainCourse.items[0];
  assert.equal(butterChicken.food_type, 'NON_VEG');
  assert.equal(butterChicken.available, false);
});

test('toUFDSMenu() throws when no provider is present in the catalog', () => {
  assert.throws(() => toUFDSMenu({ message: { catalog: { 'bpp/providers': [] } } }), /provider/i);
});

test('toUFDSOrder() normalizes an on_confirm payload into a UFDS Order', () => {
  const order = toUFDSOrder(onConfirm, { restaurantId: 'RST-IN-TS-001' });

  assert.equal(order.restaurant_id, 'RST-IN-TS-001');
  assert.deepEqual(order.source, {
    platform: 'ondc',
    platform_order_id: 'ONDC-ORD-9988',
    received_at: '2026-06-16T12:45:00Z',
  });

  // Fulfillment-level state ("Order-picked-up") takes precedence over the
  // coarser order.state ("In-progress").
  assert.equal(order.status, 'PICKED_UP');

  assert.equal(order.customer.name, 'Priya Sharma');
  assert.equal(order.customer.phone, '+91XXXXXXXXXX');
  assert.equal(order.customer.address.lat, 17.4156);
  assert.equal(order.customer.address.lng, 78.4347);
  assert.equal(order.customer.address.full, 'Flat 4B, Road No. 12, Banjara Hills, Hyderabad, 500034');

  assert.equal(order.items.length, 2);
  assert.deepEqual(order.items[0], {
    item_id: 'ITEM-001',
    name: 'Paneer Tikka',
    quantity: 2,
    unit_price: 280,
    customisations: [],
    total_price: 560,
  });

  assert.deepEqual(order.pricing, {
    subtotal: 1010,
    taxes: 99,
    delivery_fee: 49,
    discount: 20,
    total: 1138,
    currency: 'INR',
    payment_status: 'PREPAID',
  });

  assert.equal(order.timestamps.placed, '2026-06-16T12:44:50Z');
  assert.equal('cancellation_reason' in order, false);
});

test('mapOrderStatus() falls back to order.state when no fulfillment state is present', () => {
  assert.equal(mapOrderStatus({ state: 'Cancelled' }), 'CANCELLED');
  assert.equal(mapOrderStatus({ state: 'Created' }), 'PENDING');
  assert.equal(mapOrderStatus({}), 'PENDING');
});

test('toUFDSOrder() maps a cancelled order with a known cancellation_reason_id', () => {
  const cancelledPayload = {
    context: { timestamp: '2026-06-16T13:00:00Z' },
    message: {
      order: {
        id: 'ONDC-ORD-9989',
        state: 'Cancelled',
        cancellation_reason_id: '012',
        created_at: '2026-06-16T12:50:00Z',
        items: [],
        billing: { name: 'Test User' },
        quote: { price: { currency: 'INR', value: '0.00' }, breakup: [] },
      },
    },
  };

  const order = toUFDSOrder(cancelledPayload, { restaurantId: 'RST-IN-TS-001' });

  assert.equal(order.status, 'CANCELLED');
  assert.equal(order.cancellation_reason, 'ITEM_UNAVAILABLE');
  assert.equal(mapCancellationReason({ cancellation_reason_id: '999' }), undefined);
});

test('toUFDSOrder() throws when message.order is missing', () => {
  assert.throws(() => toUFDSOrder({ message: {} }), /message\.order/);
});
