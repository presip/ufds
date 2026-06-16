from __future__ import annotations

from typing import Any

from .client import ENVIRONMENTS, UFDSError, UFDSHttpClient
from .resources.analytics import AnalyticsResource
from .resources.inventory import InventoryResource
from .resources.menu import MenuResource
from .resources.orders import OrdersResource
from .webhooks.handler import WEBHOOK_EVENTS, UFDSWebhookError, UFDSWebhookHandler
from .webhooks.signature import sign_payload, verify_signature


class UFDSClient:
    """
    Main UFDS SDK entry point.

        client = UFDSClient(token, environment="sandbox")
        menu = client.menu.get("RST-IN-MH-001")
        orders = client.orders.list("RST-IN-MH-001", status="PENDING")
        handler = client.webhooks(secret=os.environ["UFDS_WEBHOOK_SECRET"])
    """

    def __init__(self, token: str, **options: Any) -> None:
        self.http = UFDSHttpClient(token, **options)
        self.menu = MenuResource(self.http)
        self.orders = OrdersResource(self.http)
        self.inventory = InventoryResource(self.http)
        self.analytics = AnalyticsResource(self.http)

    def webhooks(self, secret: str) -> UFDSWebhookHandler:
        return UFDSWebhookHandler(secret)

    def close(self) -> None:
        self.http.close()

    def __enter__(self) -> "UFDSClient":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()


__all__ = [
    "UFDSClient",
    "UFDSHttpClient",
    "UFDSError",
    "ENVIRONMENTS",
    "MenuResource",
    "OrdersResource",
    "InventoryResource",
    "AnalyticsResource",
    "UFDSWebhookHandler",
    "UFDSWebhookError",
    "WEBHOOK_EVENTS",
    "sign_payload",
    "verify_signature",
]
