import json

import pytest

from ufds_sdk import OrdersResource, UFDSError, UFDSHttpClient

from .helpers.fake_transport import make_fake_transport
from .helpers.fixtures import load_fixture

ORDER_NEW = load_fixture("order_new.json")


def build_orders(transport):
    http = UFDSHttpClient("t", transport=transport)
    return OrdersResource(http)


def test_list_issues_a_get_with_filter_and_pagination_query_params():
    transport = make_fake_transport(
        [
            {
                "status": 200,
                "body": {
                    "ufds_version": "1.0",
                    "orders": [ORDER_NEW["order"]],
                    "pagination": {"total": 1, "page": 1, "per_page": 20, "next_cursor": None},
                },
            }
        ]
    )
    orders = build_orders(transport)

    orders.list("RST-IN-TS-001", status="PENDING", platform="swiggy", page=1, per_page=20)

    request = transport.calls[0]
    assert request.method == "GET"
    assert request.url.path == "/v1/orders/RST-IN-TS-001"
    assert request.url.params["status"] == "PENDING"
    assert request.url.params["platform"] == "swiggy"
    assert request.url.params["per_page"] == "20"


def test_get_fetches_a_single_order_by_id():
    transport = make_fake_transport(
        [{"status": 200, "body": {"ufds_version": "1.0", "timestamp": ORDER_NEW["timestamp"], "order": ORDER_NEW["order"]}}]
    )
    orders = build_orders(transport)

    result = orders.get("RST-IN-TS-001", "UFDS-ORD-20260616-00142")

    assert str(transport.calls[0].url).endswith("/orders/RST-IN-TS-001/UFDS-ORD-20260616-00142")
    assert result["order"] == ORDER_NEW["order"]


def test_update_status_patches_the_status_transition_payload():
    status_update = load_fixture("order_status_update.json")
    transport = make_fake_transport(
        [{"status": 200, "body": {"ufds_version": "1.0", "order": {**ORDER_NEW["order"], "status": "ACCEPTED"}}}]
    )
    orders = build_orders(transport)

    orders.update_status(
        "RST-IN-TS-001",
        "UFDS-ORD-20260616-00142",
        {"status": status_update["status"], "eta_minutes": status_update["eta_minutes"]},
    )

    request = transport.calls[0]
    assert request.method == "PATCH"
    assert str(request.url).endswith("/orders/RST-IN-TS-001/UFDS-ORD-20260616-00142")
    assert json.loads(request.content) == {"status": "ACCEPTED", "eta_minutes": 25}


def test_update_status_supports_cancellation_with_a_reason():
    cancelled = load_fixture("order_cancelled.json")
    transport = make_fake_transport(
        [{"status": 200, "body": {"ufds_version": "1.0", "order": {**ORDER_NEW["order"], "status": "CANCELLED"}}}]
    )
    orders = build_orders(transport)

    orders.update_status(
        "RST-IN-TS-001",
        cancelled["order_id"],
        {"status": "CANCELLED", "cancellation_reason": cancelled["reason"]},
    )

    body = json.loads(transport.calls[0].content)
    assert body["status"] == "CANCELLED"
    assert body["cancellation_reason"] == "ITEM_UNAVAILABLE"


def test_simulate_posts_to_the_sandbox_only_simulate_endpoint():
    transport = make_fake_transport([{"status": 201, "body": {"ufds_version": "1.0", "order": ORDER_NEW["order"]}}])
    orders = build_orders(transport)

    orders.simulate("RST-IN-TS-001", {"platform": "swiggy", "item_ids": ["ITEM-001", "ITEM-012"]})

    request = transport.calls[0]
    assert request.method == "POST"
    assert str(request.url).endswith("/orders/RST-IN-TS-001/simulate")
    assert json.loads(request.content) == {"platform": "swiggy", "item_ids": ["ITEM-001", "ITEM-012"]}


def test_simulate_surfaces_a_403_as_ufds_error_outside_sandbox():
    transport = make_fake_transport(
        [{"status": 403, "body": {"error": {"code": "UFDS_4030", "category": "STATE", "message": "Simulation not available in production."}}}]
    )
    orders = build_orders(transport)

    with pytest.raises(UFDSError) as exc_info:
        orders.simulate("RST-IN-TS-001", {})

    assert exc_info.value.http_status == 403
    assert exc_info.value.code == "UFDS_4030"
