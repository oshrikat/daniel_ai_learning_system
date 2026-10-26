/**
 * GitHub Secret Gist Cloud Repository (`src/db/github/GithubRepo.js`)
 * Implements `window.GithubRepo` extending `IDatabaseRepo` using the official GitHub Gists REST API:
 * - Config fields: `{ token, gistId, filename: 'daniel_ai_cloud_state.json' }`.
 * - Auto-discovers an existing secret Gist containing `daniel_ai_cloud_state.json` or auto-creates
 *   a new secret Gist (`public: false`, description `'Daniel AI Learning System - Cloud Database State'`)
 *   whenever `token` is provided and `gistId` is empty!
 * - Supports full CRUD (`loadFullState`, `saveFullState`, `getAll`, `getById`, `add`, `update`, `delete`).
 */

const GITHUB_GISTS_API_BASE = 'https://api.github.com/gists';
const GITHUB_DEFAULT_FILENAME = 'daniel_ai_cloud_state.json';
const GITHUB_GIST_DESCRIPTION = 'Daniel AI Learning System - Cloud Database State';

class GithubRepo extends IDatabaseRepo {
  /**
   * @param {object} config
   */
  constructor(config = {}) {
    super('github');
    this.config = {
      token: '',
      gistId: '',
      filename: GITHUB_DEFAULT_FILENAME,
      ...config
    };
  }

  /**
   * @param {object} config
   * @returns {Promise<boolean>}
   */
  async init(config = {}) {
    await super.init(config);
    this.config.token = this._cleanStr(this.config.token);
    this.config.gistId = this._cleanStr(this.config.gistId);
    this.config.filename = this._cleanStr(this.config.filename) || GITHUB_DEFAULT_FILENAME;
    return true;
  }

