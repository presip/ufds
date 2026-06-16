export class MenuResource {
  constructor(http) {
    this.http = http;
  }

  /** GET /menu/{restaurant_id} */
  get(restaurantId) {
    return this.http.get(`/menu/${encodeURIComponent(restaurantId)}`);
  }

  /** PUT /menu/{restaurant_id} — replaces the full menu */
  replace(restaurantId, menu) {
    return this.http.put(`/menu/${encodeURIComponent(restaurantId)}`, { body: menu });
  }

  /** PATCH /menu/{restaurant_id}/items/{item_id} — partial update of one item */
  updateItem(restaurantId, itemId, patch) {
    return this.http.patch(
      `/menu/${encodeURIComponent(restaurantId)}/items/${encodeURIComponent(itemId)}`,
      { body: patch },
    );
  }

  /** DELETE /menu/{restaurant_id}/items/{item_id} */
  deleteItem(restaurantId, itemId) {
    return this.http.delete(
      `/menu/${encodeURIComponent(restaurantId)}/items/${encodeURIComponent(itemId)}`,
    );
  }
}
