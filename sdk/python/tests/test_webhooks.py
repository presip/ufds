import json

import pytest

from ufds_sdk.webhooks.handler import UFDSWebhookError, UFDSWebhookHandler
from ufds_sdk.webhooks.signature import sign_payload, verify_signature

from .helpers.fixtures import load_fixture

SECRET = "whsec_test_secret"


def raw_body_for(fixture_name: str) -> bytes:
    payload = load_fixture(fixture_name)
    return json.dumps(payload).encode("utf-8")


def test_sign_payload_produces_a_deterministic_hex_digest():
    body = raw_body_for("order_new.json")
    sig1 = sign_payload(SECRET, body)
    sig2 = sign_payload(SECRET, body)

    assert sig1 == sig2
    assert len(sig1) == 64
    int(sig1, 16)  # raises ValueError if not valid hex


def test_verify_signature_accepts_a_correctly_signed_body():
    body = raw_body_for("order_new.json")
    signature = sign_payload(SECRET, body)

    assert verify_signature(SECRET, body, signature) is True


def test_verify_signature_accepts_sha256_prefixed_signature():
    body = raw_body_for("order_new.json")
    signature = sign_payload(SECRET, body)

    assert verify_signature(SECRET, body, f"sha256={signature}") is True


def test_verify_signature_rejects_a_tampered_body():
    body = raw_body_for("order_new.json")
    signature = sign_payload(SECRET, body)
    tampered = body.replace(b"Priya Sharma", b"Eve Attacker")

    assert verify_signature(SECRET, tampered, signature) is False


def test_verify_signature_rejects_the_wrong_secret():
    body = raw_body_for("order_new.json")
    signature = sign_payload(SECRET, body)

    assert verify_signature("wrong_secret", body, signature) is False


def test_verify_signature_rejects_a_missing_signature():
    body = raw_body_for("order_new.json")

    assert verify_signature(SECRET, body, None) is False


def test_handle_verifies_parses_and_dispatches_the_typed_event():
    handler = UFDSWebhookHandler(SECRET)
    body = raw_body_for("order_new.json")
    signature = sign_payload(SECRET, body)

    received = []
    handler.on("order.new", received.append)

    payload = handler.handle(body, signature)

    assert payload["event"] == "order.new"
    assert payload["order"]["id"] == "UFDS-ORD-20260616-00142"
    assert len(received) == 1
    assert received[0] is payload


def test_handle_dispatches_order_status_update():
    handler = UFDSWebhookHandler(SECRET)
    body = raw_body_for("order_status_update.json")
    signature = sign_payload(SECRET, body)

    received = []
    handler.on("order.status_update", received.append)

    payload = handler.handle(body, signature)

    assert payload["status"] == "ACCEPTED"
    assert len(received) == 1


def test_handle_raises_on_invalid_signature_and_does_not_dispatch():
    handler = UFDSWebhookHandler(SECRET)
    body = raw_body_for("order_cancelled.json")

    received = []
    handler.on("order.cancelled", received.append)

    with pytest.raises(UFDSWebhookError) as exc_info:
        handler.handle(body, "deadbeef")

    assert exc_info.value.code == "UFDS_4001"
    assert received == []


def test_handle_raises_on_malformed_json_payload():
    handler = UFDSWebhookHandler(SECRET)
    body = b"not json"
    signature = sign_payload(SECRET, body)

    with pytest.raises(UFDSWebhookError) as exc_info:
        handler.handle(body, signature)

    assert exc_info.value.code == "UFDS_4000"
