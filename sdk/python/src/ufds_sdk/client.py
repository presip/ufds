from __future__ import annotations

import random
import time
from typing import Any, Mapping, Optional

import httpx

ENVIRONMENTS = {
    "production": "https://api.ufds.dev/v1",
    "sandbox": "https://sandbox.ufds.dev/v1",
}


class UFDSError(Exception):
    """Mirrors the UFDS ErrorResponse envelope: {"error": {code, category, message, field?, docs?}}."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "UFDS_UNKNOWN",
        category: str = "INTERNAL",
        field: Optional[str] = None,
        docs: Optional[str] = None,
        http_status: Optional[int] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.category = category
        self.field = field
        self.docs = docs
        self.http_status = http_status

    @classmethod
    def from_response_body(cls, body: Optional[Mapping[str, Any]], http_status: int) -> "UFDSError":
        err = (body or {}).get("error") or {}
        return cls(
            err.get("message", f"UFDS request failed with status {http_status}"),
            code=err.get("code", "UFDS_UNKNOWN"),
            category=err.get("category", "INTERNAL"),
            field=err.get("field"),
            docs=err.get("docs"),
            http_status=http_status,
        )

    @classmethod
    def network(cls, message: str) -> "UFDSError":
        return cls(message, code="UFDS_NETWORK", category="INTERNAL")


class UFDSHttpClient:
    def __init__(
        self,
        token: str,
        *,
        environment: str = "production",
        base_url: Optional[str] = None,
        max_attempts: int = 3,
        retry_base_delay: float = 0.3,
        timeout: float = 30.0,
        transport: Optional[httpx.BaseTransport] = None,
        client: Optional[httpx.Client] = None,
    ) -> None:
        if not token:
            raise ValueError("UFDS client requires a `token` (Bearer JWT).")

        self.token = token
        self.base_url = (base_url or ENVIRONMENTS.get(environment, ENVIRONMENTS["production"])).rstrip("/")
        self.max_attempts = max(1, max_attempts)
        self.retry_base_delay = retry_base_delay
        self._client = client or httpx.Client(timeout=timeout, transport=transport)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "UFDSHttpClient":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    def get(self, path: str, **kwargs: Any) -> Any:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> Any:
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs: Any) -> Any:
        return self.request("PUT", path, **kwargs)

    def patch(self, path: str, **kwargs: Any) -> Any:
        return self.request("PATCH", path, **kwargs)

    def delete(self, path: str, **kwargs: Any) -> Any:
        return self.request("DELETE", path, **kwargs)

    def request(
        self,
        method: str,
        path: str,
        *,
        query: Optional[Mapping[str, Any]] = None,
        body: Any = None,
    ) -> Any:
        url = self.base_url + path
        params = {k: v for k, v in (query or {}).items() if v is not None}
        attempt = 1

        while True:
            try:
                response = self._client.request(
                    method,
                    url,
                    params=params,
                    json=body,
                    headers={
                        "Authorization": f"Bearer {self.token}",
                        "Accept": "application/json",
                    },
                )
            except httpx.HTTPError as cause:
                if attempt < self.max_attempts:
                    attempt += 1
                    time.sleep(self._backoff_delay(attempt))
                    continue
                raise UFDSError.network(f"Network error calling {method} {path}: {cause}") from cause

            if response.status_code == 429 and attempt < self.max_attempts:
                attempt += 1
                time.sleep(self._retry_after_delay(response))
                continue

            if 500 <= response.status_code < 600 and attempt < self.max_attempts:
                attempt += 1
                time.sleep(self._backoff_delay(attempt))
                continue

            return self._parse_response(response)

    def _parse_response(self, response: httpx.Response) -> Any:
        if response.status_code == 204:
            return None

        body = response.json() if response.content else None

        if response.is_error:
            raise UFDSError.from_response_body(body, response.status_code)

        return body

    def _backoff_delay(self, attempt: int) -> float:
        exponential = self.retry_base_delay * (2 ** (attempt - 1))
        jitter = random.random() * self.retry_base_delay
        return exponential + jitter

    def _retry_after_delay(self, response: httpx.Response) -> float:
        header = response.headers.get("retry-after")
        try:
            seconds = float(header) if header is not None else None
        except ValueError:
            seconds = None
        return max(seconds, 0.0) if seconds is not None else self._backoff_delay(1)
