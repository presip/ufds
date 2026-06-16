/** Minimal Fetch API Response stand-in for tests. */
class FakeResponse {
  constructor({ status = 200, body = null, headers = {} } = {}) {
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this._body = body;
    this._headers = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  }

  get headers() {
    return { get: (name) => this._headers.get(name.toLowerCase()) ?? null };
  }

  async text() {
    if (this._body === null || this._body === undefined) return '';
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
  }
}

/**
 * Builds a fake `fetch` that replays canned responses in order and records
 * every call for assertions. Entries may be a response descriptor or a
 * function `(url, init) => descriptor` for dynamic behaviour, or the string
 * 'network-error' to simulate a thrown network failure.
 */
export function createFakeFetch(plan) {
  const calls = [];
  let index = 0;

  const fetchImpl = async (url, init) => {
    calls.push({ url: url.toString(), init });
    if (index >= plan.length) {
      throw new Error(`createFakeFetch: no more planned responses (call #${index + 1})`);
    }
    const entry = plan[index];
    index += 1;

    if (entry === 'network-error') {
      throw new Error('simulated network failure');
    }
    const descriptor = typeof entry === 'function' ? entry(url, init) : entry;
    return new FakeResponse(descriptor);
  };

  fetchImpl.calls = calls;
  return fetchImpl;
}
