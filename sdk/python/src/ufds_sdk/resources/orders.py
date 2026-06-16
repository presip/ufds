from __future__ import annotations

from typing import Any, Mapping, Optional
from urllib.parse import quote

from ..client import UFDSHttpClient


class OrdersResource:
    def __init__(self, http: UFDSHttpClient) -> None:
        self.http = http

    def list(
        self,
        restaurant_id: str,
        *,
        status: Optional[str] = None,
        platform: Optional[str] = None,
        from_: Optional[str] = None,
        to: Optional[str] = None,
        page: Optional[int] = None,
        per_page: Optional[int] = None,
    ) -> Any:
        """GET /orders/{restaurant_id} — filterable, paginated list"""
        return self.http.get(
            f"/orders/{quote(restaurant_id, safe='')}",
            query={
                "status": status,
                "platform": platform,
                "from": from_,
                "to": to,
                "page": page,
                "per_page": per_page,
            },
        )

    def get(self, restaurant_id: str, order_id: str) -> Any:
        """GET /orders/{restaurant_id}/{order_id}"""
        return self.http.get(
            f"/orders/{quote(restaurant_id, safe='')}/{quote(order_id, safe='')}"
        )

    def update_status(self, restaurant_id: str, order_id: str, status_update: Mapping[str, Any]) -> Any:
        """PATCH /orders/{restaurant_id}/{order_id}

        status_update: {"status": ..., "cancellation_reason"?: ..., "eta_minutes"?: ...}
        """
        return self.http.patch(
            f"/orders/{quote(restaurant_id, safe='')}/{quote(order_id, safe='')}",
            body=status_update,
        )

    def simulate(self, restaurant_id: str, payload: Optional[Mapping[str, Any]] = None) -> Any:
        """POST /orders/{restaurant_id}/simulate — sandbox only.

        payload: {"platform"?: ..., "item_ids"?: [...]}
        """
        return self.http.post(
            f"/orders/{quote(restaurant_id, safe='')}/simulate",
            body=payload or {},
        )
