/**
 * Unified Database Repository Interface & Base Class (`src/db/IDatabaseRepo.js`)
 * Defines and enforces the 3-tier Repository contract across all storage backends:
 * - LocalRepo (`localStorage` + `server/server.py` JSON file sync)
 * - GithubRepo (Secret GitHub Gist Cloud JSON DB)
 * - FirebaseRepo (Firebase Realtime Database REST API)
 * - CustomRestRepo (Generic REST API JSON endpoint)
 */

class IDatabaseRepo {
  /**
   * @param {string} providerName
   */
  constructor(providerName = 'abstract') {
    this.providerName = providerName;
    this.config = {};
    this.isInitialized = false;
  }

  /**
   * Initializes the repository with provider-specific configuration.
   * @param {object} config
   * @returns {Promise<boolean>}
   */
  async init(config = {}) {
    this.config = { ...this.config, ...(config || {}) };
    this.isInitialized = true;
    return true;
  }

  /**
   * Tests connectivity and credentials against the backend.
   * @param {object} config
   * @returns {Promise<{ ok: boolean, provider: string, latencyMs: number, message: string, metadata?: object }>}
   */
  async testConnection(config = {}) { // eslint-disable-line no-unused-vars
    throw new Error(`[IDatabaseRepo] testConnection() must be implemented by ${this.providerName}`);
  }

  /**
   * Loads the complete application state object from the backend.
   * @returns {Promise<{ state: object|null, source: string, updatedAt: string }>}
   */
  async loadFullState() {
    throw new Error(`[IDatabaseRepo] loadFullState() must be implemented by ${this.providerName}`);
  }

  /**
   * Persists the complete application state object to the backend.
   * @param {object} state
   * @returns {Promise<{ ok: boolean, provider: string, updatedAt: string }>}
   */
  async saveFullState(state) { // eslint-disable-line no-unused-vars
    throw new Error(`[IDatabaseRepo] saveFullState() must be implemented by ${this.providerName}`);
  }

  /**
   * Resolves a top-level or nested collection array inside a state object
   * (e.g. 'studyHelpUnits' or 'studyHelp.dailyCards').
   * @param {object} stateObj
   * @param {string} collectionName
   * @param {boolean} createIfMissing
   * @returns {Array}
   */
  _resolveCollection(stateObj, collectionName, createIfMissing = false) {
    if (!stateObj || typeof stateObj !== 'object' || !collectionName) return [];
    const parts = String(collectionName).split('.').filter(Boolean);
    let cursor = stateObj;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (!cursor[key] || typeof cursor[key] !== 'object') {
        if (!createIfMissing) return [];
        cursor[key] = {};
      }
      cursor = cursor[key];
    }
    const leafKey = parts[parts.length - 1];
    if (!Array.isArray(cursor[leafKey])) {
      if (!createIfMissing) return [];
      cursor[leafKey] = [];
    }
    return cursor[leafKey];
  }

  /**
   * Matches an item in a collection by `id` or `unit_id`.
   * @param {object} item
   * @param {string} id
   * @returns {boolean}
   */
  _matchesId(item, id) {
    if (!item || typeof item !== 'object') return false;
    const target = String(id);
    return String(item.id ?? '') === target || String(item.unit_id ?? '') === target;
  }

  /**
   * Returns all items in `collectionName`.
   * @param {string} collectionName
   * @returns {Promise<Array>}
   */
  async getAll(collectionName) {
    const { state } = await this.loadFullState();
    if (!state) return [];
    const list = this._resolveCollection(state, collectionName, false);
    return Array.isArray(list) ? [...list] : [];
  }

  /**
   * Returns a single item by `id` (or `unit_id`) from `collectionName`, or `null`.
   * @param {string} collectionName
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async getById(collectionName, id) {
    const list = await this.getAll(collectionName);
    return list.find(item => this._matchesId(item, id)) || null;
  }

  /**
   * Appends (or upserts if same id exists) `item` into `collectionName` and persists state.
   * @param {string} collectionName
   * @param {object} item
   * @returns {Promise<object>}
   */
  async add(collectionName, item) {
    const loaded = await this.loadFullState();
    const state = (loaded && loaded.state && typeof loaded.state === 'object') ? loaded.state : {};
    const list = this._resolveCollection(state, collectionName, true);

    const newItem = { ...(item || {}) };
    if (!newItem.id && !newItem.unit_id) {
      newItem.id = `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    const existingIdx = list.findIndex(existing => this._matchesId(existing, newItem.id || newItem.unit_id));
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...newItem };
    } else {
      list.push(newItem);
    }

    await this.saveFullState(state);
    return newItem;
  }

  /**
   * Updates an existing item in `collectionName` by `id` with `partialData` and persists state.
   * @param {string} collectionName
   * @param {string} id
   * @param {object} partialData
   * @returns {Promise<object|null>}
   */
  async update(collectionName, id, partialData = {}) {
    const loaded = await this.loadFullState();
    const state = (loaded && loaded.state && typeof loaded.state === 'object') ? loaded.state : null;
    if (!state) return null;

    const list = this._resolveCollection(state, collectionName, false);
    const idx = list.findIndex(item => this._matchesId(item, id));
    if (idx < 0) return null;

    const updatedItem = {
      ...list[idx],
      ...(partialData || {}),
      updatedAt: new Date().toISOString()
    };
    list[idx] = updatedItem;

    await this.saveFullState(state);
    return updatedItem;
  }

  /**
   * Deletes an item from `collectionName` by `id` and persists state.
   * @param {string} collectionName
   * @param {string} id
   * @returns {Promise<{ ok: boolean, deletedId: string }>}
   */
  async delete(collectionName, id) {
    const loaded = await this.loadFullState();
    const state = (loaded && loaded.state && typeof loaded.state === 'object') ? loaded.state : null;
    if (!state) return { ok: false, deletedId: String(id) };

    const list = this._resolveCollection(state, collectionName, false);
    const idx = list.findIndex(item => this._matchesId(item, id));
    if (idx < 0) return { ok: false, deletedId: String(id) };

    list.splice(idx, 1);
    await this.saveFullState(state);
    return { ok: true, deletedId: String(id) };
  }

  /**
   * Validates that a repository instance implements the full IDatabaseRepo contract.
   * @param {object} repoInstance
   * @returns {{ valid: boolean, missingMethods: string[] }}
   */
  static validateImplementation(repoInstance) {
    const requiredMethods = [
      'init',
      'testConnection',
      'loadFullState',
      'saveFullState',
      'getAll',
      'getById',
      'add',
      'update',
      'delete'
    ];
    const missingMethods = requiredMethods.filter(
      fnName => !repoInstance || typeof repoInstance[fnName] !== 'function'
    );
    return {
      valid: missingMethods.length === 0,
      missingMethods
    };
  }

  /**
   * Executes a `fetch()` call protected by an `AbortController` timeout.
   * @param {string} url
   * @param {object} options
   * @param {number} timeoutMs
   * @returns {Promise<Response>}
   */
  static async fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      return await fetch(url, {
        ...options,
        ...(controller ? { signal: controller.signal } : {})
      });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new Error(`החיבור לשרת חרג ממגבלת הזמן (${Math.round(timeoutMs / 1000)} שניות)`);
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

if (typeof window !== 'undefined') {
  window.IDatabaseRepo = IDatabaseRepo;
}
if (typeof globalThis !== 'undefined') {
  globalThis.IDatabaseRepo = IDatabaseRepo;
}
