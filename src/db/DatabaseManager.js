/**
 * 3-Tier Database Manager & Write-Through Orchestrator (`src/db/DatabaseManager.js`)
 * Implements `window.DatabaseManager`:
 * - Registry of providers: `'github'` (`GithubRepo`), `'firebase'` (`FirebaseRepo`),
 *   `'custom'` (`CustomRestRepo`), and `'local'` (`LocalRepo`).
 * - Always maintains an instant `0ms` local write-through cache via `LocalRepo`, while
 *   syncing asynchronously to the active cloud provider (`github` / `firebase` / `custom`)
 *   with a 1.2-second (`1200ms`) debounce and a non-blocking warning toast if offline.
 * - `purgeUnitImages(unitId)`: strips heavy base64 `pageSnapshots` and `inlineImages` from
 *   completed units while preserving `sourceReferenceLabel` and `pageCount`.
 * - `migrateToProvider(newProviderType, newConfig)`: validates connectivity and pushes the
 *   complete current `appState` to the target provider in a single click.
 */

const DB_CONFIG_STORAGE_KEY = 'DANIEL_AI_DB_CONFIG_V1';
const CLOUD_SYNC_DEBOUNCE_MS = 1200;
const OFFLINE_TOAST_COOLDOWN_MS = 45000;

