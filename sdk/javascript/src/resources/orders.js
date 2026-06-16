export class OrdersResource {
  constructor(http) {
    this.http = http;
  }

  /** GET /orders/{restaurant_id} — filterable, paginated list */
  list(restaurantId, { status, platform, from, to, page, perPage } = {}) {
    return this.http.get(`/orders/${encodeURIComponent(restaurantId)}`, {
      query: { status, platform, from, to, page, per_page: perPage },
    });
  }

  /** GET /orders/{restaurant_id}/{order_id} */
  get(restaurantId, orderId) {
    return this.http.get(
      `/orders/${encodeURIComponent(restaurantId)}/${encodeURIComponent(orderId)}`,
    );
  }

  /**
   * PATCH /orders/{restaurant_id}/{order_id}
   * statusUpdate: { status, cancellation_reason?, eta_minutes? }
   */
  updateStatus(restaurantId, orderId, statusUpdate) {
    return this.http.patch(
      `/orders/${encodeURIComponent(restaurantId)}/${encodeURIComponent(orderId)}`,
      { body: statusUpdate },
    );
  }

  /**
   * POST /orders/{restaurant_id}/simulate — sandbox only.
   * payload: { platform?, item_ids? }
   */
  simulate(restaurantId, payload = {}) {
    return this.http.post(`/orders/${encodeURIComponent(restaurantId)}/simulate`, {
      body: payload,
    });
  }
}
