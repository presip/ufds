from ufds_sdk import UFDSClient, UFDSWebhookHandler

from .helpers.fake_transport import make_fake_transport
from .helpers.fixtures import load_fixture


def test_ufds_client_wires_up_resources_sharing_one_http_client():
    menu_fixture = load_fixture("menu_full.json")
    transport = make_fake_transport([{"status": 200, "body": menu_fixture}])
    client = UFDSClient("jwt", environment="sandbox", transport=transport)

    menu = client.menu.get("RST-IN-TS-001")

    assert menu == menu_fixture
    assert str(transport.calls[0].url).startswith("https://sandbox.ufds.dev/v1/menu/RST-IN-TS-001")
    assert client.menu.http is client.http
    assert client.orders.http is client.http
    assert client.inventory.http is client.http
    assert client.analytics.http is client.http


def test_ufds_client_webhooks_returns_a_bound_handler():
    client = UFDSClient("jwt", transport=make_fake_transport([]))
    handler = client.webhooks("whsec_test")

    assert isinstance(handler, UFDSWebhookHandler)
    assert handler.secret == "whsec_test"
