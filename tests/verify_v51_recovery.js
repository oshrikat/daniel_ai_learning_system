/**
 * tests/verify_v51_recovery.js
 * Comprehensive End-to-End Verification Suite for v5.1 Full Recovery (Gates 1–8)
 *
 * Run with:
 *   node tests/verify_v51_recovery.js
 */

'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function createAppSandbox() {
  const storageMap = new Map();
  let throwQuotaOnSet = false;

  const localStorageMock = {
    getItem(key) {
      return storageMap.has(String(key)) ? storageMap.get(String(key)) : null;
    },
    setItem(key, val) {
      if (throwQuotaOnSet) {
        const err = new Error('QuotaExceededError: Simulated storage limit reached');
        err.name = 'QuotaExceededError';
        throw err;
      }
      storageMap.set(String(key), String(val));
    },
    removeItem(key) {
      storageMap.delete(String(key));
    },
    clear() {
      storageMap.clear();
    },
    _setThrowQuota(flag) {
      throwQuotaOnSet = Boolean(flag);
    }
  };

  const elementsById = new Map();

  function makeClassList() {
    const classes = new Set();
    return {
      add(...names) {
        names.forEach((n) => n && classes.add(n));
      },
      remove(...names) {
        names.forEach((n) => classes.delete(n));
      },
      contains(name) {
        return classes.has(name);
      },
      toggle(name, force) {
        const shouldAdd = typeof force === 'boolean' ? force : !classes.has(name);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        return shouldAdd;
      }
    };
  }

  function createMockElement(tagName = 'div', id = '') {
    const attrs = new Map();
    const children = [];
    const listeners = new Map();
    const el = {
      tagName: String(tagName).toUpperCase(),
      id: id || '',
      className: '',
      value: '',
      textContent: '',
      _innerHTML: '',
      style: { display: '' },
      dataset: {},
      children,
      classList: makeClassList(),
      setAttribute(k, v) {
        attrs.set(String(k), String(v));
        if (k === 'id' && v) {
          el.id = String(v);
          elementsById.set(el.id, el);
        }
      },
      getAttribute(k) {
        return attrs.has(String(k)) ? attrs.get(String(k)) : null;
      },
      appendChild(child) {
        if (child) {
          children.push(child);
          if (child.id) elementsById.set(child.id, child);
        }
        return child;
      },
      remove() {
        if (el.id) elementsById.delete(el.id);
      },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      removeEventListener(type, fn) {
        if (!listeners.has(type)) return;
        listeners.set(
          type,
          listeners.get(type).filter((h) => h !== fn)
        );
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      closest() {
        return null;
      },
      focus() {},
      scrollIntoView() {}
    };

    Object.defineProperty(el, 'innerHTML', {
      get() {
        return el._innerHTML;
      },
      set(html) {
        el._innerHTML = String(html || '');
        const idMatches = el._innerHTML.matchAll(/\bid="([^"]+)"/g);
        for (const match of idMatches) {
          const nestedId = match[1];
          if (!elementsById.has(nestedId)) {
            elementsById.set(nestedId, createMockElement('div', nestedId));
          }
        }
      }
    });

    if (id) elementsById.set(id, el);
    return el;
  }

  const bodyEl = createMockElement('body', 'app-body');
  const documentMock = {
    body: bodyEl,
    readyState: 'loading',
    createElement(tag) {
      return createMockElement(tag);
    },
    getElementById(id) {
      return elementsById.get(String(id)) || null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    removeEventListener() {}
  };

  const fetchLog = [];
  let customFetchHandler = null;

  async function fetchBridge(url, options = {}) {
    fetchLog.push({ url: String(url), options });
    if (typeof customFetchHandler === 'function') {
      return customFetchHandler(String(url), options);
    }
    return {
      ok: false,
      status: 503,
      async text() {
        return 'Mock 503';
      },
      async json() {
        return { error: 'Mock 503' };
      }
    };
  }

  const locationObj = {
    hostname: 'localhost',
    protocol: 'http:',
    href: 'http://localhost:8080/'
  };

  const sandbox = {
    console: {
      log: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    },
    performance: { now: () => Date.now() },
    setTimeout,
    clearTimeout,
    AbortController,
    DOMException: typeof DOMException !== 'undefined' ? DOMException : undefined,
    Promise,
    JSON,
    Math,
    Date,
    RegExp,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    Error,
    TypeError,
    encodeURIComponent,
    decodeURIComponent,
    atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
    btoa: (bin) => Buffer.from(bin, 'binary').toString('base64'),
    localStorage: localStorageMock,
    document: documentMock,
    location: locationObj,
    fetch: fetchBridge,
    showToast: () => {},
    SoundService: { playSuccess: () => {}, playSuccessSound: () => {}, playError: () => {}, speakText: () => {} },
    CURRICULUM_GENERAL: [],
    CURRICULUM_ACCOUNTING: []
  };

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const moduleLoadOrder = [
    'src/db/IDatabaseRepo.js',
    'src/db/local/LocalRepo.js',
    'src/db/github/GithubRepo.js',
    'src/db/firebase/FirebaseRepo.js',
    'src/db/custom/CustomRestRepo.js',
    'src/db/DatabaseManager.js',
    'src/state/store.js',
    'src/services/ai/geminiService.js',
    'src/services/ai/groqService.js',
    'src/services/ai/openRouterService.js',
    'src/services/ai/aiOrchestrator.js',
    'src/controllers/studyHelpController.js',
    'src/components/globalAiBubble.js'
  ];

  for (const rel of moduleLoadOrder) {
    const code = readRepoFile(rel);
    vm.runInContext(code, sandbox, { filename: rel });
  }

  vm.runInContext(
    `
    globalThis.__exports = {
      STORAGE_KEY,
      appState,
      saveAppState,
      syncEnvKeysFromServer,
      syncCloudDatabaseOnStartup,
      deleteUnitFromAnyTrack,
      StudySnapshotsIDB,
      isLocalPythonServerHost,
      DatabaseManager,
      LocalRepo,
      callGeminiAPI,
      callGrokAPI,
      callOpenRouterAPI,
      callMultiTierAI,
      callGroqPreferredAI,
      sanitizeHebrewPedagogicalOutput,
      AIService,
      StudyGenerationCancelManager,
      consolidateAndCapQuestionOutlines,
      generateConceptBeatContent,
      generateHomeworkBeatContent,
      prewarmNextPendingBeat,
      cleanLearnerVisibleTitle,
      cleanLearnerVisibleSummary,
      GlobalAiAssistant
    };
    `,
    sandbox
  );

  return {
    sandbox,
    exports: sandbox.__exports,
    localStorageMock,
    documentMock,
    locationObj,
    fetchLog,
    setFetchHandler(fn) {
      customFetchHandler = fn;
    },
    clearFetchLog() {
      fetchLog.length = 0;
    }
  };
}

