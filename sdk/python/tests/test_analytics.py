from ufds_sdk import AnalyticsResource, UFDSHttpClient

from .helpers.fake_transport import make_fake_transport
from .helpers.fixtures import load_fixture

ANALYTICS_FIXTURE = load_fixture("analytics_response.json")


def build_analytics(transport):
    http = UFDSHttpClient("t", transport=transport)
    return AnalyticsResource(http)


def test_get_issues_a_get_with_required_from_to_and_optional_platform_query_params():
    transport = make_fake_transport([{"status": 200, "body": ANALYTICS_FIXTURE}])
    analytics = build_analytics(transport)

    result = analytics.get("RST-IN-TS-001", from_="2026-06-01", to="2026-06-15", platform="swiggy")

    request = transport.calls[0]
    assert request.method == "GET"
    assert request.url.path == "/v1/analytics/RST-IN-TS-001"
    assert request.url.params["from"] == "2026-06-01"
    assert request.url.params["to"] == "2026-06-15"
    assert request.url.params["platform"] == "swiggy"
    assert result == ANALYTICS_FIXTURE


def test_get_omits_platform_from_query_string_when_not_provided():
    transport = make_fake_transport([{"status": 200, "body": ANALYTICS_FIXTURE}])
    analytics = build_analytics(transport)

    analytics.get("RST-IN-TS-001", from_="2026-06-01", to="2026-06-15")

    assert "platform" not in transport.calls[0].url.params
