import json

from ufds_sdk import MenuResource, UFDSHttpClient

from .helpers.fake_transport import make_fake_transport
from .helpers.fixtures import load_fixture

MENU_FIXTURE = load_fixture("menu_full.json")


def build_menu(transport):
    http = UFDSHttpClient("t", transport=transport)
    return MenuResource(http)


def test_get_fetches_the_full_menu_for_a_restaurant():
    transport = make_fake_transport([{"status": 200, "body": MENU_FIXTURE}])
    menu = build_menu(transport)

    result = menu.get("RST-IN-TS-001")

    request = transport.calls[0]
    assert request.method == "GET"
    assert str(request.url).endswith("/menu/RST-IN-TS-001")
    assert result == MENU_FIXTURE


def test_replace_puts_the_full_menu_payload():
    transport = make_fake_transport([{"status": 200, "body": MENU_FIXTURE}])
    menu = build_menu(transport)

    menu.replace("RST-IN-TS-001", MENU_FIXTURE)

    request = transport.calls[0]
    assert request.method == "PUT"
    assert str(request.url).endswith("/menu/RST-IN-TS-001")
    assert json.loads(request.content) == MENU_FIXTURE


def test_update_item_patches_a_single_item_by_id():
    updated_item = {**MENU_FIXTURE["menu"]["categories"][0]["items"][0], "available": False}
    transport = make_fake_transport([{"status": 200, "body": updated_item}])
    menu = build_menu(transport)

    result = menu.update_item("RST-IN-TS-001", "ITEM-001", {"available": False})

    request = transport.calls[0]
    assert request.method == "PATCH"
    assert str(request.url).endswith("/menu/RST-IN-TS-001/items/ITEM-001")
    assert json.loads(request.content) == {"available": False}
    assert result["available"] is False


def test_delete_item_deletes_and_resolves_to_none_on_204():
    transport = make_fake_transport([{"status": 204}])
    menu = build_menu(transport)

    result = menu.delete_item("RST-IN-TS-001", "ITEM-003")

    request = transport.calls[0]
    assert request.method == "DELETE"
    assert str(request.url).endswith("/menu/RST-IN-TS-001/items/ITEM-003")
    assert result is None


def test_encodes_restaurant_and_item_ids_with_special_characters():
    transport = make_fake_transport([{"status": 200, "body": {}}])
    menu = build_menu(transport)

    menu.update_item("RST IN/MH 001", "ITEM 001", {"available": True})

    request = transport.calls[0]
    assert str(request.url).endswith("/menu/RST%20IN%2FMH%20001/items/ITEM%20001")
