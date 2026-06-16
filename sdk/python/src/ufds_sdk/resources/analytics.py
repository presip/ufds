from __future__ import annotations

from typing import Any, Optional
from urllib.parse import quote

from ..client import UFDSHttpClient


class AnalyticsResource:
    def __init__(self, http: UFDSHttpClient) -> None:
        self.http = http

    def get(
        self,
        restaurant_id: str,
        *,
        from_: Optional[str] = None,
        to: Optional[str] = None,
        platform: Optional[str] = None,
    ) -> Any:
        """GET /analytics/{restaurant_id} — unified cross-platform metrics.

        `from_` and `to` are required by the API (YYYY-MM-DD); `platform` filters to one platform.
        """
        return self.http.get(
            f"/analytics/{quote(restaurant_id, safe='')}",
            query={"from": from_, "to": to, "platform": platform},
        )
