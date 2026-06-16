from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable, Mapping, Optional
from urllib.parse import quote

from ..client import UFDSHttpClient


class InventoryResource:
    def __init__(self, http: UFDSHttpClient) -> None:
        self.http = http

    def bulk_update(
        self,
        restaurant_id: str,
        items: Iterable[Mapping[str, Any]],
        *,
        ufds_version: str = "1.0",
        timestamp: Optional[str] = None,
    ) -> Any:
        """POST /inventory/{restaurant_id} — push availability for multiple items in one call.

        items: [{"item_id": ..., "available": ..., "stock_count"?: ..., "reason"?: ...}]
        """
        return self.http.post(
            f"/inventory/{quote(restaurant_id, safe='')}",
            body={
                "ufds_version": ufds_version,
                "timestamp": timestamp or _now_iso(),
                "restaurant_id": restaurant_id,
                "items": list(items),
            },
        )

    def update_availability(self, restaurant_id: str, item_id: str, patch: Mapping[str, Any]) -> Any:
        """PATCH /inventory/{restaurant_id}/{item_id} — toggle a single item's availability"""
        return self.http.patch(
            f"/inventory/{quote(restaurant_id, safe='')}/{quote(item_id, safe='')}",
            body={"item_id": item_id, **patch},
        )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
