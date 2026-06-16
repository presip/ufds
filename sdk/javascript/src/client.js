import { setTimeout as sleep } from 'node:timers/promises';

export const ENVIRONMENTS = {
  production: 'https://api.ufds.dev/v1',
  sandbox: 'https://sandbox.ufds.dev/v1',
};

/**
 * Error shape matches the UFDS ErrorResponse envelope:
 * { error: { code, category, message, field?, docs? } }
 */
export class UFDSError extends Error {
  constructor({ message, code, category, field, docs, httpStatus, cause }) {
    super(message, cause ? { cause } : undefined);
    this.name = 'UFDSError';
    this.code = code;
    this.category = category;
    this.field = field;
    this.docs = docs;
    this.httpStatus = httpStatus;
  }

  static fromResponseBody(body, httpStatus) {
    const err = (body && body.error) || {};
    return new UFDSError({
      message: err.message || `UFDS request failed with status ${httpStatus}`,
      code: err.code || 'UFDS_UNKNOWN',
      category: err.category || 'INTERNAL',
      field: err.field,
      docs: err.docs,
      httpStatus,
    });
  }

  static network(message, cause) {
    return new UFDSError({ message, code: 'UFDS_NETWORK', category: 'INTERNAL', cause });
  }
}

export class UFDSHttpClient {
  constructor({
    token,
    environment = 'production',
    baseUrl,
    maxAttempts = 3,
    retryBaseDelayMs = 300,
    timeoutMs = 30000,
    fetch: fetchImpl = globalThis.fetch,
  } = {}) {
    if (!token) throw new Error('UFDS client requires a `token` (Bearer JWT).');
    if (!fetchImpl) throw new Error('No global `fetch` available; pass one via the `fetch` option.');

    this.token = token;
    this.baseUrl = (baseUrl || ENVIRONMENTS[environment] || ENVIRONMENTS.production).replace(/\/+$/, '');
    this.maxAttempts = Math.max(1, maxAttempts);
    this.retryBaseDelayMs = retryBaseDelayMs;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  setToken(token) {
    this.token = token;
  }

  get(path, opts) {
    return this.request('GET', path, opts);
  }

  post(path, opts) {
    return this.request('POST', path, opts);
  }

  put(path, opts) {
    return this.request('PUT', path, opts);
  }

  patch(path, opts) {
    return this.request('PATCH', path, opts);
  }

  delete(path, opts) {
    return this.request('DELETE', path, opts);
  }

  async request(method, path, { query, body, headers = {} } = {}) {
    const url = this._buildUrl(path, query);
    let attempt = 1;

    while (true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (cause) {
        clearTimeout(timer);
        if (attempt < this.maxAttempts) {
          attempt += 1;
          await sleep(this._backoffDelay(attempt));
          continue;
        }
        throw UFDSError.network(`Network error calling ${method} ${path}: ${cause.message}`, cause);
      }
      clearTimeout(timer);

      if (response.status === 429 && attempt < this.maxAttempts) {
        attempt += 1;
        await sleep(this._retryAfterDelay(response));
        continue;
      }

      if (response.status >= 500 && response.status < 600 && attempt < this.maxAttempts) {
        attempt += 1;
        await sleep(this._backoffDelay(attempt));
        continue;
      }

      return this._parseResponse(response, method, path);
    }
  }

  async _parseResponse(response, method, path) {
    if (response.status === 204) return null;

    const text = await response.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch (cause) {
        if (response.ok) {
          throw UFDSError.network(`Failed to parse response for ${method} ${path}: ${cause.message}`, cause);
        }
      }
    }

    if (!response.ok) {
      throw UFDSError.fromResponseBody(json, response.status);
    }

    return json;
  }

  _buildUrl(path, query) {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, value);
      }
    }
    return url;
  }

  _backoffDelay(attempt) {
    const exponential = this.retryBaseDelayMs * 2 ** (attempt - 1);
    const jitter = Math.random() * this.retryBaseDelayMs;
    return exponential + jitter;
  }

  _retryAfterDelay(response) {
    const header = response.headers.get('retry-after');
    const seconds = Number(header);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : this._backoffDelay(1);
  }
}