  /**
   * @param {string} val
   * @returns {string}
   */
  _cleanStr(val) {
    if (!val || typeof val !== 'string') return '';
    return val.trim().replace(/^["']+|["']+$/g, '').trim();
  }

  /**
   * Builds GitHub REST API v2022-11-28 headers.
   * @param {string} token
   * @returns {object}
   */
  _buildHeaders(token) {
    return {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };
  }

  /**
   * Searches the authenticated user's gists for `filename`, or creates a new secret Gist
   * when `createIfMissing` is true.
   * @param {object} options
   * @returns {Promise<{ gistId: string, created: boolean, gist: object|null }>}
   */
  async _discoverOrCreateGist({ createIfMissing = true, initialState = null } = {}) {
    const token = this._cleanStr(this.config.token);
    const filename = this._cleanStr(this.config.filename) || GITHUB_DEFAULT_FILENAME;

    if (!token) {
      throw new Error('חסר Personal Access Token (בעל הרשאת gist) לחיבור ל-GitHub.');
    }

    // 1. If gistId is already configured, verify/return it
    if (this.config.gistId) {
      return { gistId: this.config.gistId, created: false, gist: null };
    }

    // 2. Search user's gists (up to 100 most recent, includes secret gists when authenticated)
    const listRes = await IDatabaseRepo.fetchWithTimeout(
      `${GITHUB_GISTS_API_BASE}?per_page=100`,
      {
        method: 'GET',
        headers: this._buildHeaders(token)
      },
      15000
    );

    if (!listRes.ok) {
      throw new Error(`GitHub Gists API שגיאת הרשאה או חיבור (HTTP ${listRes.status})`);
    }

    const gistsList = await listRes.json();
    if (Array.isArray(gistsList)) {
      const matched = gistsList.find(
        g => (g && g.files && g.files[filename]) || (g && g.description === GITHUB_GIST_DESCRIPTION)
      );
      if (matched && matched.id) {
        this.config.gistId = matched.id;
        return { gistId: matched.id, created: false, gist: matched };
      }
    }

    if (!createIfMissing) {
      return { gistId: '', created: false, gist: null };
    }

    // 3. Create a brand-new secret Gist
    const seedContent = initialState && typeof initialState === 'object'
      ? JSON.stringify({ ...initialState, _updatedAt: new Date().toISOString() }, null, 2)
      : JSON.stringify({
          _initializedBy: 'Daniel AI Learning System',
          _updatedAt: new Date().toISOString()
        }, null, 2);

    const createRes = await IDatabaseRepo.fetchWithTimeout(
      GITHUB_GISTS_API_BASE,
      {
        method: 'POST',
        headers: this._buildHeaders(token),
        body: JSON.stringify({
          description: GITHUB_GIST_DESCRIPTION,
          public: false,
          files: {
            [filename]: {
              content: seedContent
            }
          }
        })
      },
      15000
    );

    if (!createRes.ok) {
      throw new Error(`כשל ביצירת Gist פרטי חדש ב-GitHub (HTTP ${createRes.status})`);
    }

    const createdGist = await createRes.json();
    this.config.gistId = createdGist.id;
    return { gistId: createdGist.id, created: true, gist: createdGist };
  }

  /**
   * Tests GitHub token & Gist access (auto-discovering or auto-creating the secret Gist if `gistId` is empty).
   * @param {object} config
   * @returns {Promise<{ ok: boolean, provider: string, latencyMs: number, message: string, metadata?: object }>}
   */
  async testConnection(config = {}) {
    await this.init(config);
    const t0 = Date.now();
    const token = this._cleanStr(this.config.token);
    const filename = this._cleanStr(this.config.filename) || GITHUB_DEFAULT_FILENAME;

    if (!token) {
      return {
        ok: false,
        provider: 'github',
        latencyMs: 0,
        message: 'לא הוזן GitHub Token (נדרש טוקן עם הרשאת gist).'
      };
    }

    try {
      let createdNew = false;
      let gistData = null;

      if (!this.config.gistId) {
        const discovery = await this._discoverOrCreateGist({ createIfMissing: true });
        createdNew = discovery.created;
        gistData = discovery.gist;
      }

      if (!gistData && this.config.gistId) {
        const res = await IDatabaseRepo.fetchWithTimeout(
          `${GITHUB_GISTS_API_BASE}/${encodeURIComponent(this.config.gistId)}`,
          {
            method: 'GET',
            headers: this._buildHeaders(token)
          },
          15000
        );
        if (!res.ok) {
          return {
            ok: false,
            provider: 'github',
            latencyMs: Date.now() - t0,
            message: `לא ניתן לגשת ל-Gist המבוקש (${this.config.gistId}) — HTTP ${res.status}.`
          };
        }
        gistData = await res.json();
      }

      const latencyMs = Math.max(1, Date.now() - t0);
      return {
        ok: true,
        provider: 'github',
        latencyMs,
        message: createdNew
          ? `חיבור הצליח! נוצר אוטומטית Gist סודי חדש (${this.config.gistId}) בענן GitHub.`
          : `חיבור לענן GitHub Gist פעיל ותקין (${this.config.gistId}).`,
        metadata: {
          gistId: this.config.gistId,
          filename,
          created: createdNew,
          isSecret: gistData ? !gistData.public : true,
          htmlUrl: gistData?.html_url || ''
        }
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'github',
        latencyMs: Date.now() - t0,
        message: `שגיאת חיבור ל-GitHub Gist: ${err.message || String(err)}`
      };
    }
  }

  /**
   * Loads the JSON state stored in the secret GitHub Gist.
   * @returns {Promise<{ state: object|null, source: string, updatedAt: string }>}
   */
  async loadFullState() {
    const token = this._cleanStr(this.config.token);
    const filename = this._cleanStr(this.config.filename) || GITHUB_DEFAULT_FILENAME;
    if (!token) {
      throw new Error('[GithubRepo] Missing GitHub token for loadFullState()');
    }

    if (!this.config.gistId) {
      await this._discoverOrCreateGist({ createIfMissing: false });
    }
    if (!this.config.gistId) {
      return { state: null, source: 'github', updatedAt: new Date().toISOString() };
    }

    const res = await IDatabaseRepo.fetchWithTimeout(
      `${GITHUB_GISTS_API_BASE}/${encodeURIComponent(this.config.gistId)}`,
      {
        method: 'GET',
        headers: this._buildHeaders(token)
      },
      15000
    );

    if (!res.ok) {
      throw new Error(`GitHub Gist load failed (HTTP ${res.status})`);
    }

    const gist = await res.json();
    const files = gist && gist.files ? gist.files : {};
    const fileEntry = files[filename] || Object.values(files)[0];

    if (!fileEntry) {
      return { state: null, source: 'github', updatedAt: gist?.updated_at || new Date().toISOString() };
    }

    let rawJson = fileEntry.content || '';
    if (fileEntry.truncated && fileEntry.raw_url) {
      const rawRes = await IDatabaseRepo.fetchWithTimeout(
        fileEntry.raw_url,
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        },
        15000
      );
      if (rawRes.ok) {
        rawJson = await rawRes.text();
      }
    }

    if (!rawJson.trim()) {
      return { state: null, source: 'github', updatedAt: gist?.updated_at || new Date().toISOString() };
    }

    const parsed = JSON.parse(rawJson);
    // Ignore empty seed marker if no actual appState keys exist yet
    if (parsed && parsed._initializedBy && Object.keys(parsed).length <= 2) {
      return { state: null, source: 'github', updatedAt: parsed._updatedAt || gist?.updated_at || new Date().toISOString() };
    }

    return {
      state: parsed,
      source: 'github',
      updatedAt: parsed?._updatedAt || gist?.updated_at || new Date().toISOString()
    };
  }

  /**
   * Saves the full JSON state into the secret GitHub Gist (`PATCH /gists/{gist_id}`),
   * auto-discovering or auto-creating the secret Gist if `gistId` is empty.
   * @param {object} state
   * @returns {Promise<{ ok: boolean, provider: string, updatedAt: string, gistId: string }>}
   */
  async saveFullState(state) {
    const token = this._cleanStr(this.config.token);
    const filename = this._cleanStr(this.config.filename) || GITHUB_DEFAULT_FILENAME;
    if (!token) {
      throw new Error('[GithubRepo] Missing GitHub token for saveFullState()');
    }

    const updatedAt = new Date().toISOString();
    const payloadToSave = { ...(state || {}), _updatedAt: updatedAt };

    if (!this.config.gistId) {
      const discovery = await this._discoverOrCreateGist({
        createIfMissing: true,
        initialState: payloadToSave
      });
      if (discovery.created) {
        return {
          ok: true,
          provider: 'github',
          updatedAt,
          gistId: discovery.gistId
        };
      }
    }

    const res = await IDatabaseRepo.fetchWithTimeout(
      `${GITHUB_GISTS_API_BASE}/${encodeURIComponent(this.config.gistId)}`,
      {
        method: 'PATCH',
        headers: this._buildHeaders(token),
        body: JSON.stringify({
          description: GITHUB_GIST_DESCRIPTION,
          files: {
            [filename]: {
              content: JSON.stringify(payloadToSave, null, 2)
            }
          }
        })
      },
      20000
    );

    if (!res.ok) {
      throw new Error(`GitHub Gist save failed (HTTP ${res.status})`);
    }

    return {
      ok: true,
      provider: 'github',
      updatedAt,
      gistId: this.config.gistId
    };
  }
}

if (typeof window !== 'undefined') {
  window.GithubRepo = GithubRepo;
}
if (typeof globalThis !== 'undefined') {
  globalThis.GithubRepo = GithubRepo;
}
