import pytest

from ufds_sdk import ENVIRONMENTS, UFDSError, UFDSHttpClient

from .helpers.fake_transport import make_fake_transport


def test_sends_bearer_auth_header_and_uses_production_base_url_by_default():
    transport = make_fake_transport([{"status": 200, "body": {"ufds_version": "1.0"}}])
    client = UFDSHttpClient("jwt-123", transport=transport)

    client.get("/menu/RST-IN-MH-001")

    assert len(transport.calls) == 1
    request = transport.calls[0]
    assert str(request.url) == f"{ENVIRONMENTS['production']}/menu/RST-IN-MH-001"
    assert request.headers["authorization"] == "Bearer jwt-123"


def test_switches_to_sandbox_base_url():
    transport = make_fake_transport([{"status": 200, "body": {}}])
    client = UFDSHttpClient("t", environment="sandbox", transport=transport)

    client.get("/menu/RST-IN-MH-001")

    assert str(transport.calls[0].url).startswith("https://sandbox.ufds.dev/v1")


def test_serializes_query_params_skipping_none_values():
    transport = make_fake_transport([{"status": 200, "body": {}}])
    client = UFDSHttpClient("t", transport=transport)

    client.get("/orders/RST-IN-MH-001", query={"status": "PENDING", "platform": None, "page": 2})

    request = transport.calls[0]
    assert request.url.params["status"] == "PENDING"
    assert "platform" not in request.url.params
    assert request.url.params["page"] == "2"


def test_retries_on_5xx_with_backoff_and_succeeds():
    transport = make_fake_transport(
        [
            {"status": 503, "body": {"error": {"code": "UFDS_5000", "category": "INTERNAL", "message": "down"}}},
            {"status": 502, "body": {"error": {"code": "UFDS_5000", "category": "INTERNAL", "message": "down"}}},
            {"status": 200, "body": {"ufds_version": "1.0"}},
        ]
    )
    client = UFDSHttpClient("t", transport=transport, max_attempts=3, retry_base_delay=0.001)

    result = client.get("/menu/RST-IN-MH-001")

    assert len(transport.calls) == 3
    assert result == {"ufds_version": "1.0"}


def test_raises_ufds_error_after_exhausting_retries_on_persistent_5xx():
    error_body = {"error": {"code": "UFDS_5001", "category": "INTERNAL", "message": "boom"}}
    transport = make_fake_transport([{"status": 500, "body": error_body}] * 3)
    client = UFDSHttpClient("t", transport=transport, max_attempts=3, retry_base_delay=0.001)

    with pytest.raises(UFDSError) as exc_info:
        client.get("/menu/RST-IN-MH-001")

    assert exc_info.value.code == "UFDS_5001"
    assert exc_info.value.http_status == 500
    assert len(transport.calls) == 3


def test_respects_retry_after_on_429_before_retrying():
    transport = make_fake_transport(
        [
            {
                "status": 429,
                "headers": {"Retry-After": "0"},
                "body": {"error": {"code": "UFDS_4290", "category": "PLATFORM", "message": "slow down"}},
            },
            {"status": 200, "body": {"ufds_version": "1.0"}},
        ]
    )
    client = UFDSHttpClient("t", transport=transport, max_attempts=3)

    result = client.get("/orders/RST-IN-MH-001")

    assert len(transport.calls) == 2
    assert result == {"ufds_version": "1.0"}


def test_maps_error_response_envelope_for_non_retryable_failures():
    transport = make_fake_transport(
        [
            {
                "status": 404,
                "body": {
                    "error": {
                        "code": "UFDS_4022",
                        "category": "VALIDATION",
                        "message": "item_id ITEM-099 not found in menu for RST-IN-MH-001",
                        "field": "items[1].item_id",
                        "docs": "https://ufds.dev/errors/4022",
                    }
                },
            }
        ]
    )
    client = UFDSHttpClient("t", transport=transport)

    with pytest.raises(UFDSError) as exc_info:
        client.get("/menu/RST-IN-MH-001/items/ITEM-099")

    assert exc_info.value.code == "UFDS_4022"
    assert exc_info.value.field == "items[1].item_id"
    assert exc_info.value.http_status == 404
    assert len(transport.calls) == 1


def test_retries_on_network_failure_then_raises_ufds_network():
    transport = make_fake_transport(["network-error", "network-error"])
    client = UFDSHttpClient("t", transport=transport, max_attempts=2, retry_base_delay=0.001)

    with pytest.raises(UFDSError) as exc_info:
        client.get("/menu/RST-IN-MH-001")

    assert exc_info.value.code == "UFDS_NETWORK"
    assert len(transport.calls) == 2


def test_returns_none_for_204_no_content():
    transport = make_fake_transport([{"status": 204}])
    client = UFDSHttpClient("t", transport=transport)

    result = client.delete("/menu/RST-IN-MH-001/items/ITEM-099")

    assert result is None
