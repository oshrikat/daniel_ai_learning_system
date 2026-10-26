/**
 * Custom Generic REST API Repository (`src/db/custom/CustomRestRepo.js`)
 * Implements `window.CustomRestRepo` extending `IDatabaseRepo` for any generic JSON REST endpoint:
 * - Config fields: `{ endpointUrl, apiKey, saveMethod: 'POST' | 'PUT', customHeaders?: object }`.
 * - Supports `GET` to load state and `POST` / `PUT` to save state (automatically retrying `PUT` if `POST` returns HTTP 405).
 */

const CUSTOM_REST_TIMEOUT_MS = 15000;

class CustomRestRepo extends IDatabaseRepo {
  /**
   * @param {object} config
   */
  constructor(config = {}) {
    super('custom');
    this.config = {
      endpointUrl: '',
      apiKey: '',
      saveMethod: 'POST',
      customHeaders: {},
      ...config
    };
  }

  /**
   * @param {object} config
   * @returns {Promise<boolean>}
   */
  async init(config = {}) {
    await super.init(config);
    this.config.endpointUrl = String(this.config.endpointUrl || '').trim();
    this.config.apiKey = String(this.config.apiKey || '').trim();
    this.config.saveMethod = String(this.config.saveMethod || 'POST').toUpperCase() === 'PUT' ? 'PUT' : 'POST';
    return true;
  }

  /**
   * Builds request headers including optional Bearer / API key authentication.
   * @returns {object}
   */
  _buildHeaders() {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(this.config.customHeaders && typeof this.config.customHeaders === 'object' ? this.config.customHeaders : {})
    };
    const key = String(this.config.apiKey || '').trim();
    if (key) {
      headers['Authorization'] = /^Bearer\s+/i.test(key) ? key : `Bearer ${key}`;
    }
    return headers;
  }

  /**
   * Unwraps flexible server envelopes (`{ state: {...} }`, `{ data: {...} }`, `{ record: {...} }`, or direct state JSON).
   * @param {any} rawPayload
   * @returns {object|null}
   */
  _unwrapStatePayload(rawPayload) {
    if (!rawPayload || typeof rawPayload !== 'object') return null;
    if (rawPayload.state && typeof rawPayload.state === 'object') return rawPayload.state;
    if (rawPayload.record && typeof rawPayload.record === 'object') return rawPayload.record;
    if (rawPayload.data && typeof rawPayload.data === 'object' && !Array.isArray(rawPayload.data)) return rawPayload.data;
    if (Object.keys(rawPayload).length === 0) return null;
    return rawPayload;
  }

  /**
   * Tests `GET` connectivity against `endpointUrl`.
   * @param {object} config
   * @returns {Promise<{ ok: boolean, provider: string, latencyMs: number, message: string, metadata?: object }>}
   */
  async testConnection(config = {}) {
    await this.init(config);
    const t0 = Date.now();
    const url = this.config.endpointUrl;

    if (!url) {
      return {
        ok: false,
        provider: 'custom',
        latencyMs: 0,
        message: 'לא הוזנה כתובת שרת (REST Endpoint URL).'
      };
    }

    try {
      const res = await IDatabaseRepo.fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: this._buildHeaders()
        },
        CUSTOM_REST_TIMEOUT_MS
      );

      const latencyMs = Math.max(1, Date.now() - t0);
      if (!res.ok) {
        return {
          ok: false,
          provider: 'custom',
          latencyMs,
          message: `השרת המותאם החזיר שגיאה: HTTP ${res.status}`
        };
      }

      let hasState = false;
      try {
        const json = await res.json();
        hasState = Boolean(this._unwrapStatePayload(json));
      } catch (_e) {}

      return {
        ok: true,
        provider: 'custom',
        latencyMs,
        message: `חיבור לשרת REST המותאם אישית פעיל ותקין (${latencyMs}ms).`,
        metadata: {
          endpointUrl: url,
          hasExistingData: hasState
        }
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'custom',
        latencyMs: Date.now() - t0,
        message: `כשל בחיבור לשרת REST: ${err.message || String(err)}`
      };
    }
  }

  /**
   * Loads full state via `GET` from `endpointUrl`.
   * @returns {Promise<{ state: object|null, source: string, updatedAt: string }>}
   */
  async loadFullState() {
    const url = this.config.endpointUrl;
    if (!url) {
      throw new Error('[CustomRestRepo] Missing endpointUrl for loadFullState()');
    }

    const res = await IDatabaseRepo.fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: this._buildHeaders()
      },
      CUSTOM_REST_TIMEOUT_MS
    );

    if (!res.ok) {
      throw new Error(`Custom REST load failed (HTTP ${res.status})`);
    }

    const raw = await res.json();
    const state = this._unwrapStatePayload(raw);
    return {
      state,
      source: 'custom',
      updatedAt: state?._updatedAt || new Date().toISOString()
    };
  }

  /**
   * Saves full state via `POST` or `PUT` to `endpointUrl`.
   * @param {object} state
   * @returns {Promise<{ ok: boolean, provider: string, updatedAt: string }>}
   */
  async saveFullState(state) {
    const url = this.config.endpointUrl;
    if (!url) {
      throw new Error('[CustomRestRepo] Missing endpointUrl for saveFullState()');
    }

    const updatedAt = new Date().toISOString();
    const payload = { ...(state || {}), _updatedAt: updatedAt };
    const preferredMethod = this.config.saveMethod === 'PUT' ? 'PUT' : 'POST';

    let res = await IDatabaseRepo.fetchWithTimeout(
      url,
      {
        method: preferredMethod,
        headers: this._buildHeaders(),
        body: JSON.stringify(payload)
      },
      CUSTOM_REST_TIMEOUT_MS
    );

    // Automatic fallback between POST and PUT if endpoint returns 405 Method Not Allowed
    if (res.status === 405) {
      const altMethod = preferredMethod === 'POST' ? 'PUT' : 'POST';
      res = await IDatabaseRepo.fetchWithTimeout(
        url,
        {
          method: altMethod,
          headers: this._buildHeaders(),
          body: JSON.stringify(payload)
        },
        CUSTOM_REST_TIMEOUT_MS
      );
      if (res.ok) {
        this.config.saveMethod = altMethod;
      }
    }

    if (!res.ok) {
      throw new Error(`Custom REST save failed (HTTP ${res.status})`);
    }

    return {
      ok: true,
      provider: 'custom',
      updatedAt
    };
  }
}

if (typeof window !== 'undefined') {
  window.CustomRestRepo = CustomRestRepo;
}
if (typeof globalThis !== 'undefined') {
  globalThis.CustomRestRepo = CustomRestRepo;
}
