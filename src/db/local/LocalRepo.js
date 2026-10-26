/**
 * Local Repository Implementation (`src/db/local/LocalRepo.js`)
 * Implements `window.LocalRepo` extending `IDatabaseRepo`:
 * - Instant `0ms` reads/writes against browser `localStorage` (`DANIEL_AI_V3_CLEAN`).
 * - Asynchronous background mirroring to `server/server.py` (`GET /api/state` & `POST /api/state`
 *   -> `data/daniel_state.json`) whenever running locally, degrading silently with 0 errors
 *   when hosted statically on GitHub Pages.
 */

class LocalRepo extends IDatabaseRepo {
  /**
   * @param {object} config
   */
  constructor(config = {}) {
    super('local');
    this.storageKey = config.storageKey || (typeof STORAGE_KEY !== 'undefined' ? STORAGE_KEY : 'DANIEL_AI_V3_CLEAN');
    this.serverEndpoint = config.serverEndpoint || '/api/state';
    this.serverAvailable = null; // null = unknown, true = reachable, false = static host
    this.config = {
      storageKey: this.storageKey,
      serverEndpoint: this.serverEndpoint,
      ...config
    };
  }

  /**
   * @param {object} config
   * @returns {Promise<boolean>}
   */
  async init(config = {}) {
    await super.init(config);
    if (config.storageKey) this.storageKey = config.storageKey;
    if (config.serverEndpoint) this.serverEndpoint = config.serverEndpoint;
    return true;
  }

  /**
   * Synchronous `0ms` read from browser `localStorage`.
   * @returns {object|null}
   */
  readLocalSync() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      console.warn('[LocalRepo] Failed parsing localStorage state:', err);
      return null;
    }
  }

  /**
   * Synchronous `0ms` write to browser `localStorage`.
   * @param {object} state
   * @returns {string} ISO timestamp
   */
  writeLocalSync(state) {
    const updatedAt = new Date().toISOString();
    if (!state || typeof state !== 'object') return updatedAt;
    try {
      state._updatedAt = updatedAt;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(state));
      }
    } catch (err) {
      console.warn('[LocalRepo] localStorage write warning (quota or restricted mode):', err);
    }
    return updatedAt;
  }

  /**
   * Non-blocking async mirror to `server/server.py` (`POST /api/state`).
   * Silently degrades on static hosts (GitHub Pages).
   * @param {object} state
   * @returns {Promise<boolean>}
   */
  async _mirrorToLocalServerAsync(state) {
    if (typeof fetch !== 'function') return false;
    try {
      const res = await IDatabaseRepo.fetchWithTimeout(
        this.serverEndpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        },
        3000
      );
      if (res && res.ok) {
        this.serverAvailable = true;
        return true;
      }
      this.serverAvailable = false;
      return false;
    } catch (_err) {
      // Expected when hosted statically on GitHub Pages without server/server.py
      this.serverAvailable = false;
      return false;
    }
  }

  /**
   * Probes `GET /api/state` on `server/server.py` if available.
   * @returns {Promise<object|null>}
   */
  async _fetchFromLocalServer() {
    if (typeof fetch !== 'function') return null;
    try {
      const res = await IDatabaseRepo.fetchWithTimeout(
        this.serverEndpoint,
        { method: 'GET', cache: 'no-store' },
        2500
      );
      if (!res || !res.ok) {
        this.serverAvailable = false;
        return null;
      }
      const data = await res.json();
      this.serverAvailable = true;
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        return data;
      }
      return null;
    } catch (_err) {
      this.serverAvailable = false;
      return null;
    }
  }

  /**
   * Tests `localStorage` read/write and checks whether `server/server.py` is running.
   * @param {object} config
   * @returns {Promise<{ ok: boolean, provider: string, latencyMs: number, message: string, metadata: object }>}
   */
  async testConnection(config = {}) {
    await this.init(config);
    const t0 = Date.now();
    let localStorageOk = false;

    try {
      if (typeof localStorage !== 'undefined') {
        const probeKey = `${this.storageKey}__probe`;
        localStorage.setItem(probeKey, 'ok');
        localStorageOk = localStorage.getItem(probeKey) === 'ok';
        localStorage.removeItem(probeKey);
      }
    } catch (_e) {
      localStorageOk = false;
    }

    const serverData = await this._fetchFromLocalServer();
    const latencyMs = Math.max(0, Date.now() - t0);

    if (!localStorageOk && !this.serverAvailable) {
      return {
        ok: false,
        provider: 'local',
        latencyMs,
        message: 'אחסון הדפדפן המקומי (localStorage) חסום וגם השרת המקומי אינו פעיל.',
        metadata: { localStorageOk: false, serverSyncAvailable: false }
      };
    }

    const modeMsg = this.serverAvailable
      ? 'אחסון מקומי פעיל ב-0ms (דפדפן + סנכרון אוטומטי לקובץ data/daniel_state.json בשרת המקומי).'
      : 'אחסון דפדפן מקומי פעיל ב-0ms (מצב סטטי / GitHub Pages ללא שרת Python מקומי).';

    return {
      ok: true,
      provider: 'local',
      latencyMs,
      message: modeMsg,
      metadata: {
        localStorageOk,
        serverSyncAvailable: Boolean(this.serverAvailable),
        hasServerSnapshot: Boolean(serverData)
      }
    };
  }

  /**
   * Loads full state in `0ms` from `localStorage` if available; otherwise falls back
   * to `GET /api/state` from `server/server.py` when running locally.
   * @returns {Promise<{ state: object|null, source: string, updatedAt: string }>}
   */
  async loadFullState() {
    const localState = this.readLocalSync();
    if (localState && Object.keys(localState).length > 0) {
      // Non-blocking background check: if server has a strictly newer snapshot, keep server warm
      return {
        state: localState,
        source: 'local',
        updatedAt: localState._updatedAt || new Date().toISOString()
      };
    }

    const serverState = await this._fetchFromLocalServer();
    if (serverState && Object.keys(serverState).length > 0) {
      const ts = this.writeLocalSync(serverState);
      return {
        state: serverState,
        source: 'local:server',
        updatedAt: serverState._updatedAt || ts
      };
    }

    return {
      state: null,
      source: 'local',
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Saves full state synchronously (`0ms`) to `localStorage` and mirrors asynchronously
   * to `server/server.py` (`POST /api/state`) without blocking the UI.
   * @param {object} state
   * @returns {Promise<{ ok: boolean, provider: string, updatedAt: string }>}
   */
  async saveFullState(state) {
    if (!state || typeof state !== 'object') {
      return { ok: false, provider: 'local', updatedAt: new Date().toISOString() };
    }
    const updatedAt = this.writeLocalSync(state);
    // Fire-and-forget async mirror to server/server.py (silent on GitHub Pages)
    this._mirrorToLocalServerAsync(state).catch(() => {});
    return {
      ok: true,
      provider: 'local',
      updatedAt
    };
  }
}

if (typeof window !== 'undefined') {
  window.LocalRepo = LocalRepo;
}
if (typeof globalThis !== 'undefined') {
  globalThis.LocalRepo = LocalRepo;
}
