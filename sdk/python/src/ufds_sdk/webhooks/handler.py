from __future__ import annotations

import json
from collections import defaultdict
from typing import Any, Callable, DefaultDict, Dict, List, Optional, Union

from .signature import verify_signature

WEBHOOK_EVENTS = (
    "order.new",
    "order.status_update",
    "order.cancelled",
    "platform.offline",
    "menu.sync_failed",
)


class UFDSWebhookError(Exception):
    """Raised by UFDSWebhookHandler.handle() for invalid signatures or malformed payloads."""

    def __init__(self, message: str, *, code: str, category: str) -> None:
        super().__init__(message)
        self.code = code
        self.category = category


class UFDSWebhookHandler:
    """
    Framework-agnostic verifier/dispatcher for inbound UFDS webhooks.

    Pass the *raw* request body and the `X-UFDS-Signature` header to `handle()`
    from any web framework's view/route function:

        handler = UFDSWebhookHandler(secret=os.environ["UFDS_WEBHOOK_SECRET"])
        handler.on("order.new", on_new_order)

        # Flask
        @app.post("/webhooks/ufds")
        def ufds_webhook():
            handler.handle(request.get_data(), request.headers.get("X-UFDS-Signature"))
            return {"received": True}
    """

    def __init__(self, secret: str) -> None:
        if not secret:
            raise ValueError("UFDSWebhookHandler requires a `secret`.")
        self.secret = secret
        self._listeners: DefaultDict[str, List[Callable[[Dict[str, Any]], None]]] = defaultdict(list)

    def on(self, event: str, callback: Callable[[Dict[str, Any]], None]) -> None:
        self._listeners[event].append(callback)

    def handle(self, raw_body: Union[bytes, str], signature: Optional[str]) -> Dict[str, Any]:
        if not verify_signature(self.secret, raw_body, signature):
            raise UFDSWebhookError(
                "Invalid X-UFDS-Signature header.", code="UFDS_4001", category="AUTH"
            )

        body_text = raw_body.decode("utf-8") if isinstance(raw_body, bytes) else raw_body
        try:
            payload: Dict[str, Any] = json.loads(body_text)
        except json.JSONDecodeError as cause:
            raise UFDSWebhookError(
                "Malformed webhook payload.", code="UFDS_4000", category="VALIDATION"
            ) from cause

        event = payload.get("event")
        for callback in self._listeners.get(event, []):
            callback(payload)
        for callback in self._listeners.get("event", []):
            callback(payload)

        return payload
