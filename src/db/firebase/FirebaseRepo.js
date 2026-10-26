/**
 * Firebase Realtime Database Repository (`src/db/firebase/FirebaseRepo.js`)
 * Implements `window.FirebaseRepo` extending `IDatabaseRepo` using the Firebase Realtime Database REST API:
 * - Endpoint pattern: `${databaseUrl.replace(/\/$/, '')}/daniel_state.json${authSecret ? '?auth=' + encodeURIComponent(authSecret) : ''}`
 * - Supports `GET`, `PUT`, `PATCH`, and `DELETE` with a 15-second `AbortController` timeout and clean Hebrew error reporting.
 */

const FIREBASE_TIMEOUT_MS = 15000;

class FirebaseRepo extends IDatabaseRepo {
  /**
   * @param {object} config
   */
  constructor(config = {}) {
    super('firebase');
    this.config = {
      databaseUrl: '',
      authSecret: '',
      ...config
    };
  }

  /**
   * @param {object} config
   * @returns {Promise<boolean>}
   */
  async init(config = {}) {
    await super.init(config);
    this.config.databaseUrl = String(this.config.databaseUrl || '').trim().replace(/\/+$/, '');
    this.config.authSecret = String(this.config.authSecret || '').trim();
    return true;
  }

  /**
   * Constructs the Firebase Realtime Database `.json` REST URL for the root state or a nested subpath.
   * @param {string} [subPath]
   * @returns {string}
   */
  _buildFirebaseUrl(subPath = '') {
    const baseUrl = String(this.config.databaseUrl || '').trim().replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('חסרה כתובת מסד נתונים (Firebase Database URL).');
    }
    const cleanSub = String(subPath || '').trim().replace(/^\/+|\/+$/g, '').replace(/\./g, '/');
    const authSecret = String(this.config.authSecret || '').trim();
    const authQuery = authSecret ? `?auth=${encodeURIComponent(authSecret)}` : '';
    const resourcePath = cleanSub ? `/daniel_state/${cleanSub}.json` : '/daniel_state.json';
    return `${baseUrl}${resourcePath}${authQuery}`;
  }

  /**
   * Executes a Firebase REST request (`GET`, `PUT`, `PATCH`, or `DELETE`) with a 15-second timeout.
   * @param {string} method
   * @param {string} subPath
   * @param {object|null} bodyObj
   * @returns {Promise<any>}
   */
  async _request(method, subPath = '', bodyObj = null) {
    const url = this._buildFirebaseUrl(subPath);
    const fetchOpts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (bodyObj !== null && method !== 'GET' && method !== 'DELETE') {
      fetchOpts.body = JSON.stringify(bodyObj);
    }

    const res = await IDatabaseRepo.fetchWithTimeout(url, fetchOpts, FIREBASE_TIMEOUT_MS);
    if (!res.ok) {
      let detail = '';
      try {
        const errJson = await res.json();
        detail = errJson && errJson.error ? ` (${errJson.error})` : '';
      } catch (_e) {}
      throw new Error(`שגיאת Firebase Realtime DB [${method}] HTTP ${res.status}${detail}`);
    }
    return res.json();
  }

  /**
   * Tests `GET` connectivity against the Firebase Realtime Database endpoint.
   * @param {object} config
   * @returns {Promise<{ ok: boolean, provider: string, latencyMs: number, message: string, metadata?: object }>}
   */
  async testConnection(config = {}) {
    await this.init(config);
    const t0 = Date.now();

    if (!this.config.databaseUrl) {
      return {
        ok: false,
        provider: 'firebase',
        latencyMs: 0,
        message: 'לא הוזנה כתובת Firebase Realtime Database URL.'
      };
    }

    try {
      const data = await this._request('GET', '');
      const latencyMs = Math.max(1, Date.now() - t0);
      return {
        ok: true,
        provider: 'firebase',
        latencyMs,
        message: `חיבור ל-Firebase Realtime Database תקין ופעיל (${latencyMs}ms).`,
        metadata: {
          hasExistingData: Boolean(data && typeof data === 'object' && Object.keys(data).length > 0),
          endpoint: `${this.config.databaseUrl}/daniel_state.json`
        }
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'firebase',
        latencyMs: Date.now() - t0,
        message: err.message || String(err)
      };
    }
  }

  /**
   * Loads the full state via `GET /daniel_state.json`.
   * @returns {Promise<{ state: object|null, source: string, updatedAt: string }>}
   */
  async loadFullState() {
    const data = await this._request('GET', '');
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      return {
        state: null,
        source: 'firebase',
        updatedAt: new Date().toISOString()
      };
    }
    return {
      state: data,
      source: 'firebase',
      updatedAt: data._updatedAt || new Date().toISOString()
    };
  }

  /**
   * Replaces/saves the full state via `PUT /daniel_state.json`.
   * @param {object} state
   * @returns {Promise<{ ok: boolean, provider: string, updatedAt: string }>}
   */
  async saveFullState(state) {
    const updatedAt = new Date().toISOString();
    const payload = { ...(state || {}), _updatedAt: updatedAt };
    await this._request('PUT', '', payload);
    return {
      ok: true,
      provider: 'firebase',
      updatedAt
    };
  }

  /**
   * Partial root or subpath patch via `PATCH` (Firebase native partial update).
   * @param {object} partialRootData
   * @param {string} [subPath]
   * @returns {Promise<object>}
   */
  async patchPath(partialRootData, subPath = '') {
    return this._request('PATCH', subPath, partialRootData);
  }

  /**
   * Deletes a specific subpath or item in Firebase via `DELETE` (or collection filter when stored as an Array).
   * @param {string} collectionName
   * @param {string} id
   * @returns {Promise<{ ok: boolean, deletedId: string }>}
   */
  async delete(collectionName, id) {
    if (!id && collectionName) {
      await this._request('DELETE', collectionName);
      return { ok: true, deletedId: collectionName };
    }
    return super.delete(collectionName, id);
  }
}

if (typeof window !== 'undefined') {
  window.FirebaseRepo = FirebaseRepo;
}
if (typeof globalThis !== 'undefined') {
  globalThis.FirebaseRepo = FirebaseRepo;
}
