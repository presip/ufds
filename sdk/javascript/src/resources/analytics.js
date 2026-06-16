export class AnalyticsResource {
  constructor(http) {
    this.http = http;
  }

  /**
   * GET /analytics/{restaurant_id} — unified cross-platform metrics.
   * `from` and `to` are required (YYYY-MM-DD); `platform` filters to one platform.
   */
  get(restaurantId, { from, to, platform } = {}) {
    return this.http.get(`/analytics/${encodeURIComponent(restaurantId)}`, {
      query: { from, to, platform },
    });
  }
}