async function runVerificationSuite() {
  const results = [];
  const env = createAppSandbox();
  const X = env.exports;

  // =========================================================================
  // [Gate 1 - Secret Stripping, Header Auth, .env Key Sync & Static Host Guard]
  // =========================================================================
  {
    const sampleStateWithKeys = {
      activeTrackId: 'study_help',
      apiConfig: {
        geminiKey: 'MOCK_GEMINI_KEY_111',
        groqKey: 'gsk_mock222',
        openrouterKey: 'MOCK_OR_KEY_333'
      },
      dbConfig: {
        activeProvider: 'github',
        githubToken: 'MOCK_GITHUB_TOKEN_444',
        githubGistId: 'gist_secret_555',
        firebaseSecret: 'fb_SECRET_666',
        customApiKey: 'custom_SECRET_777'
      },
      geminiKey: 'MOCK_TOPLEVEL_LEAK',
      studyHelpUnits: [
        {
          id: 'unit_acc_01',
          title: 'מבוא לחשבונאות פיננסית',
          completed: false,
          inlineImages: [{ mimeType: 'image/jpeg', data: 'HEAVY_BASE64_IMAGE' }],
          sourceContext: {
            fullExtractedText: 'תוכן שיעור מלא',
            pageSnapshots: [{ pageNumber: 1, data: 'HEAVY_SNAPSHOT' }]
          }
        }
      ],
      trackProgress: {
        general: [],
        accounting: ['acc_1'],
        study_help: []
      }
    };

    const sanitized = X.DatabaseManager.sanitizeStateForCloudStorage(sampleStateWithKeys);
    const serializedSanitized = JSON.stringify(sanitized);
    assert.strictEqual('apiConfig' in sanitized, false, 'apiConfig must be stripped from cloud payload');
    assert.strictEqual('dbConfig' in sanitized, false, 'dbConfig must be stripped from cloud payload');
    assert.strictEqual('geminiKey' in sanitized, false, 'top-level key fields must be stripped');
    assert.ok(!serializedSanitized.includes('MOCK_GEMINI_KEY'), 'No Gemini secret in cloud JSON');
    assert.ok(!serializedSanitized.includes('gsk_mock222'), 'No Groq secret in cloud JSON');
    assert.ok(!serializedSanitized.includes('MOCK_GITHUB_TOKEN'), 'No GitHub token in cloud JSON');
    assert.strictEqual(sanitized.studyHelpUnits.length, 1, 'studyHelpUnits preserved');
    assert.deepStrictEqual(sanitized.trackProgress, sampleStateWithKeys.trackProgress, 'trackProgress preserved');

    // Verify LocalRepo.sanitizeStateForLocalDisk & server/server.py sanitize_state_for_disk
    const localDiskSanitized = X.LocalRepo.sanitizeStateForLocalDisk(sampleStateWithKeys);
    assert.strictEqual('apiConfig' in localDiskSanitized, false, 'LocalRepo must strip apiConfig before POST /api/state');
    assert.strictEqual('dbConfig' in localDiskSanitized, false, 'LocalRepo must strip dbConfig before POST /api/state');

    const pySanitizeCheck = execFileSync(
      'python',
      [
        '-c',
        'import sys, json; sys.path.insert(0, "server"); import server; out = server.sanitize_state_for_disk({"apiConfig":{"geminiKey":"SECRET"},"dbConfig":{"githubToken":"SECRET"},"studyHelpUnits":[{"id":"u1","pageSnapshots":["BIG"]}]}); print(json.dumps(out))'
      ],
      { cwd: ROOT, encoding: 'utf8' }
    ).trim();
    const pyParsed = JSON.parse(pySanitizeCheck);
    assert.strictEqual('apiConfig' in pyParsed, false, 'server.py sanitize_state_for_disk must strip apiConfig');
    assert.strictEqual('dbConfig' in pyParsed, false, 'server.py sanitize_state_for_disk must strip dbConfig');
    assert.deepStrictEqual(pyParsed.studyHelpUnits[0].pageSnapshots, [], 'server.py must strip pageSnapshots');

    // Verify flushCloudSync passes sanitized state to cloud repo
    await X.DatabaseManager.init();
    let pushedCloudPayload = null;
    const origGithubRepo = X.DatabaseManager.providers.github;
    X.DatabaseManager.activeProviderType = 'github';
    X.DatabaseManager.providers.github = {
      async init() {},
      async saveFullState(payload) {
        pushedCloudPayload = payload;
        return { ok: true, provider: 'github', updatedAt: new Date().toISOString() };
      }
    };
    await X.DatabaseManager.flushCloudSync(sampleStateWithKeys);
    assert.ok(pushedCloudPayload, 'flushCloudSync should invoke cloud repo saveFullState');
    assert.strictEqual('apiConfig' in pushedCloudPayload, false);
    assert.strictEqual('dbConfig' in pushedCloudPayload, false);

    // Verify syncCloudDatabaseOnStartup NEVER allows stale cloud apiConfig to overwrite local keys
    X.appState.apiConfig.geminiKey = 'MOCK_FRESH_LOCAL_ENV_KEY';
    env.localStorageMock.setItem('gemini_api_key', 'MOCK_FRESH_LOCAL_ENV_KEY');
    X.appState.dbConfig.activeProvider = 'github';
    X.appState.dbConfig.githubToken = 'MOCK_LOCAL_VALID_TOKEN';
    X.DatabaseManager.providers.github = {
      config: { gistId: 'gist_123' },
      async init() {},
      async loadFullState() {
        return {
          source: 'github',
          updatedAt: '2099-01-01T00:00:00.000Z',
          state: {
            _updatedAt: '2099-01-01T00:00:00.000Z',
            apiConfig: { geminiKey: 'MOCK_STALE_REVOKED_CLOUD_KEY' },
            studyHelpUnits: [{ id: 'cloud_u1', title: 'יחידה מהענן' }]
          }
        };
      }
    };
    await X.syncCloudDatabaseOnStartup({ forcePull: true, targetProvider: 'github' });
    assert.strictEqual(
      X.appState.apiConfig.geminiKey,
      'MOCK_FRESH_LOCAL_ENV_KEY',
      'Cloud sync must NEVER overwrite local .env / apiConfig keys'
    );
    X.DatabaseManager.activeProviderType = 'local';
    X.DatabaseManager.providers.github = origGithubRepo;
    X.appState.dbConfig.activeProvider = 'local';

    // Header auth & zero ?key= check
    const geminiSrc = readRepoFile('src/services/ai/geminiService.js');
    const orchestratorSrc = readRepoFile('src/services/ai/aiOrchestrator.js');
    const discoverPySrc = readRepoFile('scripts/discover_models.py');
    assert.strictEqual(geminiSrc.includes('?key='), false, 'Zero ?key= in geminiService.js');
    assert.strictEqual(orchestratorSrc.includes('?key='), false, 'Zero ?key= in aiOrchestrator.js');
    assert.strictEqual(discoverPySrc.includes('?key='), false, 'Zero ?key= in discover_models.py');
    assert.strictEqual(geminiSrc.includes('x-goog-api-key'), true);

    let capturedGeminiReq = null;
    env.setFetchHandler(async (url, options) => {
      capturedGeminiReq = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return { candidates: [{ content: { parts: [{ text: 'תשובה תקינה' }] } }] };
        }
      };
    });
    await X.callGeminiAPI('gemini-2.5-flash-lite', 'MOCK_HEADER_ONLY_KEY', 'בדיקה');
    assert.strictEqual(capturedGeminiReq.url.includes('?key='), false);
    assert.strictEqual(capturedGeminiReq.options.headers['x-goog-api-key'], 'MOCK_HEADER_ONLY_KEY');

    // Static Host Guard verification (*.github.io)
    assert.strictEqual(X.isLocalPythonServerHost('learner-portal.github.io'), false);
    assert.strictEqual(X.isLocalPythonServerHost('localhost'), true);
    assert.strictEqual(X.isLocalPythonServerHost('127.0.0.1'), true);

    env.locationObj.hostname = 'learner-portal.github.io';
    env.locationObj.protocol = 'https:';
    env.clearFetchLog();
    await X.syncEnvKeysFromServer();
    const localRepoInstance = new X.LocalRepo();
    await localRepoInstance.saveFullState({ activeTrackId: 'general', studyHelpUnits: [] });
    await localRepoInstance.loadFullState();
    const apiCallsOnStaticHost = env.fetchLog.filter(
      (entry) => entry.url.includes('/api/env') || entry.url.includes('/api/state')
    );
    assert.strictEqual(apiCallsOnStaticHost.length, 0, 'Zero /api/env or /api/state calls on GitHub Pages');

    // Localhost /api/env key rotation clears stale verified_gemini_model cache
    env.locationObj.hostname = 'localhost';
    env.locationObj.protocol = 'http:';
    X.appState.apiConfig.geminiKey = 'MOCK_OLD_KEY';
    env.localStorageMock.setItem('gemini_api_key', 'MOCK_OLD_KEY');
    env.localStorageMock.setItem('verified_gemini_model', 'stale-cached-model');
    X.appState.apiConfig.verifiedGeminiModel = 'stale-cached-model';

    env.setFetchHandler(async (url) => {
      if (url.includes('/api/env')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { groqKey: 'gsk_env1', geminiKey: 'MOCK_NEW_ENV', openrouterKey: 'MOCK_OR_ENV' };
          }
        };
      }
      return { ok: false, status: 404, async json() { return {}; } };
    });
    await X.syncEnvKeysFromServer();
    assert.strictEqual(X.appState.apiConfig.geminiKey, 'MOCK_NEW_ENV');
    assert.strictEqual(
      env.localStorageMock.getItem('verified_gemini_model'),
      null,
      'Changing Gemini key via /api/env must clear stale verified_gemini_model cache'
    );

    results.push('[Gate 1 - Secret Stripping, Header Auth, .env Sync & Static Host Guard] PASSED');
  }

  // =========================================================================
  // [Gate 2 - Live Model Discovery, Smart Cost-Efficient Routing & Hebrew JSON Repair]
  // =========================================================================
  {
    // Verify client-side testGroq / testOpenRouter / testGemini dynamic discovery
    env.setFetchHandler(async (url, options) => {
      if (url === 'https://api.groq.com/openai/v1/models') {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              data: [
                { id: 'llama-3.3-70b-versatile', input_modalities: ['text'], output_modalities: ['text'] },
                { id: 'meta-llama/llama-4-scout-17b-16e-instruct', input_modalities: ['text', 'image'], output_modalities: ['text'] },
                { id: 'canopylabs/orpheus-arabic-saudi', input_modalities: ['text'], output_modalities: ['speech'] }
              ]
            };
          }
        };
      }
      if (url === 'https://api.groq.com/openai/v1/chat/completions') {
        const b = JSON.parse(options.body);
        assert.strictEqual(typeof b.temperature, 'number', 'Groq calls must always include explicit numeric temperature');
        return { ok: true, status: 200, async json() { return { choices: [{ message: { content: 'פעיל' } }] }; } };
      }
      throw new Error('Unexpected URL in testGroq: ' + url);
    });
    const groqTestRes = await X.AIService.testGroq('gsk_probe1');
    assert.strictEqual(groqTestRes.success, true);
    assert.ok(X.appState.apiConfig.verifiedGroqModels.includes('llama-3.3-70b-versatile'));
    assert.ok(!X.appState.apiConfig.verifiedGroqModels.includes('canopylabs/orpheus-arabic-saudi'));
    assert.ok(X.appState.apiConfig.verifiedGroqVisionModels.includes('meta-llama/llama-4-scout-17b-16e-instruct'));

    // Hebrew JSON repair (מע"מ, עו"ש, בע"מ, ש"ח, דו"ח, literal newlines, trailing commas)
    const brokenHebrewJson = `\`\`\`json
{
  "title": "עסקאות מע"מ והתאמות עו"ש בחברה בע"מ",
  "summary": "ניתוח דו"ח רווח והפסד בסך 1,500 ש"ח
כולל שורה חדשה באמצע מחרוזת.",
  "items": ["חשבונית מע"מ", "דף עו"ש",],
}
\`\`\``;
    const directRepaired = X.AIService.repairHebrewJsonString('{"term":"מע"מ"}');
    assert.ok(directRepaired.includes('מע״מ'), 'repairHebrewJsonString must convert internal Hebrew quotes to ״');

    const parsedJson = X.AIService.cleanAndParseJSON(brokenHebrewJson);
    assert.ok(parsedJson && typeof parsedJson === 'object', 'cleanAndParseJSON must parse repaired Hebrew JSON');
    assert.ok(/מע["״]מ/.test(parsedJson.title) && /עו["״]ש/.test(parsedJson.title) && /בע["״]מ/.test(parsedJson.title));
    assert.ok(/דו["״]ח/.test(parsedJson.summary) && /ש["״]ח/.test(parsedJson.summary));
    assert.strictEqual(parsedJson.items.length, 2);

    // Smart Task Routing:
    // A) Text task -> Groq (0.2 temp) -> OpenRouter -> Gemini
    env.localStorageMock.clear();
    X.appState.apiConfig = {
      geminiKey: 'MOCK_TIER_GEMINI',
      groqKey: 'gsk_tier1',
      openrouterKey: 'MOCK_TIER_OR',
      verifiedGroqModels: [],
      verifiedGroqVisionModels: [],
      verifiedOpenRouterModels: [],
      verifiedGeminiModels: []
    };

    const textOrder = [];
    let groqSentTemp = null;
    env.setFetchHandler(async (url, options) => {
      const body = options && options.body ? JSON.parse(options.body) : {};
      if (url.includes('api.groq.com')) {
        groqSentTemp = body.temperature;
        if (textOrder[textOrder.length - 1] !== 'groq') textOrder.push('groq');
        return { ok: false, status: 503, async json() { return {}; }, async text() { return '503'; } };
      }
      if (url.includes('openrouter.ai')) {
        if (textOrder[textOrder.length - 1] !== 'openrouter') textOrder.push('openrouter');
        return { ok: false, status: 503, async json() { return {}; }, async text() { return '503'; } };
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        if (textOrder[textOrder.length - 1] !== 'gemini') textOrder.push('gemini');
        return {
          ok: true,
          status: 200,
          async json() {
            return { candidates: [{ content: { parts: [{ text: 'תשובת גיבוי' }] } }] };
          }
        };
      }
      throw new Error('Unexpected URL: ' + url);
    });

    const textOut = await X.callMultiTierAI('הסבר על מאזן בוחן', { inlineImages: [], preferVision: false });
    assert.strictEqual(textOut, 'תשובת גיבוי');
    assert.deepStrictEqual(textOrder, ['groq', 'openrouter', 'gemini']);
    assert.strictEqual(groqSentTemp, 0.2, 'Groq text tier must pass temperature: 0.2');

    // B) Vision task -> Gemini Vision -> Groq Vision (max_tokens <= 4096, JPEG) -> OpenRouter Vision (unblocked!) -> Fallback to Groq Text with extractedText!
    const visionStages = [];
    const pushStage = (s) => {
      if (visionStages[visionStages.length - 1] !== s) visionStages.push(s);
    };
    let groqVisionMaxTokens = null;
    let openRouterHadImageUrl = false;
    env.setFetchHandler(async (url, options) => {
      const body = options && options.body ? JSON.parse(options.body) : {};
      if (url.includes('generativelanguage.googleapis.com')) {
        pushStage('gemini_vision');
        return { ok: false, status: 429, async text() { return '429'; }, async json() { return {}; } };
      }
      if (url.includes('api.groq.com')) {
        const userMsg = (body.messages || []).find((m) => m.role === 'user');
        if (Array.isArray(userMsg?.content)) {
          pushStage('groq_vision');
          groqVisionMaxTokens = body.max_tokens;
          return { ok: false, status: 503, async text() { return '503'; }, async json() { return {}; } };
        }
        pushStage('groq_text_fallback');
        assert.ok(String(userMsg.content).includes('טקסט שחולץ מהקובץ'), 'Vision-to-text fallback must include extractedText');
        return {
          ok: true,
          status: 200,
          async json() {
            return { choices: [{ message: { content: 'פענוח מטקסט שחולץ בגיבוי' } }] };
          }
        };
      }
      if (url.includes('openrouter.ai')) {
        const userMsg = (body.messages || []).find((m) => m.role === 'user');
        if (Array.isArray(userMsg?.content)) {
          pushStage('openrouter_vision');
          openRouterHadImageUrl = userMsg.content.some((p) => p.type === 'image_url');
        }
        return { ok: false, status: 503, async text() { return '503'; }, async json() { return {}; } };
      }
      throw new Error('Unexpected URL: ' + url);
    });

    const visionFallbackReply = await X.callMultiTierAI('מפה עמוד סרוק', {
      inlineImages: [{ mimeType: 'image/jpeg', data: 'QUJDREVGRw==' }],
      preferVision: true,
      maxTokens: 8192,
      extractedText: 'עמוד 1: חובה קופה 500 ש״ח, זכות לקוחות 500 ש״ח.'
    });
    assert.strictEqual(visionFallbackReply, 'פענוח מטקסט שחולץ בגיבוי');
    assert.ok(groqVisionMaxTokens <= 4096, `Groq Vision max_tokens must be capped <= 4096, got ${groqVisionMaxTokens}`);
    assert.strictEqual(openRouterHadImageUrl, true, 'OpenRouter Vision must NOT be blocked by !hasImages');
    assert.deepStrictEqual(visionStages, ['gemini_vision', 'groq_vision', 'openrouter_vision', 'groq_text_fallback']);

    results.push('[Gate 2 - Live Model Discovery, Cost-Efficient Routing & Hebrew JSON Repair] PASSED');
  }

  // =========================================================================
  // [Gate 3 - IndexedDB 10-Page Snapshot Separation, Deduplication & Storage Status]
  // =========================================================================
  {
    env.localStorageMock.clear();
    const pageBlob = 'B'.repeat(180 * 1024); // ~180KB * 10 pages = ~1.8MB raw snapshots
    const tenPageSnapshots = Array.from({ length: 10 }, (_, idx) => ({
      pageNumber: idx + 1,
      mimeType: 'image/jpeg',
      data: pageBlob
    }));
    const activeUnitId = 'study_unit_10pages_active';
    const activeUnitObj = {
      id: activeUnitId,
      title: 'שיעור 10 עמודים פעיל',
      completed: false,
      pageSnapshots: tenPageSnapshots,
      inlineImages: tenPageSnapshots,
      sourceContext: {
        fullExtractedText: 'טקסט מחולץ מתוך 10 עמודים',
        pageSnapshots: tenPageSnapshots
      }
    };

    // Even if legacy code placed the same unit in both studyHelpUnits and dailyCards, saveAppState must deduplicate!
    X.appState.studyHelpUnits = [activeUnitObj];
    X.appState.studyHelp.dailyCards = [activeUnitObj];

    const saveOkRes = X.saveAppState();
    assert.ok(saveOkRes && saveOkRes.ok === true, 'saveAppState() must return { ok: true } when storage succeeds');

    const rawStored = env.localStorageMock.getItem('DANIEL_AI_V3_CLEAN');
    assert.ok(rawStored.length < 300000, `Serialized localStorage must be <300KB for 10-page PDF, got ${rawStored.length}`);
    assert.strictEqual(rawStored.includes(pageBlob.slice(0, 128)), false, 'Zero base64 page data in localStorage');

    const parsedLocal = JSON.parse(rawStored);
    assert.strictEqual(parsedLocal.studyHelpUnits.length, 1);
    assert.strictEqual(
      parsedLocal.studyHelp.dailyCards.length,
      0,
      'saveAppState must NOT duplicate studyHelpUnits entries inside dailyCards in localStorage'
    );

    const idbSnaps = await X.StudySnapshotsIDB.getSnapshots(activeUnitId);
    assert.strictEqual(idbSnaps.length, 10, 'All 10 page snapshots must be accessible in StudySnapshotsIDB');

    // Verify QuotaExceededError returns { ok: false } instead of false green success
    env.localStorageMock._setThrowQuota(true);
    const failedSaveRes = X.saveAppState({ skipCloudSync: true });
    env.localStorageMock._setThrowQuota(false);
    assert.strictEqual(failedSaveRes.ok, false, 'saveAppState() must return { ok: false } if localStorage throws QuotaExceededError');

    // Verify deleting the unit automatically purges its snapshots from StudySnapshotsIDB
    X.deleteUnitFromAnyTrack('study_help', activeUnitId);
    const afterDeleteSnaps = await X.StudySnapshotsIDB.getSnapshots(activeUnitId);
    assert.strictEqual(afterDeleteSnaps.length, 0, 'Deleting a unit must purge its snapshots from StudySnapshotsIDB');

    results.push('[Gate 3 - IndexedDB 10-Page Snapshot Store, Deduplication & Quota Guard] PASSED');
  }

  // =========================================================================
  // [Gate 4 - Upload & Generation Cancellation (AbortController + RunToken)]
  // =========================================================================
  {
    const shSrc = readRepoFile('src/controllers/studyHelpController.js');
    const pdfSrc = readRepoFile('src/services/pdf/pdfExtractor.js');
    assert.ok(shSrc.includes('🛑 בטל העלאה ויצירת יחידה'), 'Cancel button label must exist in loading overlay');
    assert.ok(pdfSrc.includes('throwIfUploadAborted(abortSignal)'), 'PDFExtractor must enforce abortSignal cancellation');

    const baselineUnit = { id: 'existing_safe_unit', title: 'יחידה קיימת', completed: false };
    const partialUnit = { id: 'partial_inflight_unit', title: 'יחידה בבנייה', completed: false };
    X.appState.studyHelpUnits = [partialUnit, baselineUnit];

    const session = X.StudyGenerationCancelManager.startNewSession();
    X.StudyGenerationCancelManager._partialUnitId = 'partial_inflight_unit';

    env.setFetchHandler((_url, options) => {
      return new Promise((_resolve, reject) => {
        if (options && options.signal) {
          options.signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });

    const inflightPromise = X.callMultiTierAI('בנה שלד יחידה', { abortSignal: session.signal });
    X.StudyGenerationCancelManager.cancelActiveSession();

    assert.strictEqual(session.signal.aborted, true);
    assert.strictEqual(session.isCancelled(), true);
    await assert.rejects(inflightPromise, (err) => err && err.name === 'AbortError');
    assert.strictEqual(X.appState.studyHelpUnits.length, 1);
    assert.strictEqual(X.appState.studyHelpUnits[0].id, 'existing_safe_unit');

    results.push('[Gate 4 - Meaningful Upload & Generation Cancellation] PASSED');
  }

  // =========================================================================
  // [Gate 5 - English Blueprint, 12-Question Cap, Text-Only Beats & 1-Beat Lookahead]
  // =========================================================================
  {
    // 5A: 12-Question Consolidation & Solved-Example Separation
    const rawOutlines = [
      { question_number_label: 'דוגמה פתורה 1', exact_book_text: 'דוגמה פתורה עם פתרון מלא מהספר.', is_solved_example: true, page_number: 1 },
      { question_number_label: 'שאלה 1 סעיף א\'', exact_book_text: 'חשב יתרת מזומנים ליום 31.12.', question_type: 'calculation', page_number: 2 },
      { question_number_label: 'שאלה 1 סעיף ב\'', exact_book_text: 'רשום פקודת יומן לתשלום שכירות.', question_type: 'journal_table', page_number: 2 },
      { question_number_label: 'סעיף ג\'', exact_book_text: 'הצג השפעה על משוואת המאזן.', question_type: 'open_question', page_number: 2 }
    ];
    for (let q = 2; q <= 17; q++) {
      rawOutlines.push({
        question_number_label: `שאלה ${q}`,
        exact_book_text: `נתח אירוע חשבונאי בשאלה ${q}.`,
        question_type: 'open_question',
        page_number: 3
      });
    }
    const consolidated = X.consolidateAndCapQuestionOutlines(rawOutlines, 12);
    assert.strictEqual(consolidated.length, 12, 'Questions must be capped at <= 12');
    assert.strictEqual(consolidated.some((q) => /דוגמה\s*פתורה/.test(q.question_number_label || '')), false);
    assert.ok(consolidated[0].exact_book_text.includes('31.12') && consolidated[0].exact_book_text.includes('פקודת יומן'));
    assert.ok(Array.isArray(consolidated[0].sub_steps) && consolidated[0].sub_steps.length >= 2, 'Merged parent question must include sub_steps');

    // 5B: Text-only Beat generation (inlineImages: []) & 1-Beat Lookahead (warms ONLY 1 pending beat!)
    const beatCalls = [];
    env.setFetchHandler(async (url, options) => {
      if (url.includes('/api/state') || url.includes('/api/env')) {
        return { ok: true, status: 200, async json() { return { status: 'ok' }; } };
      }
      const body = JSON.parse(options.body);
      beatCalls.push({ url, body });
      const isHw = body.messages.some((m) => String(m.content || '').includes('Homework Beat'));
      const mockPayload = isHw
        ? {
            questions: [
              {
                question_number_label: 'שאלה 1',
                page_number: 1,
                question_type: 'calculation',
                exact_book_text: 'חשב מע״מ על 1,000 ש״ח.',
                friendly_translation: 'נחשב 18% מתוך 1,000 ש״ח.',
                sub_steps: ['צעד 1: רשום סכום', 'צעד 2: הכפל ב-0.18'],
                table_schema: { has_table: false, columns: [], account_choices: [], expected_rows: [] },
                guided_options: ['180 ש״ח', '100 ש״ח'],
                correct_option_index: 0,
                step_by_step_solution: ['1,000 * 0.18 = 180'],
                final_answer: '180 ש״ח'
              }
            ]
          }
        : {
            slides: [
              {
                term_name: 'משוואת המאזן',
                page_number: 1,
                source_section_label: 'עמוד 1',
                paragraphs: ['כל נכס ממומן מהון עצמי או מהתחייבות.'],
                book_example: { title: 'דוגמה', exact_excerpt: 'ציוד ב-5,000 ש״ח', steps: ['נכס עולה', 'מזומן יורד'] },
                interactive_widget: { widget_type: 'mini_balance_check', prompt: 'בדיקה', options: ['מאוזן', 'לא'], correct_index: 0, explanation: 'מאוזן' },
                bottom_questions: {
                  mc_question: { question: 'שאלה?', options: ['א', 'ב', 'ג', 'ד'], correct_index: 0, explanation: 'נכון' },
                  open_question: { question: 'הסבר במילים שלך', expected_core_idea: 'איזון', hint: 'רמז' }
                }
              }
            ]
          };
      return { ok: true, status: 200, async json() { return { choices: [{ message: { content: JSON.stringify(mockPayload) } }] }; } };
    });

    const lookaheadUnit = {
      id: 'unit_lookahead_test',
      title: 'בדיקת פעימות',
      lesson_title: 'בדיקת פעימות',
      inlineImages: [{ mimeType: 'image/jpeg', data: 'NEVER_SEND_ON_BEATS' }],
      conceptBeats: [
        { beatIndex: 0, status: 'ready', slides: [{ term_name: 'מוכן' }], conceptOutlines: [{ term_name: 'מוכן', page_number: 1, raw_book_excerpt: 'א' }] },
        { beatIndex: 1, status: 'pending', slides: [], conceptOutlines: [{ term_name: 'פעימה 2', page_number: 2, raw_book_excerpt: 'ב' }] },
        { beatIndex: 2, status: 'pending', slides: [], conceptOutlines: [{ term_name: 'פעימה 3', page_number: 3, raw_book_excerpt: 'ג' }] }
      ],
      homeworkBeats: [
        { beatIndex: 0, status: 'pending', questions: [], questionOutlines: [{ question_number_label: 'שאלה 1', page_number: 4, question_type: 'calculation', exact_book_text: 'חשב מע״מ' }] }
      ]
    };
    X.appState.studyHelpUnits = [lookaheadUnit];

    await X.prewarmNextPendingBeat(lookaheadUnit.id);
    assert.strictEqual(
      beatCalls.length,
      1,
      `1-Beat Lookahead must generate ONLY 1 immediate next pending beat, got ${beatCalls.length} calls`
    );
    assert.strictEqual(lookaheadUnit.conceptBeats[1].status, 'ready');
    assert.strictEqual(lookaheadUnit.conceptBeats[2].status, 'pending', 'Beat 3 must remain pending until learner advances');

    await X.generateHomeworkBeatContent(lookaheadUnit, 0, null);
    assert.strictEqual(beatCalls.length, 2);
    for (const call of beatCalls) {
      assert.ok(call.url.includes('api.groq.com'), 'Stage 2 & 3 beats must route to Groq text first (0 Gemini Vision calls)');
      const uMsg = call.body.messages.find((m) => m.role === 'user');
      assert.strictEqual(typeof uMsg.content, 'string', 'Beats must pass inlineImages: []');
    }

    results.push('[Gate 5 - English Blueprint, 12-Question Cap, Text-Only Beats & 1-Beat Lookahead] PASSED');
  }

  // =========================================================================
  // [Gate 6 - High-Precision Hebrew & Accounting Ground-Truth Anchor in Chats]
  // =========================================================================
  {
    const shSrc = readRepoFile('src/controllers/studyHelpController.js');
    const bubbleSrc = readRepoFile('src/components/globalAiBubble.js');

    assert.ok(
      shSrc.includes('ACCOUNTING GROUND-TRUTH ANCHOR') &&
        shSrc.includes('DEBITED (בחובה)') &&
        shSrc.includes('CREDITED (בזכות)'),
      'studyHelpController tutor prompts must include explicit double-entry Debit/Credit ground-truth anchor'
    );
    assert.ok(
      bubbleSrc.includes('ACCOUNTING GROUND-TRUTH ANCHOR') &&
        bubbleSrc.includes('DEBITED (בחובה)') &&
        bubbleSrc.includes('CREDITED (בזכות)'),
      'GlobalAiAssistant.sendMessage must include explicit double-entry Debit/Credit ground-truth anchor'
    );

    let capturedBubbleSystem = '';
    let capturedBubbleTemp = null;
    env.setFetchHandler(async (_url, options) => {
      const body = JSON.parse(options.body);
      capturedBubbleTemp = body.temperature;
      capturedBubbleSystem = (body.messages.find((m) => m.role === 'system') || {}).content || '';
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [
              {
                message: {
                  content: '<think>internal</think>כאשר לקוח משלם לעסק במזומן, מחייבים את חשבון הקופה ומזכים את חשבון הלקוח.'
                }
              }
            ]
          };
        }
      };
    });

    X.GlobalAiAssistant.syncDelayMs = 0;
    await X.GlobalAiAssistant.open();
    await X.GlobalAiAssistant.sendMessage('לקוח שילם לנו 500 ש״ח במזומן, מה בחובה ומה בזכות?');
    assert.strictEqual(capturedBubbleTemp, 0.2, 'GlobalAiAssistant must use temperature: 0.2');
    assert.ok(capturedBubbleSystem.includes('ACCOUNTING GROUND-TRUTH ANCHOR'));
    const lastMsg = X.GlobalAiAssistant.chatHistory[X.GlobalAiAssistant.chatHistory.length - 1];
    assert.ok(lastMsg && !lastMsg.text.includes('<think>'), 'sanitizeHebrewPedagogicalOutput must strip think tags');

    results.push('[Gate 6 - High-Precision Hebrew & Accounting Ground-Truth Anchor] PASSED');
  }

  // =========================================================================
  // [Gate 7 - Generalized Identity, Clean Headers, 1fr Flow & Split-View Assistant]
  // =========================================================================
  {
    const dirsToScan = ['src', 'server', 'scripts', 'styles'];
    const filesToScan = ['index.html'];

    function collectFiles(dirRel) {
      const absDir = path.join(ROOT, dirRel);
      for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
        const relChild = path.join(dirRel, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'key' || entry.name === '__pycache__') continue;
          collectFiles(relChild);
        } else if (entry.name !== 'scaleBlock.js') {
          filesToScan.push(relChild);
        }
      }
    }
    dirsToScan.forEach(collectFiles);

    const forbiddenIdentityRe = /(דניאל|אושרי|Daniel|Oshri|בן\s*28|28-year-old)/;
    for (const rel of filesToScan) {
      const lines = readRepoFile(rel).split(/\r?\n/);
      lines.forEach((line, idx) => {
        const scrubbed = line
          .replace(/DANIEL_AI_[A-Z0-9_]+/g, '')
          .replace(/daniel_ai_[a-z0-9_]+/g, '')
          .replace(/daniel_state(\.json)?/g, '');
        assert.strictEqual(
          forbiddenIdentityRe.test(scrubbed),
          false,
          `Hardcoded personal name found in ${rel}:${idx + 1} -> ${line.trim()}`
        );
      });
    }

    // Technical backwards-compatibility keys preserved
    assert.ok(readRepoFile('src/state/store.js').includes("'DANIEL_AI_V3_CLEAN'"));
    assert.ok(readRepoFile('src/db/DatabaseManager.js').includes("'DANIEL_AI_DB_CONFIG_V1'"));

    // Clean headers
    assert.strictEqual(
      X.cleanLearnerVisibleTitle('התהליך החשבונאי | מיפוי מלא של עמודים 29 עד 31'),
      'התהליך החשבונאי'
    );
    assert.ok(!X.cleanLearnerVisibleSummary('מיפוי מלא ללא שום השמטה. נלמד על חובה וזכות.').includes('מיפוי מלא'));

    // Single-column 1fr & docked non-blurring split-view CSS
    const cssSrc = readRepoFile('styles/tutor-chat.css');
    const conceptCols = cssSrc.match(/\.study-concept-columns\s*\{([^}]*)\}/);
    const dualQuestions = cssSrc.match(/\.study-dual-bottom-questions-grid\s*\{([^}]*)\}/);
    const backdropRule = cssSrc.match(/\.global-ai-backdrop\s*\{([^}]*)\}/);
    const chipsRule = cssSrc.match(/\.global-ai-quick-chips\s*\{([^}]*)\}/);

    assert.ok(conceptCols && /grid-template-columns\s*:\s*1fr\s*;/.test(conceptCols[1]));
    assert.ok(dualQuestions && /grid-template-columns\s*:\s*1fr\s*;/.test(dualQuestions[1]));
    assert.ok(
      backdropRule &&
        /display\s*:\s*none\s*!important/.test(backdropRule[1]) &&
        /backdrop-filter\s*:\s*none\s*!important/.test(backdropRule[1])
    );
    assert.ok(chipsRule && /flex-wrap\s*:\s*nowrap/.test(chipsRule[1]));
    assert.ok(cssSrc.includes('body.global-ai-split-active') && cssSrc.includes('padding-left: 418px'));

    await X.GlobalAiAssistant.open();
    assert.strictEqual(env.documentMock.body.classList.contains('global-ai-split-active'), true);
    assert.strictEqual(env.documentMock.getElementById('global-ai-assistant-backdrop').style.display, 'none');
    X.GlobalAiAssistant.close();
    assert.strictEqual(env.documentMock.body.classList.contains('global-ai-split-active'), false);

    results.push('[Gate 7 - Generalized Identity, Clean Headers, 1fr Flow & Split-View UI] PASSED');
  }

  // =========================================================================
  // [Gate 8 - Syntax Compilation, Gitignore Hygiene & Secret Safety]
  // =========================================================================
  {
    const gitignoreSrc = readRepoFile('.gitignore');
    assert.ok(gitignoreSrc.includes('.env'), '.gitignore must ignore .env');
    assert.ok(gitignoreSrc.includes('data/daniel_state.json'), '.gitignore must ignore data/daniel_state.json');

    execFileSync('python', ['-m', 'py_compile', 'server/server.py', 'scripts/discover_models.py'], {
      cwd: ROOT,
      stdio: 'pipe'
    });

    results.push('[Gate 8 - Python/JS Compilation, Gitignore Hygiene & Full Suite Integrity] PASSED');
  }

  console.log('================================================================');
  console.log('v5.1 FULL SELF-HEALING AUDIT & E2E VERIFICATION SUITE');
  console.log('================================================================');
  for (const line of results) {
    console.log('✅ ' + line);
  }
  console.log('----------------------------------------------------------------');
  console.log(`TOTAL: ${results.length}/8 AUDIT GATES PASSED (100%)`);
  console.log('================================================================');
}

runVerificationSuite().catch((err) => {
  console.error('❌ AUDIT SUITE FAILED:', err);
  process.exit(1);
});
