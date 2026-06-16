from __future__ import annotations

import hashlib
import hmac
from typing import Optional, Union


def sign_payload(secret: str, raw_body: Union[bytes, str]) -> str:
    """Computes the hex-encoded HMAC-SHA256 signature UFDS expects for a webhook body."""
    body = raw_body.encode("utf-8") if isinstance(raw_body, str) else raw_body
    key = secret.encode("utf-8") if isinstance(secret, str) else secret
    return hmac.new(key, body, hashlib.sha256).hexdigest()


def verify_signature(secret: str, raw_body: Union[bytes, str], signature: Optional[str]) -> bool:
    """Verifies the `X-UFDS-Signature` header against the raw (unparsed) request body.

    Accepts either a bare hex digest or a `sha256=<digest>` prefixed value.
    """
    if not signature:
        return False

    provided = signature[len("sha256=") :] if signature.startswith("sha256=") else signature
    expected = sign_payload(secret, raw_body)
    return hmac.compare_digest(expected, provided)