const DatabaseManager = {
  providers: {},
  localCacheRepo: null,
  activeProviderType: 'local',
  providerConfigs: {
    local: {},
    github: { token: '', gistId: '', filename: 'daniel_ai_cloud_state.json' },
    firebase: { databaseUrl: '', authSecret: '' },
    custom: { endpointUrl: '', apiKey: '', saveMethod: 'POST' }
  },
  syncStatus: {
    state: 'idle', // 'idle' | 'syncing' | 'synced' | 'offline_error'
    lastSyncedAt: null,
    lastError: null
  },
  _syncTimer: null,
  _pendingStateSnapshot: null,
  _lastToastAt: 0,
  _statusListeners: [],
  _initialized: false,

  /**
   * Ensures all 4 repository instances exist and validate against `IDatabaseRepo`.
   */
  _ensureRegistry() {
    if (!this.localCacheRepo) {
      this.localCacheRepo = new LocalRepo();
    }
    if (!this.providers.local) {
      this.providers.local = this.localCacheRepo;
    }
    if (!this.providers.github && typeof GithubRepo === 'function') {
      this.providers.github = new GithubRepo(this.providerConfigs.github);
    }
    if (!this.providers.firebase && typeof FirebaseRepo === 'function') {
      this.providers.firebase = new FirebaseRepo(this.providerConfigs.firebase);
    }
    if (!this.providers.custom && typeof CustomRestRepo === 'function') {
      this.providers.custom = new CustomRestRepo(this.providerConfigs.custom);
    }

    Object.entries(this.providers).forEach(([key, instance]) => {
      const check = IDatabaseRepo.validateImplementation(instance);
      if (!check.valid) {
        console.error(`[DatabaseManager] Provider '${key}' missing methods:`, check.missingMethods);
      }
    });
  },

  /**
   * Loads persisted DB configuration from `localStorage` (`DANIEL_AI_DB_CONFIG_V1`) or `appState.dbConfig`.
   */
  _loadSavedDbConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(DB_CONFIG_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (parsed.activeProviderType && ['local', 'github', 'firebase', 'custom'].includes(parsed.activeProviderType)) {
              this.activeProviderType = parsed.activeProviderType;
            }
            if (parsed.providerConfigs && typeof parsed.providerConfigs === 'object') {
              this.providerConfigs = {
                local: { ...this.providerConfigs.local, ...(parsed.providerConfigs.local || {}) },
                github: { ...this.providerConfigs.github, ...(parsed.providerConfigs.github || {}) },
                firebase: { ...this.providerConfigs.firebase, ...(parsed.providerConfigs.firebase || {}) },
                custom: { ...this.providerConfigs.custom, ...(parsed.providerConfigs.custom || {}) }
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('[DatabaseManager] Could not read saved DB config:', err);
    }
  },

  /**
   * Persists active provider selection & credentials to `localStorage` (`DANIEL_AI_DB_CONFIG_V1`).
   */
  _persistDbConfig() {
    const snapshot = {
      activeProviderType: this.activeProviderType,
      providerConfigs: this.providerConfigs
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DB_CONFIG_STORAGE_KEY, JSON.stringify(snapshot));
      }
      if (typeof appState !== 'undefined' && appState && typeof appState === 'object') {
        appState.dbConfig = snapshot;
      }
    } catch (err) {
      console.warn('[DatabaseManager] Failed saving DB config:', err);
    }
  },

  /**
   * Subscribes to sync status updates (`idle`, `syncing`, `synced`, `offline_error`).
   * @param {function} listener
   * @returns {function} unsubscribe function
   */
  onStatusChange(listener) {
    if (typeof listener !== 'function') return () => {};
    this._statusListeners.push(listener);
    return () => {
      this._statusListeners = this._statusListeners.filter(fn => fn !== listener);
    };
  },

  /**
   * @param {object} patch
   */
  _emitStatus(patch = {}) {
    this.syncStatus = { ...this.syncStatus, ...patch };
    this._statusListeners.forEach(fn => {
      try {
        fn({ ...this.syncStatus, activeProviderType: this.activeProviderType });
      } catch (_e) {}
    });
  },

  /**
   * Initializes `DatabaseManager`, its local write-through cache, and the active provider.
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async init(options = {}) {
    this._ensureRegistry();
    this._loadSavedDbConfig();

    if (options.activeProviderType && this.providers[options.activeProviderType]) {
      this.activeProviderType = options.activeProviderType;
    }
    if (options.providerConfigs && typeof options.providerConfigs === 'object') {
      Object.keys(options.providerConfigs).forEach(pKey => {
        if (this.providerConfigs[pKey]) {
          this.providerConfigs[pKey] = {
            ...this.providerConfigs[pKey],
            ...(options.providerConfigs[pKey] || {})
          };
        }
      });
    }

    await this.localCacheRepo.init(this.providerConfigs.local);
    const activeRepo = this.getActiveRepo();
    if (activeRepo && activeRepo !== this.localCacheRepo) {
      await activeRepo.init(this.providerConfigs[this.activeProviderType] || {});
    }

    this._persistDbConfig();
    this._initialized = true;
    return this.getStatus();
  },

  /**
   * Returns the active repository instance (`LocalRepo`, `GithubRepo`, `FirebaseRepo`, or `CustomRestRepo`).
   * @returns {IDatabaseRepo}
   */
  getActiveRepo() {
    this._ensureRegistry();
    return this.providers[this.activeProviderType] || this.localCacheRepo;
  },

  /**
   * Returns current provider type, config summary, and sync status.
   * @returns {object}
   */
  getStatus() {
    return {
      activeProviderType: this.activeProviderType,
      providerConfigs: JSON.parse(JSON.stringify(this.providerConfigs)),
      syncStatus: { ...this.syncStatus }
    };
  },

  /**
   * Tests connectivity for any provider (`'local'`, `'github'`, `'firebase'`, `'custom'`) without switching active provider unless requested.
   * @param {string} [providerType]
   * @param {object} [config]
   * @returns {Promise<{ ok: boolean, provider: string, latencyMs: number, message: string, metadata?: object }>}
   */
  async testConnection(providerType = this.activeProviderType, config = null) {
    this._ensureRegistry();
    const repo = this.providers[providerType];
    if (!repo) {
      return {
        ok: false,
        provider: String(providerType),
        latencyMs: 0,
        message: `ספק מסד נתונים לא מוכר: ${providerType}`
      };
    }

    const mergedConfig = {
      ...(this.providerConfigs[providerType] || {}),
      ...(config || {})
    };
    const res = await repo.testConnection(mergedConfig);

    // Persist auto-discovered/created metadata such as GithubRepo's secret `gistId`
    if (res.ok) {
      this.providerConfigs[providerType] = {
        ...mergedConfig,
        ...(res.metadata && res.metadata.gistId ? { gistId: res.metadata.gistId } : {})
      };
      this._persistDbConfig();
    }

    return res;
  },

  /**
   * Loads full state:
   * - Reads `LocalRepo` immediately;
   * - If active provider is a cloud repo (`github` / `firebase` / `custom`), fetches cloud state
   *   and picks whichever snapshot is newer (or cloud state if local is empty), updating `LocalRepo` cache!
   * @returns {Promise<{ state: object|null, source: string, updatedAt: string }>}
   */
  async loadFullState() {
    if (!this._initialized) {
      await this.init();
    }

    const localResult = await this.localCacheRepo.loadFullState();
    if (this.activeProviderType === 'local') {
      return localResult;
    }

    const activeRepo = this.getActiveRepo();
    try {
      this._emitStatus({ state: 'syncing', lastError: null });
      const cloudResult = await activeRepo.loadFullState();

      if (cloudResult && cloudResult.state && typeof cloudResult.state === 'object') {
        const localTs = Date.parse(localResult?.state?._updatedAt || '') || 0;
        const cloudTs = Date.parse(cloudResult.state._updatedAt || cloudResult.updatedAt || '') || 0;

        if (!localResult?.state || cloudTs >= localTs) {
          this.localCacheRepo.writeLocalSync(cloudResult.state);
          this._emitStatus({ state: 'synced', lastSyncedAt: new Date().toISOString(), lastError: null });
          return cloudResult;
        }
      }

      this._emitStatus({ state: 'synced', lastSyncedAt: new Date().toISOString(), lastError: null });
      return localResult;
    } catch (err) {
      console.warn(`[DatabaseManager] Cloud load failed (${this.activeProviderType}), falling back to local cache:`, err);
      this._emitStatus({ state: 'offline_error', lastError: err.message || String(err) });
      this._notifyOfflineWarning(err);
      return localResult;
    }
  },

  /**
   * Writes immediately (`0ms`) to `LocalRepo` write-through cache AND schedules a 1.2-second
   * debounced async sync to the active cloud provider (`github` / `firebase` / `custom`).
   * Pass `{ immediateCloud: true }` to await cloud persistence right away.
   * @param {object} state
   * @param {object} [options]
   * @returns {Promise<{ ok: boolean, provider: string, updatedAt: string }>}
   */
  async saveFullState(state, options = {}) {
    if (!this._initialized) {
      await this.init();
    }
    if (!state || typeof state !== 'object') {
      return { ok: false, provider: this.activeProviderType, updatedAt: new Date().toISOString() };
    }

    // 1. Instant 0ms write-through to LocalRepo
    const localSaveRes = await this.localCacheRepo.saveFullState(state);

    // 2. If local is the active provider, we're done!
    if (this.activeProviderType === 'local') {
      this._emitStatus({ state: 'synced', lastSyncedAt: localSaveRes.updatedAt, lastError: null });
      return localSaveRes;
    }

    // 3. Cloud provider active: either flush immediately or debounce by 1.2s
    if (options.immediateCloud) {
      return this.flushCloudSync(state);
    }

    this.scheduleCloudSync(state);
    return {
      ok: true,
      provider: `${this.activeProviderType}:queued`,
      updatedAt: localSaveRes.updatedAt
    };
  },

  /**
   * Schedules a 1.2-second debounced non-blocking sync to the active cloud provider.
   * @param {object} state
   */
  scheduleCloudSync(state) {
    this._pendingStateSnapshot = state;
    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
    }
    this._syncTimer = setTimeout(() => {
      this._syncTimer = null;
      const snapshot = this._pendingStateSnapshot;
      this._pendingStateSnapshot = null;
      if (snapshot) {
        this.flushCloudSync(snapshot).catch(() => {});
      }
    }, CLOUD_SYNC_DEBOUNCE_MS);
  },

  /**
   * Immediately pushes `state` to the active cloud provider (`github`, `firebase`, or `custom`).
   * @param {object} state
   * @returns {Promise<{ ok: boolean, provider: string, updatedAt: string }>}
   */
  async flushCloudSync(state) {
    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
      this._syncTimer = null;
    }

    const activeRepo = this.getActiveRepo();
    if (!activeRepo || this.activeProviderType === 'local') {
      return this.localCacheRepo.saveFullState(state);
    }

    try {
      this._emitStatus({ state: 'syncing', lastError: null });
      await activeRepo.init(this.providerConfigs[this.activeProviderType] || {});
      const cloudRes = await activeRepo.saveFullState(state);

      // Persist auto-created gistId if GithubRepo created one on first save
      if (this.activeProviderType === 'github' && activeRepo.config?.gistId) {
        this.providerConfigs.github.gistId = activeRepo.config.gistId;
        this._persistDbConfig();
      }

      const syncedAt = cloudRes.updatedAt || new Date().toISOString();
      this._emitStatus({ state: 'synced', lastSyncedAt: syncedAt, lastError: null });
      return cloudRes;
    } catch (err) {
      console.warn(`[DatabaseManager] Cloud sync error (${this.activeProviderType}):`, err);
      this._emitStatus({ state: 'offline_error', lastError: err.message || String(err) });
      this._notifyOfflineWarning(err);
      return {
        ok: false,
        provider: this.activeProviderType,
        updatedAt: new Date().toISOString()
      };
    }
  },

  /**
   * Displays a calm, non-blocking toast if cloud sync fails while offline (throttled to avoid spam).
   * @param {Error} err
   */
  _notifyOfflineWarning(err) {
    const now = Date.now();
    if (now - this._lastToastAt < OFFLINE_TOAST_COOLDOWN_MS) return;
    this._lastToastAt = now;
    if (typeof showToast === 'function') {
      showToast(
        `הנתונים נשמרו מקומית בבטחה 💾 (סנכרון הענן בהמתנה: ${err?.message || 'אין חיבור רשת'})`,
        'warning'
      );
    }
  },

  // ==========================================================================
  // UNIFIED COLLECTION CRUD DELEGATION (Instant Local Cache + Debounced Cloud)
  // ==========================================================================

  async getAll(collectionName) {
    this._ensureRegistry();
    return this.localCacheRepo.getAll(collectionName);
  },

  async getById(collectionName, id) {
    this._ensureRegistry();
    return this.localCacheRepo.getById(collectionName, id);
  },

  async add(collectionName, item) {
    this._ensureRegistry();
    const added = await this.localCacheRepo.add(collectionName, item);
    if (this.activeProviderType !== 'local') {
      const latest = this.localCacheRepo.readLocalSync();
      if (latest) this.scheduleCloudSync(latest);
    }
    return added;
  },

  async update(collectionName, id, partialData) {
    this._ensureRegistry();
    const updated = await this.localCacheRepo.update(collectionName, id, partialData);
    if (updated && this.activeProviderType !== 'local') {
      const latest = this.localCacheRepo.readLocalSync();
      if (latest) this.scheduleCloudSync(latest);
    }
    return updated;
  },

  async delete(collectionName, id) {
    this._ensureRegistry();
    const res = await this.localCacheRepo.delete(collectionName, id);
    if (res.ok && this.activeProviderType !== 'local') {
      const latest = this.localCacheRepo.readLocalSync();
      if (latest) this.scheduleCloudSync(latest);
    }
    return res;
  },

  // ==========================================================================
  // STORAGE OPTIMIZATION & ONE-CLICK CLOUD MIGRATION
  // ==========================================================================

  /**
   * Strips heavy base64 `pageSnapshots` and `inlineImages` from a completed Study Help unit,
   * preserving `sourceReferenceLabel` (e.g. `"📍 מקור בתיקייה שלך: קובץ '...' • עמודים 1-N"`)
   * and persisting the lightweight state immediately.
   * @param {string} unitId
   * @returns {Promise<{ purged: boolean, unitId: string, sourceReferenceLabel: string }>}
   */
  async purgeUnitImages(unitId) {
    this._ensureRegistry();
    const targetState = (typeof appState !== 'undefined' && appState && typeof appState === 'object')
      ? appState
      : (this.localCacheRepo.readLocalSync() || {});

    let purged = false;
    let referenceLabel = '';

    const stripFromUnitObj = (unit) => {
      if (!unit || typeof unit !== 'object') return;
      const pageCount = Number(unit.pageCount) ||
        (Array.isArray(unit.pageSnapshots) && unit.pageSnapshots.length) ||
        (Array.isArray(unit.inlineImages) && unit.inlineImages.length) ||
        1;
      const fileTitle = unit.sourceFileName || unit.lesson_title || unit.title || 'שיעור יומי';
      const label = unit.sourceReferenceLabel ||
        `📍 מקור בתיקייה שלך: קובץ '${fileTitle}' • עמודים 1-${pageCount}`;

      unit.pageCount = pageCount;
      unit.sourceReferenceLabel = label;
      unit.imagesPurged = true;
      unit.imagesPurgedAt = new Date().toISOString();
      unit.pageSnapshots = [];
      unit.inlineImages = [];
      if ('rawPdfPart' in unit) delete unit.rawPdfPart;
      if ('rawPdfBase64' in unit) delete unit.rawPdfBase64;

      purged = true;
      referenceLabel = label;
    };

    const matchUnit = (u) => u && (String(u.id) === String(unitId) || String(u.unit_id) === String(unitId));

    if (Array.isArray(targetState.studyHelpUnits)) {
      targetState.studyHelpUnits.filter(matchUnit).forEach(stripFromUnitObj);
    }
    if (targetState.studyHelp && Array.isArray(targetState.studyHelp.dailyCards)) {
      targetState.studyHelp.dailyCards.filter(matchUnit).forEach(stripFromUnitObj);
    }

    if (purged) {
      await this.saveFullState(targetState, { immediateCloud: false });
      if (typeof saveAppState === 'function' && typeof appState !== 'undefined' && targetState === appState) {
        try {
          saveAppState();
        } catch (_e) {}
      }
    }

    return {
      purged,
      unitId: String(unitId),
      sourceReferenceLabel: referenceLabel
    };
  },

  /**
   * One-click migration to a new database provider (`'github'`, `'firebase'`, `'custom'`, or `'local'`):
   * 1. Tests the new provider connection & credentials (auto-creating secret Gist if GitHub + empty `gistId`).
   * 2. Pushes the entire current `appState` immediately to the new provider.
   * 3. Switches `activeProviderType` and persists the configuration.
   * @param {string} newProviderType
   * @param {object} [newConfig]
   * @returns {Promise<{ ok: boolean, provider: string, message: string, updatedAt?: string, metadata?: object }>}
   */
  async migrateToProvider(newProviderType, newConfig = {}) {
    this._ensureRegistry();
    const targetRepo = this.providers[newProviderType];
    if (!targetRepo) {
      return {
        ok: false,
        provider: String(newProviderType),
        message: `ספק יעד לא קיים במערכת: ${newProviderType}`
      };
    }

    // 1. Validate connection & credentials on target provider
    const testResult = await this.testConnection(newProviderType, newConfig);
    if (!testResult.ok) {
      return {
        ok: false,
        provider: newProviderType,
        message: testResult.message
      };
    }

    // 2. Gather complete current state (from live appState or LocalRepo cache)
    const currentState = (typeof appState !== 'undefined' && appState && typeof appState === 'object')
      ? appState
      : (this.localCacheRepo.readLocalSync() || {});

    // 3. Push full state to target provider immediately
    try {
      await targetRepo.init(this.providerConfigs[newProviderType] || newConfig);
      const saveResult = await targetRepo.saveFullState(currentState);

      if (newProviderType === 'github' && targetRepo.config?.gistId) {
        this.providerConfigs.github.gistId = targetRepo.config.gistId;
      }

      this.activeProviderType = newProviderType;
      this.localCacheRepo.writeLocalSync(currentState);
      this._persistDbConfig();
      this._emitStatus({
        state: 'synced',
        lastSyncedAt: saveResult.updatedAt || new Date().toISOString(),
        lastError: null
      });

      return {
        ok: true,
        provider: newProviderType,
        updatedAt: saveResult.updatedAt,
        metadata: {
          ...(testResult.metadata || {}),
          ...(targetRepo.config?.gistId ? { gistId: targetRepo.config.gistId } : {})
        },
        message: `המעבר לספק '${newProviderType}' הושלם בהצלחה! כל הנתונים של דניאל הועברו וסונכרנו ב-100%.`
      };
    } catch (err) {
      return {
        ok: false,
        provider: newProviderType,
        message: `החיבור הצליח אך העברת הנתונים נכשלה: ${err.message || String(err)}`
      };
    }
  }
};

if (typeof window !== 'undefined') {
  window.DatabaseManager = DatabaseManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.DatabaseManager = DatabaseManager;
}
