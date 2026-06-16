from __future__ import annotations

from typing import Any, Mapping
from urllib.parse import quote

from ..client import UFDSHttpClient


class MenuResource:
    def __init__(self, http: UFDSHttpClient) -> None:
        self.http = http

    def get(self, restaurant_id: str) -> Any:
        """GET /menu/{restaurant_id}"""
        return self.http.get(f"/menu/{quote(restaurant_id, safe='')}")

    def replace(self, restaurant_id: str, menu: Mapping[str, Any]) -> Any:
        """PUT /menu/{restaurant_id} — replaces the full menu"""
        return self.http.put(f"/menu/{quote(restaurant_id, safe='')}", body=menu)

    def update_item(self, restaurant_id: str, item_id: str, patch: Mapping[str, Any]) -> Any:
        """PATCH /menu/{restaurant_id}/items/{item_id} — partial update of one item"""
        return self.http.patch(
            f"/menu/{quote(restaurant_id, safe='')}/items/{quote(item_id, safe='')}",
            body=patch,
        )

    def delete_item(self, restaurant_id: str, item_id: str) -> Any:
        """DELETE /menu/{restaurant_id}/items/{item_id}"""
        return self.http.delete(
            f"/menu/{quote(restaurant_id, safe='')}/items/{quote(item_id, safe='')}"
        )
