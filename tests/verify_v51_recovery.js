/**
 * tests/verify_v51_recovery.js
 * End-to-End Automated Verification Suite for v5.1 Recovery (Missions 1–7)
 *
 * Run with:
 *   node tests/verify_v51_recovery.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

/**
 * Lightweight browser-like DOM & Storage harness so real application modules
 * (`src/db/*`, `src/state/store.js`, `src/services/ai/*`, `src/controllers/studyHelpController.js`,
 * `src/components/globalAiBubble.js`) execute unchanged in Node.
 */
function createAppSandbox() {
  const storageMap = new Map();
  const localStorageMock = {
    getItem(key) {
      return storageMap.has(String(key)) ? storageMap.get(String(key)) : null;
    },
    setItem(key, val) {
      storageMap.set(String(key), String(val));
    },
    removeItem(key) {
      storageMap.delete(String(key));
    },
    clear() {
      storageMap.clear();
    },
    _dump() {
      return Object.fromEntries(storageMap.entries());
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
      },
      toArray() {
        return Array.from(classes);
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
    href: 'http://localhost:8000/'
  };

  const sandbox = {
    console: {
      log: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    },
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
    SoundService: { playSuccess: () => {}, playError: () => {}, speakText: () => {} },
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

  // Expose top-level lexical declarations (`const`/`let`) onto `sandbox` for convenient assertions
  vm.runInContext(
    `
    globalThis.__exports = {
      STORAGE_KEY,
      appState,
      saveAppState,
      syncEnvKeysFromServer,
      StudySnapshotsIDB,
      isLocalPythonServerHost,
      DatabaseManager,
      LocalRepo,
      callGeminiAPI,
      callGrokAPI,
      callOpenRouterAPI,
      callMultiTierAI,
      callGroqPreferredAI,
      AIService,
      StudyGenerationCancelManager,
      consolidateAndCapQuestionOutlines,
      generateConceptBeatContent,
      generateHomeworkBeatContent,
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
  // [Test 1 - Secret Stripping]
  // =========================================================================
  {
    const sampleStateWithKeys = {
      activeTrack: 'study_help',
      apiConfig: {
        geminiKey: 'AIzaSySECRET_GEMINI_KEY_111',
        groqKey: 'gsk_SECRET_GROQ_KEY_222',
        openrouterKey: 'sk-or-v1-SECRET_OR_KEY_333'
      },
      dbConfig: {
        activeProvider: 'github',
        githubToken: 'ghp_SECRET_GITHUB_TOKEN_444',
        gistId: 'gist_secret_555',
        firebaseSecret: 'fb_SECRET_666',
        customApiKey: 'custom_SECRET_777'
      },
      geminiKey: 'AIzaSyTOPLEVEL_LEAK',
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
        accounting: { completedUnits: ['acc_1'], xp: 120 },
        study_help: { completedUnits: [], xp: 45 }
      }
    };

    const sanitized = X.DatabaseManager.sanitizeStateForCloudStorage(sampleStateWithKeys);
    const serializedSanitized = JSON.stringify(sanitized);

    assert.strictEqual('apiConfig' in sanitized, false, 'apiConfig must be stripped from cloud payload');
    assert.strictEqual('dbConfig' in sanitized, false, 'dbConfig must be stripped from cloud payload');
    assert.strictEqual('geminiKey' in sanitized, false, 'top-level key fields must be stripped');
    assert.ok(!serializedSanitized.includes('AIzaSy'), 'No Gemini secret in cloud JSON');
    assert.ok(!serializedSanitized.includes('gsk_SECRET'), 'No Groq secret in cloud JSON');
    assert.ok(!serializedSanitized.includes('ghp_SECRET'), 'No GitHub token in cloud JSON');

    // Preserve studyHelpUnits & progress
    assert.strictEqual(Array.isArray(sanitized.studyHelpUnits), true, 'studyHelpUnits must be preserved');
    assert.strictEqual(sanitized.studyHelpUnits.length, 1, 'studyHelpUnits count preserved');
    assert.strictEqual(sanitized.studyHelpUnits[0].title, 'מבוא לחשבונאות פיננסית', 'Unit title preserved');
    assert.deepStrictEqual(sanitized.trackProgress, sampleStateWithKeys.trackProgress, 'Progress preserved');

    // Ensure caller input object was not mutated
    assert.strictEqual(
      sampleStateWithKeys.apiConfig.geminiKey,
      'AIzaSySECRET_GEMINI_KEY_111',
      'Original in-memory state must not be mutated'
    );

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
    assert.strictEqual('apiConfig' in pushedCloudPayload, false, 'flushCloudSync payload must omit apiConfig');
    assert.strictEqual('dbConfig' in pushedCloudPayload, false, 'flushCloudSync payload must omit dbConfig');
    X.DatabaseManager.activeProviderType = 'local';
    X.DatabaseManager.providers.github = origGithubRepo;

    results.push('[Test 1 - Secret Stripping] PASSED');
  }

  // =========================================================================
  // [Test 2 - Header Auth & Static Host Guard]
  // =========================================================================
  {
    const geminiSrc = readRepoFile('src/services/ai/geminiService.js');
    const orchestratorSrc = readRepoFile('src/services/ai/aiOrchestrator.js');

    assert.strictEqual(geminiSrc.includes('?key='), false, 'Zero occurrences of ?key= allowed in geminiService.js');
    assert.strictEqual(orchestratorSrc.includes('?key='), false, 'Zero occurrences of ?key= allowed in aiOrchestrator.js');
    assert.strictEqual(geminiSrc.includes('x-goog-api-key'), true, 'x-goog-api-key header required in geminiService.js');
    assert.strictEqual(orchestratorSrc.includes('x-goog-api-key'), true, 'x-goog-api-key header required in aiOrchestrator.js');

    // Runtime verification of callGeminiAPI header auth
    let capturedGeminiReq = null;
    env.setFetchHandler(async (url, options) => {
      capturedGeminiReq = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            candidates: [{ content: { parts: [{ text: 'תשובה תקינה' }] } }]
          };
        }
      };
    });

    const gemReply = await X.callGeminiAPI('gemini-2.5-flash-lite', 'AIzaHeaderOnlyKey999', 'שלום');
    assert.strictEqual(gemReply, 'תשובה תקינה');
    assert.ok(capturedGeminiReq, 'callGeminiAPI must invoke fetch');
    assert.strictEqual(capturedGeminiReq.url.includes('?key='), false, 'Runtime Gemini URL must not include ?key=');
    assert.strictEqual(
      capturedGeminiReq.options.headers['x-goog-api-key'],
      'AIzaHeaderOnlyKey999',
      'Runtime Gemini call must pass x-goog-api-key header'
    );

    // Static Host Guard verification ('oshrikat.github.io')
    assert.strictEqual(
      X.isLocalPythonServerHost('oshrikat.github.io'),
      false,
      'isLocalPythonServerHost("oshrikat.github.io") must return false'
    );
    assert.strictEqual(X.isLocalPythonServerHost('localhost'), true, 'localhost must return true');
    assert.strictEqual(X.isLocalPythonServerHost('127.0.0.1'), true, '127.0.0.1 must return true');

    env.locationObj.hostname = 'oshrikat.github.io';
    env.locationObj.protocol = 'https:';
    assert.strictEqual(
      X.isLocalPythonServerHost(),
      false,
      'isLocalPythonServerHost() must return false when window.location.hostname is oshrikat.github.io'
    );

    env.clearFetchLog();
    await X.syncEnvKeysFromServer();
    const localRepoInstance = new X.LocalRepo();
    await localRepoInstance.saveFullState({ activeTrack: 'general', studyHelpUnits: [] });
    await localRepoInstance.loadFullState();

    const apiCallsOnGithubPages = env.fetchLog.filter(
      (entry) => entry.url.includes('/api/env') || entry.url.includes('/api/state')
    );
    assert.strictEqual(
      apiCallsOnGithubPages.length,
      0,
      'Zero /api/env or /api/state calls allowed on static host oshrikat.github.io'
    );

    // Restore localhost default
    env.locationObj.hostname = 'localhost';
    env.locationObj.protocol = 'http:';

    results.push('[Test 2 - Header Auth & Static Host Guard] PASSED');
  }

  // =========================================================================
  // [Test 3 - Hebrew JSON Repair]
  // =========================================================================
  {
    const rawBrokenHebrewJson = `\`\`\`json
{
  "title": "עסקאות מע"מ והתאמות עו"ש בחברה בע"מ",
  "summary": "ניתוח דו"ח רווח והפסד, קיזוז מע"מ תשומות מול מע"מ עסקאות, ובדיקת יתרת עו"ש בבנק.",
  "items": [
    "חשבונית מס עם מע"מ 18%",
    "דף חשבון עו"ש של ספק בע"מ",
    "עריכת דו"ח התאמה חודשי",
  ],
}
\`\`\``;

    const parsed = X.AIService.cleanAndParseJSON(rawBrokenHebrewJson);
    assert.ok(parsed && typeof parsed === 'object', 'cleanAndParseJSON must return a valid object');
    assert.ok(parsed.title.includes('מע"מ'), 'Parsed title must preserve מע"מ');
    assert.ok(parsed.title.includes('עו"ש'), 'Parsed title must preserve עו"ש');
    assert.ok(parsed.title.includes('בע"מ'), 'Parsed title must preserve בע"מ');
    assert.ok(parsed.summary.includes('דו"ח'), 'Parsed summary must preserve דו"ח');
    assert.strictEqual(Array.isArray(parsed.items), true, 'Trailing comma in array must be repaired');
    assert.strictEqual(parsed.items.length, 3, 'All 3 Hebrew array items must parse cleanly');

    results.push('[Test 3 - Hebrew JSON Repair] PASSED');
  }

  // =========================================================================
  // [Test 4 - Smart Task Routing & OpenRouter Multimodal Unblocking]
  // =========================================================================
  {
    env.localStorageMock.clear();
    X.appState.apiConfig = {
      geminiKey: 'AIzaTestTierGemini',
      groqKey: 'gsk_TestTierGroq',
      openrouterKey: 'sk-or-TestTierOpenRouter',
      verifiedGroqModel: '',
      verifiedOpenRouterModel: '',
      verifiedGeminiModel: ''
    };

    // 4A: Text / Chat task routing order -> Groq first (llama-3.3-70b-versatile) -> OpenRouter second -> Gemini third
    const providerSequence = [];
    const groqModelsAttempted = [];
    env.setFetchHandler(async (url, options) => {
      const body = options && options.body ? JSON.parse(options.body) : {};
      if (url.includes('api.groq.com')) {
        if (providerSequence[providerSequence.length - 1] !== 'groq') providerSequence.push('groq');
        groqModelsAttempted.push(body.model);
        return { ok: false, status: 503, async json() { return {}; }, async text() { return '503'; } };
      }
      if (url.includes('openrouter.ai')) {
        if (providerSequence[providerSequence.length - 1] !== 'openrouter') providerSequence.push('openrouter');
        return { ok: false, status: 503, async json() { return {}; }, async text() { return '503'; } };
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        if (providerSequence[providerSequence.length - 1] !== 'gemini') providerSequence.push('gemini');
        return {
          ok: true,
          status: 200,
          async json() {
            return { candidates: [{ content: { parts: [{ text: 'מענה מגיבוי שלישי' }] } }] };
          }
        };
      }
      throw new Error('Unexpected endpoint: ' + url);
    });

    const textFallbackReply = await X.callMultiTierAI('הסבר תמציתי על משוואת המאזן', {
      inlineImages: [],
      preferVision: false
    });
    assert.strictEqual(textFallbackReply, 'מענה מגיבוי שלישי');
    assert.deepStrictEqual(
      providerSequence,
      ['groq', 'openrouter', 'gemini'],
      `Text tasks must route Groq -> OpenRouter -> Gemini, got: ${providerSequence.join(' -> ')}`
    );
    assert.strictEqual(
      groqModelsAttempted[0],
      'llama-3.3-70b-versatile',
      'First Groq text model must be llama-3.3-70b-versatile'
    );

    // Also verify callGroqPreferredAI routes Groq -> OpenRouter -> Gemini
    const chatSequence = [];
    env.setFetchHandler(async (url) => {
      if (url.includes('api.groq.com')) {
        if (chatSequence[chatSequence.length - 1] !== 'groq') chatSequence.push('groq');
        return { ok: false, status: 503, async json() { return {}; } };
      }
      if (url.includes('openrouter.ai')) {
        if (chatSequence[chatSequence.length - 1] !== 'openrouter') chatSequence.push('openrouter');
        return { ok: false, status: 503, async json() { return {}; } };
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        if (chatSequence[chatSequence.length - 1] !== 'gemini') chatSequence.push('gemini');
        return {
          ok: true,
          status: 200,
          async json() {
            return { candidates: [{ content: { parts: [{ text: 'תשובת עוזר אישי' }] } }] };
          }
        };
      }
      throw new Error('Unexpected endpoint: ' + url);
    });
    const chatReply = await X.callGroqPreferredAI('מה מבקשים בשאלה הזו?');
    assert.strictEqual(chatReply, 'תשובת עוזר אישי');
    assert.deepStrictEqual(chatSequence, ['groq', 'openrouter', 'gemini']);

    // 4B: generateConceptBeatContent & generateHomeworkBeatContent pass inlineImages: [] (text-only Groq first)
    const beatRequests = [];
    env.setFetchHandler(async (url, options) => {
      const body = JSON.parse(options.body);
      beatRequests.push({ url, body });
      const isHomework = body.messages.some((m) => String(m.content || '').includes('Homework Beat'));
      const mockJson = isHomework
        ? JSON.stringify({
            questions: [
              {
                question_number_label: 'שאלה 1',
                page_number: 1,
                question_type: 'calculation',
                exact_book_text: 'חשב את סכום המע"מ בעסקה של 1,000 ש"ח.',
                friendly_translation: 'נחשב יחד 18% מתוך 1,000 ש"ח.',
                sub_steps: ['צעד 1: רשום את סכום העסקה', 'צעד 2: הכפל ב-0.18'],
                table_schema: { has_table: false, columns: [], account_choices: [], expected_rows: [] },
                guided_options: ['180 ש"ח', '100 ש"ח', '1,180 ש"ח', '18 ש"ח'],
                correct_option_index: 0,
                step_by_step_solution: ['1,000 * 0.18 = 180 ש"ח'],
                final_answer: '180 ש"ח'
              }
            ]
          })
        : JSON.stringify({
            slides: [
              {
                term_name: 'משוואת המאזן',
                page_number: 1,
                source_section_label: 'עמוד 1',
                paragraphs: ['כל נכס של העסק ממומן מהון עצמי או מהתחייבות.', 'משוואת המאזן: נכסים = התחייבויות + הון עצמי.'],
                book_example: {
                  title: 'דוגמה מתוך עמוד 1 בספר',
                  exact_excerpt: 'רכישת ציוד ב-5,000 ש"ח במזומן.',
                  steps: ['ציוד עולה ב-5,000 ש"ח', 'מזומן יורד ב-5,000 ש"ח']
                },
                interactive_widget: {
                  widget_type: 'mini_balance_check',
                  prompt: 'מה קורה לסך הנכסים?',
                  options: ['נשאר מאוזן', 'קטן'],
                  correct_index: 0,
                  explanation: 'החלפנו נכס בנכס באותו סכום.'
                },
                bottom_questions: {
                  mc_question: {
                    question: 'מה קורה לסך הנכסים ברכישת ציוד במזומן?',
                    options: ['גדל', 'קטן', 'נשאר ללא שינוי', 'מתאפס'],
                    correct_index: 2,
                    explanation: 'נכס אחד עלה ונכס אחר ירד באותו סכום.'
                  },
                  open_question: {
                    question: 'הסבר במילים שלך מדוע המאזן נשאר מאוזן.',
                    expected_core_idea: 'החלפת נכס בנכס באותו שווי',
                    hint: 'חשוב על שני צדי המשוואה.'
                  }
                }
              }
            ]
          });

      return {
        ok: true,
        status: 200,
        async json() {
          return { choices: [{ message: { content: mockJson } }] };
        }
      };
    });

    const sampleUnitForBeats = {
      id: 'unit_beats_test',
      title: 'משוואת המאזן ומע"מ',
      lesson_title: 'משוואת המאזן ומע"מ',
      inlineImages: [{ mimeType: 'image/jpeg', data: 'SHOULD_NOT_BE_SENT_IN_STAGE_2_OR_3' }],
      sourceContext: {
        fullExtractedText: 'עמוד 1: משוואת המאזן: נכסים = התחייבויות + הון עצמי. דוגמה: רכישת ציוד ב-5,000 ש"ח. שאלה 1: חשב מע"מ על 1,000 ש"ח.',
        pageSnapshots: [{ pageNumber: 1, mimeType: 'image/jpeg', data: 'SHOULD_NOT_BE_SENT' }]
      },
      conceptBeats: [
        {
          beatIndex: 0,
          status: 'pending',
          conceptOutlines: [
            {
              term_name: 'משוואת המאזן',
              page_number: 1,
              source_section_label: 'פרק 1',
              raw_book_excerpt: 'משוואת המאזן: נכסים = התחייבויות + הון עצמי. דוגמה: רכישת ציוד ב-5,000 ש"ח במזומן.'
            }
          ]
        }
      ],
      homeworkBeats: [
        {
          beatIndex: 0,
          status: 'pending',
          questionOutlines: [
            {
              question_number_label: 'שאלה 1',
              page_number: 1,
              question_type: 'calculation',
              exact_book_text: 'חשב את סכום המע"מ בעסקה של 1,000 ש"ח.'
            }
          ]
        }
      ]
    };

    const conceptData = await X.generateConceptBeatContent(sampleUnitForBeats, 0, null);
    const homeworkData = await X.generateHomeworkBeatContent(sampleUnitForBeats, 0, null);

    assert.ok(
      conceptData && Array.isArray(sampleUnitForBeats.conceptBeats[0].slides) && sampleUnitForBeats.conceptBeats[0].slides.length === 1,
      'generateConceptBeatContent must populate conceptBeats[0].slides'
    );
    assert.ok(
      homeworkData && Array.isArray(sampleUnitForBeats.homeworkBeats[0].questions) && sampleUnitForBeats.homeworkBeats[0].questions.length === 1,
      'generateHomeworkBeatContent must populate homeworkBeats[0].questions'
    );
    assert.strictEqual(beatRequests.length, 2, 'Both beat generators should succeed on first Groq text call');
    for (const req of beatRequests) {
      assert.ok(req.url.includes('api.groq.com'), 'Stage 2 & Stage 3 beat calls must route to Groq first');
      const userMsg = req.body.messages.find((m) => m.role === 'user');
      assert.strictEqual(
        typeof userMsg.content,
        'string',
        'Beat generation must pass inlineImages: [] (plain text user content, zero base64 image_url array)'
      );
    }

    // 4C: OpenRouter Multimodal Unblocking when hasImages === true
    let openRouterMultimodalBody = null;
    const visionTierOrder = [];
    env.setFetchHandler(async (url, options) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        if (visionTierOrder[visionTierOrder.length - 1] !== 'gemini') visionTierOrder.push('gemini');
        return { ok: false, status: 429, async text() { return 'Quota'; }, async json() { return {}; } };
      }
      if (url.includes('api.groq.com')) {
        if (visionTierOrder[visionTierOrder.length - 1] !== 'groq') visionTierOrder.push('groq');
        return { ok: false, status: 503, async text() { return '503'; }, async json() { return {}; } };
      }
      if (url.includes('openrouter.ai')) {
        if (visionTierOrder[visionTierOrder.length - 1] !== 'openrouter') visionTierOrder.push('openrouter');
        openRouterMultimodalBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          async json() {
            return { choices: [{ message: { content: 'פענוח תמונה מוצלח דרך OpenRouter' } }] };
          }
        };
      }
      throw new Error('Unexpected URL: ' + url);
    });

    const visionReply = await X.callMultiTierAI('חלץ טקסט מתמונת העמוד', {
      inlineImages: [{ mimeType: 'image/jpeg', data: 'QUJDREVGRw==' }],
      preferVision: true
    });
    assert.strictEqual(visionReply, 'פענוח תמונה מוצלח דרך OpenRouter');
    assert.deepStrictEqual(
      visionTierOrder,
      ['gemini', 'groq', 'openrouter'],
      'Vision tasks must try Gemini -> Groq Vision -> OpenRouter Multimodal (unblocked!)'
    );
    assert.ok(openRouterMultimodalBody, 'OpenRouter must receive multimodal request when hasImages is true');
    const orUserMsg = openRouterMultimodalBody.messages.find((m) => m.role === 'user');
    assert.strictEqual(Array.isArray(orUserMsg.content), true, 'OpenRouter user content must be multimodal array');
    assert.strictEqual(
      orUserMsg.content.some((part) => part.type === 'image_url' && part.image_url.url.startsWith('data:image/jpeg;base64,')),
      true,
      'OpenRouter multimodal payload must contain base64 image_url part'
    );

    results.push('[Test 4 - Smart Task Routing & OpenRouter Multimodal Unblocking] PASSED');
  }

  // =========================================================================
  // [Test 5 - IndexedDB Snapshot Separation]
  // =========================================================================
  {
    env.localStorageMock.clear();
    const heavyChunk = 'A'.repeat(160 * 1024); // ~160 KB per page * 3 pages = ~480 KB
    const testUnitId = 'study_unit_idb_sep_01';
    const sampleSnapshots = [
      { pageNumber: 1, mimeType: 'image/jpeg', data: heavyChunk },
      { pageNumber: 2, mimeType: 'image/jpeg', data: heavyChunk },
      { pageNumber: 3, mimeType: 'image/jpeg', data: heavyChunk }
    ];

    X.appState.studyHelpUnits = [
      {
        id: testUnitId,
        title: 'יחידה עם צילומי עמודים כבדים',
        completed: false,
        inlineImages: sampleSnapshots,
        sourceContext: {
          fullExtractedText: 'טקסט מחולץ קל משקל שנשמר ב-localStorage',
          pageSnapshots: sampleSnapshots
        }
      }
    ];

    X.saveAppState();

    const rawStoredJson = env.localStorageMock.getItem('DANIEL_AI_V3_CLEAN');
    assert.ok(rawStoredJson, 'DANIEL_AI_V3_CLEAN must be written to localStorage');
    assert.strictEqual(
      rawStoredJson.includes(heavyChunk.slice(0, 256)),
      false,
      'Heavy base64 pageSnapshots must NOT be serialized into localStorage'
    );
    assert.ok(
      rawStoredJson.length < 25000,
      `Serialized localStorage state must stay compact (<25KB), got ${rawStoredJson.length} bytes`
    );

    const parsedLocal = JSON.parse(rawStoredJson);
    assert.deepStrictEqual(
      parsedLocal.studyHelpUnits[0].pageSnapshots,
      [],
      'Persisted localStorage unit must have empty pageSnapshots array'
    );
    assert.deepStrictEqual(
      parsedLocal.studyHelpUnits[0].sourceContext.pageSnapshots,
      [],
      'Persisted localStorage unit sourceContext must also have empty pageSnapshots array'
    );

    const storedRecord = await X.StudySnapshotsIDB.getUnitSnapshots(testUnitId);
    const storedSnaps = await X.StudySnapshotsIDB.getSnapshots(testUnitId);
    assert.ok(storedRecord && Array.isArray(storedRecord.pageSnapshots), 'StudySnapshotsIDB record must contain pageSnapshots');
    assert.strictEqual(storedSnaps.length, 3, 'All 3 pageSnapshots must be stored in StudySnapshotsIDB');
    assert.strictEqual(storedSnaps[0].data.length, heavyChunk.length, 'Full base64 snapshot data preserved in IDB');

    results.push('[Test 5 - IndexedDB Snapshot Separation] PASSED');
  }

  // =========================================================================
  // [Test 6 - Upload & Generation Cancellation]
  // =========================================================================
  {
    const baselineUnit = { id: 'existing_safe_unit', title: 'יחידה קיימת ובטוחה', completed: false };
    const partialUnit = { id: 'partial_inflight_unit', title: 'יחידה חלקית בבנייה', completed: false };
    X.appState.studyHelpUnits = [partialUnit, baselineUnit];

    const session = X.StudyGenerationCancelManager.startNewSession();
    X.StudyGenerationCancelManager._partialUnitId = 'partial_inflight_unit';

    let abortEventTriggered = false;
    session.signal.addEventListener('abort', () => {
      abortEventTriggered = true;
    });

    // Simulate a slow in-flight AI request wired to session.signal
    env.setFetchHandler((_url, options) => {
      return new Promise((_resolve, reject) => {
        if (options && options.signal) {
          if (options.signal.aborted) {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            return reject(err);
          }
          options.signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });

    const simulatedGenerationTask = (async () => {
      await X.callMultiTierAI('בנה שלד יחידה מקובץ', { abortSignal: session.signal });
      if (!session.isCancelled()) {
        X.appState.studyHelpUnits.unshift({ id: 'cancelled_ghost_unit', title: 'אסור שיישמר' });
      }
    })();

    // Cancel active session while AI call is in flight
    X.StudyGenerationCancelManager.cancelActiveSession();
    assert.strictEqual(session.signal.aborted, true, 'Active AbortController signal must be aborted');
    assert.strictEqual(abortEventTriggered, true, 'Abort event listener must fire immediately');
    assert.strictEqual(session.isCancelled(), true, 'session.isCancelled() must be true');

    let caughtAbortErr = null;
    try {
      await simulatedGenerationTask;
    } catch (err) {
      caughtAbortErr = err;
    }

    assert.ok(caughtAbortErr, 'In-flight callMultiTierAI must abort when cancelActiveSession() runs');
    assert.strictEqual(caughtAbortErr.name, 'AbortError', 'Cancellation error must have name AbortError');
    assert.strictEqual(
      X.appState.studyHelpUnits.length,
      1,
      'Cancelled generation run must clean partial unit and NOT mutate existing appState.studyHelpUnits'
    );
    assert.strictEqual(X.appState.studyHelpUnits[0].id, 'existing_safe_unit');

    results.push('[Test 6 - Upload & Generation Cancellation] PASSED');
  }

  // =========================================================================
  // [Test 7 - 12-Question Consolidation & Solved-Example Separation]
  // =========================================================================
  {
    const rawOutlines = [
      // Solved textbook examples that MUST be filtered out
      {
        question_number_label: 'דוגמה פתורה 1',
        exact_book_text: 'דוגמה פתורה עם פתרון מודפס מהחוברת לחישוב פחת.',
        is_solved_example: true,
        page_number: 2
      },
      {
        question_number_label: 'דוגמה פתורה 2',
        exact_book_text: 'דוגמה פתורה: פתרון מלא להמחשה בכיתה.',
        page_number: 3
      },
      // Multi-part Question 1 (סעיפים א', ב', ג') that MUST merge into 1 parent question
      {
        question_number_label: 'שאלה 1 סעיף א\'',
        exact_book_text: 'חשב את יתרת המזומנים של החברה ליום 31.12.',
        question_type: 'calculation',
        page_number: 4
      },
      {
        question_number_label: 'שאלה 1 סעיף ב\'',
        exact_book_text: 'רשום את פקודת היומן בגין תשלום השכירות.',
        question_type: 'journal_table',
        page_number: 4
      },
      {
        question_number_label: 'סעיף ג\'',
        exact_book_text: 'הצג את ההשפעה על משוואת המאזן.',
        question_type: 'open_question',
        page_number: 5
      },
      // Multi-part Question 2 (סעיף א' + סעיף ב')
      {
        question_number_label: 'שאלה 2 סעיף א\'',
        exact_book_text: 'חשב את עלות המכר.',
        question_type: 'calculation',
        page_number: 5
      },
      {
        question_number_label: 'שאלה 2 סעיף ב\'',
        exact_book_text: 'חשב את הרווח הגולמי.',
        question_type: 'calculation',
        page_number: 5
      }
    ];

    // Add 16 additional standalone homework questions (שאלה 3 .. שאלה 18) -> total > 20 raw items
    for (let q = 3; q <= 18; q++) {
      rawOutlines.push({
        question_number_label: `שאלה ${q}`,
        exact_book_text: `נתח את האירוע החשבונאי בשאלה ${q} ורשום חובה וזכות.`,
        question_type: 'open_question',
        page_number: Math.min(15, 5 + Math.floor(q / 2))
      });
    }

    const consolidated = X.consolidateAndCapQuestionOutlines(rawOutlines, 12);

    assert.ok(Array.isArray(consolidated), 'consolidateAndCapQuestionOutlines must return an array');
    assert.ok(
      consolidated.length <= 12,
      `Consolidated homework questions must be capped at <= 12, got ${consolidated.length}`
    );
    assert.strictEqual(consolidated.length, 12, 'With 18 distinct parent questions, cap should produce exactly 12');

    // Verify solved examples were filtered out
    const hasSolvedExample = consolidated.some(
      (q) =>
        /דוגמה\s*פתורה/.test(q.question_number_label || '') ||
        /דוגמה\s*פתורה/.test(q.exact_book_text || '')
    );
    assert.strictEqual(hasSolvedExample, false, 'Solved textbook examples must be excluded from homework questions');

    // Verify שאלה 1 merged סעיף א', סעיף ב', סעיף ג' under a single parent question
    const q1 = consolidated[0];
    assert.ok(
      String(q1.question_number_label || '').startsWith('שאלה 1'),
      `First consolidated question should be parent שאלה 1, got "${q1.question_number_label}"`
    );
    assert.ok(q1.exact_book_text.includes('31.12'), 'Merged שאלה 1 must include סעיף א text');
    assert.ok(q1.exact_book_text.includes('פקודת היומן'), 'Merged שאלה 1 must include סעיף ב text');
    assert.ok(q1.exact_book_text.includes('משוואת המאזן'), 'Merged שאלה 1 must include סעיף ג text');

    results.push('[Test 7 - 12-Question Consolidation & Solved-Example Separation] PASSED');
  }

  // =========================================================================
  // [Test 8 - Generalized Identity & Single-Column Split-View UI]
  // =========================================================================
  {
    const filesToCheckIdentity = [
      'src/controllers/studyHelpController.js',
      'src/services/ai/aiOrchestrator.js',
      'src/components/globalAiBubble.js',
      'src/controllers/adminController.js',
      'src/state/store.js',
      'src/main.js',
      'src/components/aiEvalBlock.js',
      'src/components/journalGridBlock.js',
      'src/components/exerciseStepper.js',
      'src/controllers/roadmapController.js',
      'src/controllers/unitPlayerController.js',
      'index.html'
    ];

    const forbiddenIdentityPatterns = [
      { label: 'דניאל', regex: /דניאל/g },
      { label: 'אושרי', regex: /אושרי/g },
      { label: 'בן 28', regex: /בן\s*28/g },
      { label: '28-year-old', regex: /28-year-old/gi }
    ];

    for (const relFile of filesToCheckIdentity) {
      const content = readRepoFile(relFile);
      for (const pat of forbiddenIdentityPatterns) {
        const matches = content.match(pat.regex);
        assert.strictEqual(
          matches ? matches.length : 0,
          0,
          `Found hardcoded personal identity "${pat.label}" in ${relFile}`
        );
      }
    }

    // Verify internal storage keys remain 100% intact for backwards compatibility
    const storeSrc = readRepoFile('src/state/store.js');
    const dbManagerSrc = readRepoFile('src/db/DatabaseManager.js');
    assert.ok(storeSrc.includes("'DANIEL_AI_V3_CLEAN'"), "Storage key 'DANIEL_AI_V3_CLEAN' must remain intact");
    assert.ok(dbManagerSrc.includes("'DANIEL_AI_DB_CONFIG_V1'"), "Storage key 'DANIEL_AI_DB_CONFIG_V1' must remain intact");

    // Verify cleanLearnerVisibleTitle & cleanLearnerVisibleSummary strip internal mapping metadata
    const cleanedTitle = X.cleanLearnerVisibleTitle('משוואת המאזן | מיפוי מלא של עמודים 4-8');
    assert.strictEqual(cleanedTitle, 'משוואת המאזן', 'cleanLearnerVisibleTitle must strip internal page mapping suffix');
    const cleanedSummary = X.cleanLearnerVisibleSummary(
      'מיפוי מלא ללא שום השמטה של כל החומר. נכיר את משוואת המאזן ונפתור דוגמאות.'
    );
    assert.ok(!cleanedSummary.includes('מיפוי מלא'), 'cleanLearnerVisibleSummary must strip internal mapping phrases');
    assert.ok(cleanedSummary.includes('משוואת המאזן'), 'cleanLearnerVisibleSummary must keep pedagogical content');

    // Verify CSS rules in styles/tutor-chat.css
    const cssSrc = readRepoFile('styles/tutor-chat.css');

    const conceptColsMatch = cssSrc.match(/\.study-concept-columns\s*\{([^}]*)\}/);
    assert.ok(conceptColsMatch, '.study-concept-columns rule must exist in styles/tutor-chat.css');
    assert.ok(
      /grid-template-columns\s*:\s*1fr\s*;/.test(conceptColsMatch[1]),
      '.study-concept-columns must use grid-template-columns: 1fr;'
    );

    const dualQuestionsMatch = cssSrc.match(/\.study-dual-bottom-questions-grid\s*\{([^}]*)\}/);
    assert.ok(dualQuestionsMatch, '.study-dual-bottom-questions-grid rule must exist in styles/tutor-chat.css');
    assert.ok(
      /grid-template-columns\s*:\s*1fr\s*;/.test(dualQuestionsMatch[1]),
      '.study-dual-bottom-questions-grid must use grid-template-columns: 1fr;'
    );

    const backdropMatch = cssSrc.match(/\.global-ai-backdrop\s*\{([^}]*)\}/);
    assert.ok(backdropMatch, '.global-ai-backdrop rule must exist');
    assert.ok(
      /display\s*:\s*none\s*!important/.test(backdropMatch[1]),
      '.global-ai-backdrop must enforce display: none !important'
    );

    const quickChipsMatch = cssSrc.match(/\.global-ai-quick-chips\s*\{([^}]*)\}/);
    assert.ok(quickChipsMatch, '.global-ai-quick-chips rule must exist');
    assert.ok(
      /flex-wrap\s*:\s*nowrap/.test(quickChipsMatch[1]),
      '.global-ai-quick-chips must enforce single-row flex-wrap: nowrap'
    );

    assert.ok(
      cssSrc.includes('body.global-ai-split-active') && cssSrc.includes('padding-left: 418px'),
      'Desktop split-view rule body.global-ai-split-active { padding-left: 418px } must exist'
    );

    // Runtime check on GlobalAiAssistant split-view class toggling & hidden backdrop
    X.GlobalAiAssistant.syncDelayMs = 0;
    await X.GlobalAiAssistant.open();
    const backdropEl = env.documentMock.getElementById('global-ai-assistant-backdrop');
    assert.strictEqual(
      env.documentMock.body.classList.contains('global-ai-split-active'),
      true,
      'GlobalAiAssistant.open() must activate body.global-ai-split-active'
    );
    assert.strictEqual(
      backdropEl.style.display,
      'none',
      'GlobalAiAssistant backdrop must remain display: none when open'
    );

    X.GlobalAiAssistant.close();
    assert.strictEqual(
      env.documentMock.body.classList.contains('global-ai-split-active'),
      false,
      'GlobalAiAssistant.close() must remove body.global-ai-split-active'
    );

    results.push('[Test 8 - Generalized Identity & Single-Column Split-View UI] PASSED');
  }

  console.log('================================================================');
  console.log('v5.1 RECOVERY END-TO-END VERIFICATION SUITE');
  console.log('================================================================');
  for (const line of results) {
    console.log('✅ ' + line);
  }
  console.log('----------------------------------------------------------------');
  console.log(`TOTAL: ${results.length}/8 TESTS PASSED (100%)`);
  console.log('================================================================');
}

runVerificationSuite().catch((err) => {
  console.error('❌ VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
