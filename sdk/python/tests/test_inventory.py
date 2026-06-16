import datetime as dt
import json

from ufds_sdk import InventoryResource, UFDSHttpClient

from .helpers.fake_transport import make_fake_transport
from .helpers.fixtures import load_fixture

INVENTORY_FIXTURE = load_fixture("inventory_bulk_update.json")


def build_inventory(transport):
    http = UFDSHttpClient("t", transport=transport)
    return InventoryResource(http)


def test_bulk_update_posts_an_inventory_update_envelope_with_the_given_items():
    transport = make_fake_transport(
        [{"status": 200, "body": {"ufds_version": "1.0", "synced_platforms": ["swiggy", "zomato", "ondc"], "failed_platforms": []}}]
    )
    inventory = build_inventory(transport)

    result = inventory.bulk_update(
        INVENTORY_FIXTURE["restaurant_id"],
        INVENTORY_FIXTURE["items"],
        timestamp=INVENTORY_FIXTURE["timestamp"],
    )

    request = transport.calls[0]
    assert request.method == "POST"
    assert str(request.url).endswith("/inventory/RST-IN-TS-001")
    body = json.loads(request.content)
    assert body["ufds_version"] == "1.0"
    assert body["timestamp"] == INVENTORY_FIXTURE["timestamp"]
    assert body["restaurant_id"] == "RST-IN-TS-001"
    assert body["items"] == INVENTORY_FIXTURE["items"]
    assert result["synced_platforms"] == ["swiggy", "zomato", "ondc"]


def test_bulk_update_defaults_timestamp_to_now_when_not_provided():
    transport = make_fake_transport([{"status": 200, "body": {}}])
    inventory = build_inventory(transport)

    before = dt.datetime.now(dt.timezone.utc)
    inventory.bulk_update("RST-IN-TS-001", [{"item_id": "ITEM-001", "available": True}])

    body = json.loads(transport.calls[0].content)
    sent_at = dt.datetime.fromisoformat(body["timestamp"].replace("Z", "+00:00"))
    assert sent_at >= before


def test_update_availability_patches_a_single_inventory_item_and_injects_item_id():
    transport = make_fake_transport([{"status": 200, "body": {"item_id": "ITEM-003", "available": False, "reason": "SOLD_OUT"}}])
    inventory = build_inventory(transport)

    result = inventory.update_availability("RST-IN-TS-001", "ITEM-003", {"available": False, "reason": "SOLD_OUT"})

    request = transport.calls[0]
    assert request.method == "PATCH"
    assert str(request.url).endswith("/inventory/RST-IN-TS-001/ITEM-003")
    assert json.loads(request.content) == {"item_id": "ITEM-003", "available": False, "reason": "SOLD_OUT"}
    assert result["available"] is False
