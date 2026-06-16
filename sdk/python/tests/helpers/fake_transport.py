import json as json_module
from typing import Any, Callable, Iterable, List, Union

import httpx


def make_fake_transport(plan: Iterable[Union[dict, Callable, str]]) -> httpx.MockTransport:
    """
    Builds an httpx.MockTransport that replays canned responses in order and
    records every request for assertions. Entries may be a response
    descriptor dict, a function `(request) -> descriptor`, or the literal
    string 'network-error' to simulate a transport failure.
    """
    plan = list(plan)
    calls: List[httpx.Request] = []
    state = {"index": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        index = state["index"]
        if index >= len(plan):
            raise AssertionError(f"make_fake_transport: no more planned responses (call #{index + 1})")
        entry = plan[index]
        state["index"] += 1

        if entry == "network-error":
            raise httpx.ConnectError("simulated network failure")

        descriptor: dict[str, Any] = entry(request) if callable(entry) else entry
        status = descriptor.get("status", 200)
        body = descriptor.get("body")
        headers = descriptor.get("headers", {})
        content = b"" if body is None else json_module.dumps(body).encode("utf-8")
        return httpx.Response(status, headers=headers, content=content)

    transport = httpx.MockTransport(handler)
    transport.calls = calls  # type: ignore[attr-defined]
    return transport
