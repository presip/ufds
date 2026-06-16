export class InventoryResource {
  constructor(http) {
    this.http = http;
  }

  /**
   * POST /inventory/{restaurant_id} — push availability for multiple items in one call.
   * items: InventoryItem[] — [{ item_id, available, stock_count?, reason? }]
   */
  bulkUpdate(restaurantId, items, { ufdsVersion = '1.0', timestamp } = {}) {
    return this.http.post(`/inventory/${encodeURIComponent(restaurantId)}`, {
      body: {
        ufds_version: ufdsVersion,
        timestamp: timestamp || new Date().toISOString(),
        restaurant_id: restaurantId,
        items,
      },
    });
  }

  /** PATCH /inventory/{restaurant_id}/{item_id} — toggle a single item's availability */
  updateAvailability(restaurantId, itemId, patch) {
    return this.http.patch(
      `/inventory/${encodeURIComponent(restaurantId)}/${encodeURIComponent(itemId)}`,
      { body: { item_id: itemId, ...patch } },
    );
  }
}
