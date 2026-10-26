/**
 * מאמן ה-AI של דניאל v3.0 - מנוע האפליקציה המלא והמודולרי
 * 
 * ארכיטקטורה מנותקת תלויות (Decoupled Scalable Architecture):
 * 1. שכבת הנתונים נשלפת מ-curriculum_data.js (Single Source of Truth).
 * 2. מנגנון Preserve & Merge חכם: משמר 100% מההתקדמות והציונים של דניאל מ-localStorage,
 *    וממזג אוטומטית יחידות חדשות שנוספות ב-Git מבלי לדרוס שום היסטוריה.
 * 3. פדגוגיית 4 השלבים המשודרגת:
 *    - שלב 1: המחשה מוחשית Side-by-Side.
 *    - שלב 2: הכלל שלמדנו + אינדיקטור "רמזור ה-AI" (ירוק, צהוב, אדום).
 *    - שלב 3: אסטרטגיה ובחירה לפני ביצוע.
 *    - שלב 4: משימת 4 החלקים: ביצוע -> הבנה -> העברה ("שנה דבר אחד") -> שיקוף אישי.
 * 4. מבחני שלב (Checkpoints) מבוססי סיטואציות חיים עם בנק שאלות מתחלף ורף 85+.
 * 5. כפתור "מצב רגוע" (Calm Mode) לוויסות והרגעת עומסים.
 * 6. נעילת שבת אוטומטית (שישי 16:30 עד מוצ"ש 20:30) עם מעקף מלווה.
 * 7. ממשק ניהול סמוי (#admin) עם עורך יחידות חזותי ללא קוד, מחולל AI וכפתור העתקת JSON ל-Git.
 */

// ============================================================================
// 1. קבועים, מפתחות אחסון ומצב האפליקציה
// ============================================================================

const STORAGE_KEY = 'DANIEL_AI_V3_CLEAN';
const LEGACY_STORAGE_KEYS = [
  'DANIEL_AI_LEARNING_SYSTEM_V2',
  'DANIEL_AI_LEARNING_SYSTEM_V1',
  'daniel_ai_learning_system_v3',
  'daniel_ai_learning_system_state'
];
const ADMIN_PIN_DEFAULT = '1234';

// טעינת בסיס הנתונים מ-curriculum_data.js
function getBaseCurriculum() {
  if (typeof getCurriculumData === 'function') {
    return getCurriculumData();
  }
  return typeof CURRICULUM_DATA !== 'undefined' ? JSON.parse(JSON.stringify(CURRICULUM_DATA)) : [];
}

function getBaseCheckpoints() {
  if (typeof getCheckpointsData === 'function') {
    return getCheckpointsData();
  }
  return typeof CHECKPOINTS_DATA !== 'undefined' ? JSON.parse(JSON.stringify(CHECKPOINTS_DATA)) : [];
}

function getBaseClusters() {
  if (typeof getClustersData === 'function') {
    return getClustersData();
  }
  return typeof CLUSTERS_DATA !== 'undefined' ? JSON.parse(JSON.stringify(CLUSTERS_DATA)) : [];
}

/**
 * רישום מסלולי הלימוד במערכת (Dynamic Track Registry)
 * מאפשר הוספת מסלול חדש בעתיד באמצעות שורה אחת בלבד כאן וקובץ נתונים מתאים
 */
const TRACKS = [
  {
    id: 'general',
    label: 'מסלול 1: מיומנויות AI וכלים מעשיים 🤖',
    shortLabel: 'כללי ו-AI',
    title: 'מיומנויות AI וכלים מעשיים',
    icon: '🎯',
    description: 'שימוש חכם, בטוח ומעשי בכלי בינה מלאכותית בחיי היומיום ובעבודה',
    dataVar: 'CURRICULUM_DATA',
    engine: 'legacy'
  },
  {
    id: 'accounting',
    label: 'מסלול 2: יסודות הנהלת חשבונות 📊',
    shortLabel: 'הנהלת חשבונות',
    title: 'יסודות הנהלת חשבונות',
    icon: '💼',
    description: 'לימוד מובנה של חובה וזכות, פקודות יומן, מע"מ, כרטסת ומאזן בוחן',
    dataVar: 'ACCOUNTING_CURRICULUM',
    engine: 'blocks'
  },
  {
    id: 'study_help',
    label: '📚 עזרה בלימודים (תרגול יומי)',
    shortLabel: 'עזרה בלימודים',
    title: 'עזרה בלימודים (תרגול יומי)',
    icon: '📚',
    engine: 'study_help',
    description: 'העלאת דפי תרגול מהספר או הדבקת שאלות, לימוד מודרך בצ׳אט עם המאמן, ויצירת מבחן מסכם אוטומטי בהנהלת חשבונות',
    dataVar: null
  }
];

/**
 * החזרת הגדרת המסלול הפעיל הנוכחי
 * @returns {object}
 */
function getActiveTrack() {
  const currentId = appState.activeTrackId || 'general';
  return TRACKS.find(t => t.id === currentId) || TRACKS[0];
}

/**
 * מסנן יחידות שנמחקו (deletedUnitIds) ומחיל עריכות מלווה שמורות (unitOverrides)
 * על יחידות מסלול 1 ומסלול 2 באופן קבוע בין רענונים.
 * @param {Array} unitsList
 * @returns {Array}
 */
function applyUnitDeletionsAndOverrides(unitsList) {
  if (!Array.isArray(unitsList)) return [];
  const deletedSet = new Set(
    Array.isArray(appState?.deletedUnitIds) ? appState.deletedUnitIds.filter(Boolean).map(String) : []
  );
  const overrides = (appState?.unitOverrides && typeof appState.unitOverrides === 'object')
    ? appState.unitOverrides
    : {};

  return unitsList
    .filter(u => {
      if (!u) return false;
      const uid = String(u.id || u.unit_id || '');
      return !uid || !deletedSet.has(uid);
    })
    .map(u => {
      const uid = String(u.id || u.unit_id || '');
      const patch = uid ? overrides[uid] : null;
      if (patch && typeof patch === 'object') {
        const merged = { ...u, ...patch, id: u.id || uid };
        if (patch.description && Array.isArray(u.blocks)) {
          let updatedFirstLead = false;
          merged.blocks = u.blocks.map(b => {
            if (!updatedFirstLead && b && b.type === 'text') {
              updatedFirstLead = true;
              return { ...b, content: patch.description };
            }
            return b;
          });
        }
        return merged;
      }
      return u;
    });
}

/**
 * שליפת יחידות הלימוד עבור מסלול מסוים (כולל סטטוס השלמה, מחיקות ועריכות שמורות)
 * @param {object} [track]
 * @returns {Array}
 */
function getTrackUnits(track) {
  if (!track) track = getActiveTrack();
  if (track.engine === 'legacy') {
    return applyUnitDeletionsAndOverrides(appState.curriculumUnits || []);
  }
  if (!track.dataVar) {
    return [];
  }
  let raw = [];
  if (track.dataVar === 'ACCOUNTING_CURRICULUM' && typeof window !== 'undefined' && Array.isArray(window._RAW_ACCOUNTING_CURRICULUM)) {
    raw = window._RAW_ACCOUNTING_CURRICULUM;
  } else if (typeof window !== 'undefined' && window[track.dataVar]) {
    raw = window[track.dataVar];
  } else if (track.dataVar === 'ACCOUNTING_CURRICULUM' && typeof ACCOUNTING_CURRICULUM !== 'undefined') {
    raw = ACCOUNTING_CURRICULUM;
  }
  const completedList = (appState.trackProgress && appState.trackProgress[track.id]) || [];
  const hydrated = raw.map(u => {
    const uid = u.unit_id || u.id;
    return {
      ...u,
      id: uid,
      isCompleted: completedList.includes(uid)
    };
  });
  return applyUnitDeletionsAndOverrides(hydrated);
}

let appState = {
  version: 3,
  _updatedAt: null,
  currentView: 'roadmap',
  activeTrackId: 'general',
  activeUnitId: 'unit_1',
  user: {
    name: 'דניאל',
    age: 28
  },
  clusters: getBaseClusters(),
  curriculumUnits: getBaseCurriculum(),
  checkpoints: getBaseCheckpoints(),
  deletedUnitIds: [],
  unitOverrides: {},
  trackProgress: {
    general: [],
    accounting: [],
    study_help: []
  },
  studyHelpUnits: [],
  accountingSummaryExams: [],
  studyHelpStats: {
    streakDays: 1,
    lastStudyDate: new Date().toISOString().slice(0, 10),
    totalStars: 0,
    lessonsCompleted: 0
  },
  studyHelp: {
    dailyCards: [],
    activeCardId: null,
    sessions: [],
    activeSessionId: null,
    savedNotes: [],
    totalQuestionsAsked: 0
  },
  accountingExam: {
    attempts: [],
    activeExam: null,
    bestScore: 0,
    lastAttemptAt: null,
    homeworkExams: []
  },
  caregiverNotes: [
    {
      id: 'note_1',
      author: 'אבא ואושרי',
      date: '2026-10-04',
      text: 'דניאל מתקדם בצורה נפלאה, עצמאית ובטוחה. המערכת מותאמת בדיוק לצרכים שלו עם חיזוקים חיוביים ומבחני שלב.'
    }
  ],
  dbConfig: {
    activeProvider: 'local',
    githubToken: '',
    githubGistId: '',
    firebaseUrl: '',
    firebaseSecret: '',
    customEndpointUrl: '',
    customApiKey: '',
    lastSyncedAt: null
  },
  apiConfig: {
    geminiKey: '',
    groqKey: '',
    openrouterKey: '',
    verifiedGroqModel: '',
    verifiedGroqVisionModel: '',
    verifiedGeminiModel: '',
    verifiedOpenRouterModel: '',
    ollamaUrl: 'http://localhost:11434',
    adminPin: ADMIN_PIN_DEFAULT
  },
  quizHistory: [],
  feedbackHistory: []
};

function cleanApiKey(val) {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["']+|["']+$/g, '').trim();
}

async function syncEnvKeysFromServer() {
  try {
    const res = await fetch('/api/env', { cache: 'no-store' });
    if (!res.ok) return;
    const envKeys = await res.json();
    let changed = false;

    const groqK = cleanApiKey(envKeys.groqKey);
    const geminiK = cleanApiKey(envKeys.geminiKey);
    const orK = cleanApiKey(envKeys.openrouterKey);

    if (groqK) {
      appState.apiConfig.groqKey = groqK;
      localStorage.setItem('groq_api_key', groqK);
      changed = true;
    }
    if (geminiK) {
      appState.apiConfig.geminiKey = geminiK;
      localStorage.setItem('gemini_api_key', geminiK);
      changed = true;
    }
    if (orK) {
      appState.apiConfig.openrouterKey = orK;
      localStorage.setItem('openrouter_api_key', orK);
      changed = true;
    }

    if (changed) {
      saveAppState();
      const groqInput = document.getElementById('cfg-groq-key');
      const geminiInput = document.getElementById('cfg-gemini-key');
      const orInput = document.getElementById('cfg-openrouter-key');
      if (groqInput && appState.apiConfig.groqKey) groqInput.value = appState.apiConfig.groqKey;
      if (geminiInput && appState.apiConfig.geminiKey) geminiInput.value = appState.apiConfig.geminiKey;
      if (orInput && appState.apiConfig.openrouterKey) orInput.value = appState.apiConfig.openrouterKey;
    }
  } catch (err) {
    // Silent fallback when running statically (e.g., GitHub Pages without server.py)
  }
}

// ============================================================================
// 1b. גישור שכבת מסד הנתונים התלת-שכבתית (DatabaseManager Bridge & Cloud Sync)
// ============================================================================

function normalizeDbConfig(rawCfg) {
  const base = {
    activeProvider: 'local',
    githubToken: '',
    githubGistId: '',
    firebaseUrl: '',
    firebaseSecret: '',
    customEndpointUrl: '',
    customApiKey: '',
    lastSyncedAt: null
  };

  let savedMgr = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const rawMgr = localStorage.getItem('DANIEL_AI_DB_CONFIG_V1');
      if (rawMgr) savedMgr = JSON.parse(rawMgr);
    }
  } catch (_e) {}

  const src = (rawCfg && typeof rawCfg === 'object') ? rawCfg : {};
  const mgrConfigs = src.providerConfigs || savedMgr?.providerConfigs || {};

  const candidateProvider = src.activeProvider || src.activeProviderType || savedMgr?.activeProviderType || 'local';
  base.activeProvider = ['local', 'github', 'firebase', 'custom'].includes(candidateProvider)
    ? candidateProvider
    : 'local';

  base.githubToken = cleanApiKey(src.githubToken || mgrConfigs.github?.token || '');
  base.githubGistId = cleanApiKey(src.githubGistId || mgrConfigs.github?.gistId || '');
  base.firebaseUrl = String(src.firebaseUrl || mgrConfigs.firebase?.databaseUrl || '').trim();
  base.firebaseSecret = cleanApiKey(src.firebaseSecret || mgrConfigs.firebase?.authSecret || '');
  base.customEndpointUrl = String(src.customEndpointUrl || mgrConfigs.custom?.endpointUrl || '').trim();
  base.customApiKey = cleanApiKey(src.customApiKey || mgrConfigs.custom?.apiKey || '');
  base.lastSyncedAt = src.lastSyncedAt || null;

  return base;
}

function toDatabaseManagerInitOptions(dbCfg) {
  const normalized = normalizeDbConfig(dbCfg);
  return {
    activeProviderType: normalized.activeProvider,
    providerConfigs: {
      local: {},
      github: {
        token: normalized.githubToken,
        gistId: normalized.githubGistId,
        filename: 'daniel_ai_cloud_state.json'
      },
      firebase: {
        databaseUrl: normalized.firebaseUrl,
        authSecret: normalized.firebaseSecret
      },
      custom: {
        endpointUrl: normalized.customEndpointUrl,
        apiKey: normalized.customApiKey,
        saveMethod: 'POST'
      }
    }
  };
}

function bridgeDatabaseManager() {
  const dm = (typeof window !== 'undefined' && window.DatabaseManager)
    ? window.DatabaseManager
    : (typeof DatabaseManager !== 'undefined' ? DatabaseManager : null);
  if (!dm) return null;
  if (dm._storeBridged) return dm;

  const origPersist = typeof dm._persistDbConfig === 'function' ? dm._persistDbConfig.bind(dm) : null;
  dm._persistDbConfig = function() {
    const prevLastSynced = (typeof appState !== 'undefined' && appState?.dbConfig?.lastSyncedAt) || null;
    if (origPersist) origPersist();
    if (typeof appState !== 'undefined' && appState && typeof appState === 'object') {
      appState.dbConfig = {
        activeProvider: this.activeProviderType || 'local',
        githubToken: cleanApiKey(this.providerConfigs?.github?.token || ''),
        githubGistId: cleanApiKey(this.providerConfigs?.github?.gistId || ''),
        firebaseUrl: String(this.providerConfigs?.firebase?.databaseUrl || '').trim(),
        firebaseSecret: cleanApiKey(this.providerConfigs?.firebase?.authSecret || ''),
        customEndpointUrl: String(this.providerConfigs?.custom?.endpointUrl || '').trim(),
        customApiKey: cleanApiKey(this.providerConfigs?.custom?.apiKey || ''),
        lastSyncedAt: this.syncStatus?.lastSyncedAt || prevLastSynced
      };
    }
  };

  if (typeof dm.saveState !== 'function') {
    dm.saveState = async function(state, options = {}) {
      if (state && state.dbConfig) {
        const mapped = toDatabaseManagerInitOptions(state.dbConfig);
        this.activeProviderType = mapped.activeProviderType;
        this.providerConfigs = {
          local: { ...(this.providerConfigs?.local || {}), ...mapped.providerConfigs.local },
          github: { ...(this.providerConfigs?.github || {}), ...mapped.providerConfigs.github },
          firebase: { ...(this.providerConfigs?.firebase || {}), ...mapped.providerConfigs.firebase },
          custom: { ...(this.providerConfigs?.custom || {}), ...mapped.providerConfigs.custom }
        };
      }
      return this.saveFullState(state, options);
    };
  }

  if (typeof dm.onStatusChange === 'function') {
    dm.onStatusChange((statusObj) => {
      if (statusObj && statusObj.lastSyncedAt && typeof appState !== 'undefined' && appState?.dbConfig) {
        appState.dbConfig.lastSyncedAt = statusObj.lastSyncedAt;
      }
    });
  }

  dm._storeBridged = true;
  return dm;
}

bridgeDatabaseManager();

/**
 * ניקוי אוטומטי של תמונות Base64 כבדות (pageSnapshots / inlineImages)
 * מיחידות לימוד שהושלמו, תוך שימור מראה המקום המדויק (sourceReferenceLabel & pageCount).
 */
function purgeCompletedUnitHeavyImages(stateObj) {
  if (!stateObj || typeof stateObj !== 'object') return 0;
  let purgedCount = 0;

  const stripUnit = (unit) => {
    if (!unit || typeof unit !== 'object') return;
    if (!(unit.completed === true || unit.isCompleted === true)) return;

    const hadSnapshots = Array.isArray(unit.pageSnapshots) && unit.pageSnapshots.length > 0;
    const hadInline = Array.isArray(unit.inlineImages) && unit.inlineImages.length > 0;
    const hadRawPdf = Boolean(unit.rawPdfPart || unit.rawPdfBase64);

    if (hadSnapshots || hadInline || hadRawPdf) {
      const pageCount = Number(unit.pageCount) ||
        (hadSnapshots ? unit.pageSnapshots.length : 0) ||
        (hadInline ? unit.inlineImages.length : 0) ||
        1;
      const fileTitle = unit.sourceFileName || unit.lesson_title || unit.title || 'שיעור יומי';
      unit.pageCount = pageCount;
      if (!unit.sourceReferenceLabel) {
        unit.sourceReferenceLabel = `📍 מקור בתיקייה שלך: קובץ '${fileTitle}' • עמודים 1-${pageCount}`;
      }
      unit.imagesPurged = true;
      unit.imagesPurgedAt = unit.imagesPurgedAt || new Date().toISOString();
      purgedCount++;
    }

    if (Array.isArray(unit.pageSnapshots) && unit.pageSnapshots.length > 0) {
      unit.pageSnapshots = [];
    }
    if (Array.isArray(unit.inlineImages) && unit.inlineImages.length > 0) {
      unit.inlineImages = [];
    }
    if ('rawPdfPart' in unit) delete unit.rawPdfPart;
    if ('rawPdfBase64' in unit) delete unit.rawPdfBase64;
  };

  if (Array.isArray(stateObj.studyHelpUnits)) {
    stateObj.studyHelpUnits.forEach(stripUnit);
  }
  if (stateObj.studyHelp && Array.isArray(stateObj.studyHelp.dailyCards)) {
    stateObj.studyHelp.dailyCards.forEach(stripUnit);
  }
  return purgedCount;
}

// ============================================================================
// 2. מנגנון Preserve & Merge חכם (סנכרון Git ללא דריסת היסטוריה מקומית)
// ============================================================================

function performSmartMergeAndMigration(options = {}) {
  try {
    const rawV3 = localStorage.getItem(STORAGE_KEY);
    const baseUnits = getBaseCurriculum();
    const baseCPs = getBaseCheckpoints();
    const baseClusters = getBaseClusters();

    if (typeof window !== 'undefined' && Array.isArray(window.ACCOUNTING_CURRICULUM) && !Array.isArray(window._RAW_ACCOUNTING_CURRICULUM)) {
      window._RAW_ACCOUNTING_CURRICULUM = JSON.parse(JSON.stringify(window.ACCOUNTING_CURRICULUM));
    }

    appState.clusters = baseClusters;

    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (parsed && typeof parsed === 'object') {
        if (parsed._updatedAt) appState._updatedAt = parsed._updatedAt;
        if (parsed.activeTrackId) appState.activeTrackId = parsed.activeTrackId;

        appState.dbConfig = normalizeDbConfig(parsed.dbConfig || appState.dbConfig);
        appState.deletedUnitIds = Array.isArray(parsed.deletedUnitIds)
          ? Array.from(new Set(parsed.deletedUnitIds.filter(Boolean).map(String)))
          : [];
        appState.unitOverrides = (parsed.unitOverrides && typeof parsed.unitOverrides === 'object' && !Array.isArray(parsed.unitOverrides))
          ? { ...parsed.unitOverrides }
          : {};

        if (parsed.trackProgress && typeof parsed.trackProgress === 'object') {
          appState.trackProgress = {
            general: Array.isArray(parsed.trackProgress.general) ? parsed.trackProgress.general : [],
            accounting: Array.isArray(parsed.trackProgress.accounting) ? parsed.trackProgress.accounting : [],
            study_help: Array.isArray(parsed.trackProgress.study_help) ? parsed.trackProgress.study_help : []
          };
        } else {
          appState.trackProgress = { general: [], accounting: [], study_help: [] };
        }
        appState.trackProgress.study_help = appState.trackProgress.study_help || [];
        appState.studyHelpUnits = Array.isArray(parsed.studyHelpUnits) ? parsed.studyHelpUnits : [];
        appState.accountingSummaryExams = Array.isArray(parsed.accountingSummaryExams) ? parsed.accountingSummaryExams : [];
        if (parsed.studyHelpStats && typeof parsed.studyHelpStats === 'object') {
          appState.studyHelpStats = {
            streakDays: Math.max(1, Number(parsed.studyHelpStats.streakDays) || 1),
            lastStudyDate: String(parsed.studyHelpStats.lastStudyDate || new Date().toISOString().slice(0, 10)),
            totalStars: Math.max(0, Number(parsed.studyHelpStats.totalStars) || 0),
            lessonsCompleted: Math.max(0, Number(parsed.studyHelpStats.lessonsCompleted) || 0)
          };
        } else {
          appState.studyHelpStats = {
            streakDays: 1,
            lastStudyDate: new Date().toISOString().slice(0, 10),
            totalStars: 0,
            lessonsCompleted: 0
          };
        }
        if (parsed.studyHelp && typeof parsed.studyHelp === 'object') {
          appState.studyHelp = {
            dailyCards: Array.isArray(parsed.studyHelp.dailyCards) ? parsed.studyHelp.dailyCards : [],
            activeCardId: parsed.studyHelp.activeCardId || null,
            sessions: Array.isArray(parsed.studyHelp.sessions) ? parsed.studyHelp.sessions : [],
            activeSessionId: parsed.studyHelp.activeSessionId || null,
            savedNotes: Array.isArray(parsed.studyHelp.savedNotes) ? parsed.studyHelp.savedNotes : [],
            totalQuestionsAsked: Number(parsed.studyHelp.totalQuestionsAsked) || 0
          };
        }
        if (parsed.accountingExam && typeof parsed.accountingExam === 'object') {
          appState.accountingExam = {
            attempts: Array.isArray(parsed.accountingExam.attempts) ? parsed.accountingExam.attempts : [],
            activeExam: parsed.accountingExam.activeExam || null,
            bestScore: Number(parsed.accountingExam.bestScore) || 0,
            lastAttemptAt: parsed.accountingExam.lastAttemptAt || null,
            homeworkExams: Array.isArray(parsed.accountingExam.homeworkExams) ? parsed.accountingExam.homeworkExams : []
          };
        }
        if (parsed.user) appState.user = parsed.user;
        if (parsed.apiConfig) {
          appState.apiConfig = { ...appState.apiConfig, ...parsed.apiConfig };
          appState.apiConfig.groqKey = cleanApiKey(appState.apiConfig.groqKey || localStorage.getItem('groq_api_key') || '');
          appState.apiConfig.geminiKey = cleanApiKey(appState.apiConfig.geminiKey || localStorage.getItem('gemini_api_key') || '');
          appState.apiConfig.openrouterKey = cleanApiKey(appState.apiConfig.openrouterKey || localStorage.getItem('openrouter_api_key') || '');
        }
        if (Array.isArray(parsed.caregiverNotes)) appState.caregiverNotes = parsed.caregiverNotes;
        if (Array.isArray(parsed.quizHistory)) appState.quizHistory = parsed.quizHistory;
        if (Array.isArray(parsed.feedbackHistory)) appState.feedbackHistory = parsed.feedbackHistory;

        // מיזוג חכם של היחידות:
        // לוקחים תמיד את כל היחידות המעודכנות מ-curriculum_data.js (כולל יחידות חדשות שנוספו ב-Git)
        // ומשמרים את הסטטוס (isCompleted, feedback) של יחידות שדניאל כבר ביצע!
        const completedMap = new Map();
        if (Array.isArray(parsed.curriculumUnits)) {
          parsed.curriculumUnits.forEach(u => {
            if (u.isCompleted) {
              completedMap.set(u.id, { isCompleted: true, feedback: u.feedback });
              if (!appState.trackProgress.general.includes(u.id)) {
                appState.trackProgress.general.push(u.id);
              }
            }
          });
        }

        appState.curriculumUnits = baseUnits.map(unit => {
          if (completedMap.has(unit.id) || appState.trackProgress.general.includes(unit.id)) {
            const saved = completedMap.get(unit.id) || {};
            return { ...unit, isCompleted: true, feedback: saved.feedback };
          }
          return unit;
        });

        // יחידות מותאמות אישית שהמלווה הוסיף באופן מקומי
        if (Array.isArray(parsed.curriculumUnits)) {
          const customUnits = parsed.curriculumUnits.filter(u => u.id && u.id.startsWith('unit_custom_'));
          customUnits.forEach(cu => {
            if (!appState.curriculumUnits.some(u => u.id === cu.id)) {
              appState.curriculumUnits.push(cu);
            }
          });
        }

        // החלת מחיקות ועריכות שמורות (deletedUnitIds & unitOverrides) על מסלול 1 ומסלול 2
        appState.curriculumUnits = applyUnitDeletionsAndOverrides(appState.curriculumUnits);
        if (typeof window !== 'undefined' && Array.isArray(window._RAW_ACCOUNTING_CURRICULUM)) {
          window.ACCOUNTING_CURRICULUM = applyUnitDeletionsAndOverrides(window._RAW_ACCOUNTING_CURRICULUM);
        }

        // מיזוג מבחני שלב
        const cpMap = new Map();
        if (Array.isArray(parsed.checkpoints)) {
          parsed.checkpoints.forEach(cp => {
            if (cp.isPassed) cpMap.set(cp.id, { isPassed: true, lastScore: cp.lastScore });
          });
        }

        appState.checkpoints = baseCPs.map(cp => {
          if (cpMap.has(cp.id)) {
            const saved = cpMap.get(cp.id);
            return { ...cp, isPassed: true, lastScore: saved.lastScore };
          }
          return cp;
        });

        saveAppState({
          skipTimestampBump: true,
          skipCloudSync: options.skipCloudSync !== false
        });
        return;
      }
    }

    // אם אין V3, בודקים גרסאות ישנות כדי לחלץ מפתחות API ופתקים
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        try {
          const legacyData = JSON.parse(legacyRaw);
          if (legacyData && typeof legacyData === 'object') {
            console.log(`[Migration] Migrating settings from legacy storage (${legacyKey})...`);
            if (legacyData.apiConfig) {
              appState.apiConfig.geminiKey = legacyData.apiConfig.geminiKey || appState.apiConfig.geminiKey;
              appState.apiConfig.groqKey = legacyData.apiConfig.groqKey || appState.apiConfig.groqKey;
              appState.apiConfig.ollamaUrl = legacyData.apiConfig.ollamaUrl || appState.apiConfig.ollamaUrl;
              appState.apiConfig.adminPin = legacyData.apiConfig.adminPin || appState.apiConfig.adminPin;
            }
            if (Array.isArray(legacyData.caregiverNotes) && legacyData.caregiverNotes.length > 0) {
              appState.caregiverNotes = legacyData.caregiverNotes;
            }
            if (Array.isArray(legacyData.curriculumUnits)) {
              const compCount = legacyData.curriculumUnits.filter(u => u.isCompleted).length;
              for (let i = 0; i < Math.min(compCount, appState.curriculumUnits.length); i++) {
                appState.curriculumUnits[i].isCompleted = true;
              }
            }
            saveAppState();
            break;
          }
        } catch (e) {
          console.warn(`Error parsing legacy key ${legacyKey}:`, e);
        }
      }
    }
    appState.dbConfig = normalizeDbConfig(appState.dbConfig);
    appState.deletedUnitIds = Array.isArray(appState.deletedUnitIds) ? appState.deletedUnitIds : [];
    appState.unitOverrides = (appState.unitOverrides && typeof appState.unitOverrides === 'object') ? appState.unitOverrides : {};
    appState.trackProgress = appState.trackProgress || { general: [], accounting: [], study_help: [] };
    appState.trackProgress.study_help = appState.trackProgress.study_help || [];
    appState.studyHelpUnits = Array.isArray(appState.studyHelpUnits) ? appState.studyHelpUnits : [];
    appState.accountingSummaryExams = Array.isArray(appState.accountingSummaryExams) ? appState.accountingSummaryExams : [];
  } catch (err) {
    console.error('Critical error in smart merge and migration:', err);
  }
}

let _isSavingAppState = false;

function saveAppState(options = {}) {
  if (_isSavingAppState) return;
  _isSavingAppState = true;
  try {
    // 1. Auto-Purge heavy base64 snapshots/images on any completed Study Help unit
    purgeCompletedUnitHeavyImages(appState);

    // 2. Update modification timestamp unless hydrating on initial boot
    if (!options.skipTimestampBump) {
      appState._updatedAt = new Date().toISOString();
    }

    // 3. Instant 0ms synchronous write to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }

    // 4. Delegate to DatabaseManager (write-through local server + debounced cloud sync)
    if (!options.skipCloudSync) {
      const dm = bridgeDatabaseManager();
      if (dm && typeof dm.saveState === 'function') {
        dm.saveState(appState).catch(err => {
          console.warn('[Store] DatabaseManager.saveState background warning:', err);
        });
      }
    }
  } finally {
    _isSavingAppState = false;
  }
}

/**
 * מסנכרן אוטומטית נתונים מהענן (GitHub Secret Gist / Firebase / Custom REST) בעליית האפליקציה
 * או בלחיצה יזומה על "משוך נתונים מהענן עכשיו" בממשק הניהול.
 * @param {object} [options] - `{ forcePull?: boolean, targetProvider?: string }`
 * @returns {Promise<{ synced: boolean, provider: string, source?: string, message?: string }>}
 */
async function syncCloudDatabaseOnStartup(options = {}) {
  try {
    const dm = bridgeDatabaseManager();
    if (!dm) {
      return { synced: false, provider: 'local', message: 'שכבת DatabaseManager אינה זמינה.' };
    }

    appState.dbConfig = normalizeDbConfig(appState.dbConfig);
    const provider = options.targetProvider || appState.dbConfig.activeProvider || 'local';

    await dm.init({
      ...toDatabaseManagerInitOptions(appState.dbConfig),
      activeProviderType: provider
    });

    if (!['github', 'firebase', 'custom'].includes(provider)) {
      return {
        synced: false,
        provider: 'local',
        message: 'המערכת פועלת במצב שמירה מקומית בלבד (local).'
      };
    }

    const hasCredentials =
      (provider === 'github' && Boolean(appState.dbConfig.githubToken)) ||
      (provider === 'firebase' && Boolean(appState.dbConfig.firebaseUrl)) ||
      (provider === 'custom' && Boolean(appState.dbConfig.customEndpointUrl));

    if (!hasCredentials) {
      return {
        synced: false,
        provider,
        message: `טרם הוגדרו פרטי חיבור עבור הספק '${provider}'.`
      };
    }

    const activeRepo = dm.providers[provider] || dm.getActiveRepo();
    if (!activeRepo || typeof activeRepo.loadFullState !== 'function') {
      return { synced: false, provider, message: 'ספק הענן המבוקש לא נמצא.' };
    }

    await activeRepo.init(dm.providerConfigs[provider] || {});
    const cloudRes = await activeRepo.loadFullState();

    // Update auto-discovered Gist ID if GithubRepo found one
    if (provider === 'github' && activeRepo.config?.gistId) {
      appState.dbConfig.githubGistId = activeRepo.config.gistId;
      dm.providerConfigs.github.gistId = activeRepo.config.gistId;
      dm._persistDbConfig();
    }

    if (!cloudRes || !cloudRes.state || typeof cloudRes.state !== 'object') {
      return {
        synced: false,
        provider,
        message: 'חיבור הענן תקין, אך עדיין אין נתונים שמורים בענן זה.'
      };
    }

    const localTs = Date.parse(appState._updatedAt || '') || 0;
    const cloudTs = Date.parse(cloudRes.state._updatedAt || cloudRes.updatedAt || '') || 0;
    const shouldApply = Boolean(options.forcePull) || !localTs || cloudTs > localTs;

    if (!shouldApply) {
      appState.dbConfig.lastSyncedAt = new Date().toISOString();
      return {
        synced: false,
        provider,
        source: cloudRes.source,
        message: 'הנתונים המקומיים כבר מעודכנים לגרסה האחרונה.'
      };
    }

    const nowIso = new Date().toISOString();
    const preservedApiConfig = {
      ...(appState.apiConfig || {}),
      ...(cloudRes.state.apiConfig || {}),
      groqKey: cleanApiKey(cloudRes.state.apiConfig?.groqKey || appState.apiConfig?.groqKey || ''),
      geminiKey: cleanApiKey(cloudRes.state.apiConfig?.geminiKey || appState.apiConfig?.geminiKey || ''),
      openrouterKey: cleanApiKey(cloudRes.state.apiConfig?.openrouterKey || appState.apiConfig?.openrouterKey || '')
    };

    const remoteDbNorm = normalizeDbConfig(cloudRes.state.dbConfig);
    const preservedDbConfig = {
      ...remoteDbNorm,
      ...appState.dbConfig,
      activeProvider: provider,
      githubToken: cleanApiKey(appState.dbConfig.githubToken || remoteDbNorm.githubToken || ''),
      githubGistId: cleanApiKey(appState.dbConfig.githubGistId || remoteDbNorm.githubGistId || ''),
      firebaseUrl: String(appState.dbConfig.firebaseUrl || remoteDbNorm.firebaseUrl || '').trim(),
      firebaseSecret: cleanApiKey(appState.dbConfig.firebaseSecret || remoteDbNorm.firebaseSecret || ''),
      customEndpointUrl: String(appState.dbConfig.customEndpointUrl || remoteDbNorm.customEndpointUrl || '').trim(),
      customApiKey: cleanApiKey(appState.dbConfig.customApiKey || remoteDbNorm.customApiKey || ''),
      lastSyncedAt: nowIso
    };

    const mergedPayload = {
      ...cloudRes.state,
      apiConfig: preservedApiConfig,
      dbConfig: preservedDbConfig
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedPayload));
    performSmartMergeAndMigration({ skipCloudSync: true });
    appState.dbConfig.lastSyncedAt = nowIso;
    saveAppState({ skipTimestampBump: true, skipCloudSync: true });

    // Re-render active UI views
    if (typeof renderTrackTabs === 'function') renderTrackTabs();
    if (appState.currentView === 'admin') {
      if (typeof renderAdminOverview === 'function') renderAdminOverview();
      if (typeof renderAdminCurriculum === 'function') renderAdminCurriculum();
      if (typeof renderAdminNotes === 'function') renderAdminNotes();
      if (typeof renderAdminSettings === 'function') renderAdminSettings();
    } else if (appState.currentView === 'unit') {
      if (appState.activeTrackId === 'study_help' && typeof openStudyHelpUnit === 'function' && appState.activeStudyHelpUnitId) {
        openStudyHelpUnit(appState.activeStudyHelpUnitId);
      } else if (typeof renderUnitPlayer === 'function' && appState.activeUnitId) {
        renderUnitPlayer(appState.activeUnitId);
      }
      if (typeof renderRoadmap === 'function') renderRoadmap();
    } else {
      if (typeof renderRoadmap === 'function') renderRoadmap();
    }

    return {
      synced: true,
      provider,
      source: cloudRes.source || provider,
      message: `הנתונים סונכרנו בהצלחה מהענן (${cloudRes.source || provider})!`
    };
  } catch (err) {
    console.warn('[Store] Cloud startup sync skipped/failed:', err);
    return {
      synced: false,
      provider: appState?.dbConfig?.activeProvider || 'local',
      message: err?.message || String(err)
    };
  }
}

if (typeof window !== 'undefined') {
  window.syncCloudDatabaseOnStartup = syncCloudDatabaseOnStartup;
  window.normalizeDbConfig = normalizeDbConfig;
  window.toDatabaseManagerInitOptions = toDatabaseManagerInitOptions;
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => { syncCloudDatabaseOnStartup().catch(() => {}); }, 25);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => { syncCloudDatabaseOnStartup().catch(() => {}); }, 25);
    });
  }
}

// ============================================================================
// 2b. פונקציות עזר למסלול 3 (עזרה בלימודים) ולמבחן המסכם בהנהלת חשבונות
// ============================================================================

function saveDailyStudyCard(cardData) {
  if (!appState.studyHelp || typeof appState.studyHelp !== 'object') {
    appState.studyHelp = { dailyCards: [], activeCardId: null, sessions: [], activeSessionId: null, savedNotes: [], totalQuestionsAsked: 0 };
  }
  if (!Array.isArray(appState.studyHelp.dailyCards)) {
    appState.studyHelp.dailyCards = [];
  }
  const now = new Date();
  const cardId = (cardData && cardData.id) || `daily_card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const rawQuestions = Array.isArray(cardData && cardData.questions) ? cardData.questions : [];
  const normalizedQuestions = rawQuestions.map((q, idx) => ({
    id: q.id || `${cardId}_q_${idx + 1}`,
    index: idx + 1,
    questionText: String(q.questionText || q.question || '').trim(),
    topic: String(q.topic || 'חומר לימוד יומי').trim(),
    hint: String(q.hint || 'פרק את השאלה לנתונים ולפעולה החשבונאית הנדרשת.').trim(),
    coreConcept: String(q.coreConcept || 'זיהוי חובה וזכות או שלבי החישוב').trim(),
    isCompleted: Boolean(q.isCompleted),
    chatHistory: Array.isArray(q.chatHistory) ? q.chatHistory : []
  }));

  const newCard = {
    id: cardId,
    createdAt: (cardData && cardData.createdAt) || now.toISOString(),
    dateLabel: (cardData && cardData.dateLabel) || now.toLocaleDateString('he-IL'),
    title: String((cardData && cardData.title) || `יחידת תרגול יומית (${now.toLocaleDateString('he-IL')})`).trim(),
    sourceType: (cardData && cardData.sourceType === 'pdf_or_image') ? 'pdf_or_image' : 'pasted_text',
    introAndRules: Array.isArray(cardData && cardData.introAndRules) && cardData.introAndRules.length > 0
      ? cardData.introAndRules
      : [
          'קוראים כל שאלה בנחת ומסמנים קודם כל את הסכומים והנתונים.',
          'שואלים: מה נכנס לעסק (חובה) ומה יצא או נוצר כמקור (זכות)?',
          'פותרים שלב אחר שלב ובודקים שסך החובה שווה לסך הזכות.'
        ],
    questions: normalizedQuestions,
    isNew: cardData && typeof cardData.isNew === 'boolean' ? cardData.isNew : true,
    isCompleted: Boolean(cardData && cardData.isCompleted),
    linkedExamId: (cardData && cardData.linkedExamId) || null
  };

  appState.studyHelp.dailyCards.push(newCard);
  appState.studyHelp.activeCardId = newCard.id;
  saveAppState();
  return newCard;
}

function getOrCreateStudySession(subject) {
  if (!appState.studyHelp || typeof appState.studyHelp !== 'object') {
    appState.studyHelp = { sessions: [], activeSessionId: null, savedNotes: [], totalQuestionsAsked: 0 };
  }
  const cleanSubject = (subject || '').trim();
  if (!cleanSubject && appState.studyHelp.activeSessionId) {
    const existing = appState.studyHelp.sessions.find(s => s.id === appState.studyHelp.activeSessionId);
    if (existing) return existing;
  }
  if (cleanSubject && appState.studyHelp.activeSessionId) {
    const active = appState.studyHelp.sessions.find(s => s.id === appState.studyHelp.activeSessionId);
    if (active && active.subject === cleanSubject) return active;
  }
  const now = new Date().toISOString();
  const newSession = {
    id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: cleanSubject ? `עזרה בלימודים: ${cleanSubject}` : 'מפגש עזרה בלימודים',
    subject: cleanSubject || 'כללי',
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  appState.studyHelp.sessions.unshift(newSession);
  appState.studyHelp.activeSessionId = newSession.id;
  saveAppState();
  return newSession;
}

function saveStudyMessage(sessionId, role, text, meta) {
  if (!appState.studyHelp || typeof appState.studyHelp !== 'object') {
    appState.studyHelp = { sessions: [], activeSessionId: null, savedNotes: [], totalQuestionsAsked: 0 };
  }
  let session = appState.studyHelp.sessions.find(s => s.id === sessionId);
  if (!session) {
    session = getOrCreateStudySession(meta && meta.subject ? meta.subject : 'כללי');
  }
  const now = new Date().toISOString();
  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role: role || 'user',
    text: text || '',
    meta: meta || {},
    timestamp: now
  };
  if (!Array.isArray(session.messages)) session.messages = [];
  session.messages.push(message);
  session.updatedAt = now;
  if (role === 'user') {
    appState.studyHelp.totalQuestionsAsked = (Number(appState.studyHelp.totalQuestionsAsked) || 0) + 1;
  }
  appState.studyHelp.activeSessionId = session.id;
  saveAppState();
  return message;
}

function saveAccountingExamState(examObj) {
  if (!appState.accountingExam || typeof appState.accountingExam !== 'object') {
    appState.accountingExam = { attempts: [], activeExam: null, bestScore: 0, lastAttemptAt: null };
  }
  appState.accountingExam.activeExam = examObj || null;
  saveAppState();
  return appState.accountingExam.activeExam;
}

function recordAccountingExamAttempt(completedExam) {
  if (!appState.accountingExam || typeof appState.accountingExam !== 'object') {
    appState.accountingExam = { attempts: [], activeExam: null, bestScore: 0, lastAttemptAt: null, isPassed: false };
  }
  const now = (completedExam && completedExam.completedAt) || new Date().toISOString();
  const score = Number(completedExam && completedExam.score) || 0;
  const attemptRecord = {
    ...(completedExam || {}),
    id: (completedExam && completedExam.id) || `exam_${Date.now()}`,
    score,
    status: 'submitted',
    completedAt: now
  };
  if (!Array.isArray(appState.accountingExam.attempts)) {
    appState.accountingExam.attempts = [];
  }
  appState.accountingExam.attempts.unshift(attemptRecord);
  appState.accountingExam.bestScore = Math.max(Number(appState.accountingExam.bestScore) || 0, score);
  appState.accountingExam.isPassed = appState.accountingExam.bestScore >= 80 || !!(completedExam && completedExam.passed);
  appState.accountingExam.lastAttemptAt = now;
  appState.accountingExam.activeExam = null;
  saveAppState();
  return attemptRecord;
}

function saveHomeworkSummaryExam(examObj) {
  if (!appState.accountingExam || typeof appState.accountingExam !== 'object') {
    appState.accountingExam = { attempts: [], activeExam: null, bestScore: 0, lastAttemptAt: null, homeworkExams: [] };
  }
  if (!Array.isArray(appState.accountingExam.homeworkExams)) {
    appState.accountingExam.homeworkExams = [];
  }
  const existingIdx = appState.accountingExam.homeworkExams.findIndex(
    e => e.id === examObj.id || (examObj.sourceCardId && e.sourceCardId === examObj.sourceCardId)
  );
  if (existingIdx >= 0) {
    appState.accountingExam.homeworkExams[existingIdx] = {
      ...appState.accountingExam.homeworkExams[existingIdx],
      ...examObj
    };
    saveAppState();
    return appState.accountingExam.homeworkExams[existingIdx];
  }
  appState.accountingExam.homeworkExams.push(examObj);
  saveAppState();
  return examObj;
}

// ============================================================================
// 2c. מחיקה ועריכה אוניברסלית של יחידות בכל המסלולים (CRUD Across All Tracks)
// ============================================================================

function escapeStoreHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findUnitAcrossTracks(trackId, unitId) {
  const normTrack = String(trackId || 'general').trim();
  const uid = String(unitId || '').trim();
  if (!uid) return null;

  if (normTrack === 'general') {
    const generalTrack = TRACKS.find(t => t.id === 'general') || TRACKS[0];
    return (appState.curriculumUnits || []).find(u => String(u.id || u.unit_id) === uid) ||
      getTrackUnits(generalTrack).find(u => String(u.id || u.unit_id) === uid) ||
      null;
  }

  if (normTrack === 'accounting') {
    const accTrack = TRACKS.find(t => t.id === 'accounting') || TRACKS[1];
    return getTrackUnits(accTrack).find(u => String(u.id || u.unit_id) === uid) || null;
  }

  if (normTrack === 'study_help') {
    return (appState.studyHelpUnits || []).find(u => String(u.id || u.unit_id) === uid) ||
      (appState.studyHelp?.dailyCards || []).find(c => String(c.id || c.unit_id) === uid) ||
      null;
  }

  if (normTrack === 'summary_exam') {
    return (appState.accountingSummaryExams || []).find(e => String(e.unit_id || e.id) === uid) ||
      (appState.accountingExam?.homeworkExams || []).find(e => String(e.unit_id || e.id) === uid) ||
      null;
  }

  return null;
}

/**
 * מוחק יחידה מכל מסלול (general, accounting, study_help, summary_exam) עם אישור ברור,
 * שמירה קבועה ב-deletedUnitIds ליחידות בסיס, וסנכרון מלא מול DatabaseManager.
 * @param {string} trackId
 * @param {string} unitId
 * @returns {boolean}
 */
function deleteUnitFromAnyTrack(trackId, unitId) {
  const normTrack = String(trackId || 'general').trim();
  const uid = String(unitId || '').trim();
  if (!uid) return false;

  const found = findUnitAcrossTracks(normTrack, uid);
  const unitTitle = (found && (found.lesson_title || found.title)) || uid;

  if (typeof confirm === 'function') {
    const approved = confirm(`האם אתה בטוח שברצונך למחוק את היחידה "${unitTitle}"?`);
    if (!approved) return false;
  }

  if (normTrack === 'general' || normTrack === 'accounting') {
    if (!Array.isArray(appState.deletedUnitIds)) {
      appState.deletedUnitIds = [];
    }
    if (!appState.deletedUnitIds.includes(uid)) {
      appState.deletedUnitIds.push(uid);
    }
    if (normTrack === 'general' && Array.isArray(appState.curriculumUnits)) {
      appState.curriculumUnits = appState.curriculumUnits.filter(
        u => String(u.id || u.unit_id) !== uid
      );
    }
    if (normTrack === 'accounting' && typeof window !== 'undefined' && Array.isArray(window._RAW_ACCOUNTING_CURRICULUM)) {
      window.ACCOUNTING_CURRICULUM = applyUnitDeletionsAndOverrides(window._RAW_ACCOUNTING_CURRICULUM);
    }
  } else if (normTrack === 'study_help') {
    if (Array.isArray(appState.studyHelpUnits)) {
      appState.studyHelpUnits = appState.studyHelpUnits.filter(
        u => String(u.id || u.unit_id) !== uid
      );
    }
    if (appState.studyHelp && Array.isArray(appState.studyHelp.dailyCards)) {
      appState.studyHelp.dailyCards = appState.studyHelp.dailyCards.filter(
        c => String(c.id || c.unit_id) !== uid
      );
    }
    if (appState.trackProgress && Array.isArray(appState.trackProgress.study_help)) {
      appState.trackProgress.study_help = appState.trackProgress.study_help.filter(
        id => String(id) !== uid
      );
    }
  } else if (normTrack === 'summary_exam') {
    if (Array.isArray(appState.accountingSummaryExams)) {
      appState.accountingSummaryExams = appState.accountingSummaryExams.filter(
        e => String(e.unit_id || e.id) !== uid
      );
    }
    if (appState.accountingExam && Array.isArray(appState.accountingExam.homeworkExams)) {
      appState.accountingExam.homeworkExams = appState.accountingExam.homeworkExams.filter(
        e => String(e.unit_id || e.id) !== uid
      );
    }
    if (Array.isArray(appState.studyHelpUnits)) {
      appState.studyHelpUnits.forEach(u => {
        if (u && String(u.summaryExamId) === uid) {
          u.summaryExamId = null;
        }
      });
    }
  }

  saveAppState();

  const dm = bridgeDatabaseManager();
  if (dm && typeof dm.delete === 'function') {
    dm.delete(normTrack, uid).catch(err => {
      console.warn('[Store] DatabaseManager.delete warning:', err);
    });
  }

  if (typeof renderRoadmap === 'function') renderRoadmap();
  if (typeof renderAdminCurriculum === 'function') renderAdminCurriculum();
  if (typeof renderAdminOverview === 'function') renderAdminOverview();

  if (typeof showToast === 'function') {
    showToast(`היחידה "${unitTitle}" נמחקה בהצלחה 🗑️`, 'success');
  }

  return true;
}

/**
 * משחזר בלחיצה אחת את כל יחידות הבסיס שנמחקו (ממסלול 1 וממסלול 2).
 * @returns {number} מספר היחידות ששוחזרו
 */
function restoreDeletedBaseUnits() {
  const restoredCount = Array.isArray(appState.deletedUnitIds) ? appState.deletedUnitIds.length : 0;
  appState.deletedUnitIds = [];
  saveAppState({ skipCloudSync: true });
  performSmartMergeAndMigration({ skipCloudSync: false });
  saveAppState();

  if (typeof renderRoadmap === 'function') renderRoadmap();
  if (typeof renderAdminCurriculum === 'function') renderAdminCurriculum();
  if (typeof renderAdminOverview === 'function') renderAdminOverview();

  if (typeof showToast === 'function') {
    showToast(
      restoredCount > 0
        ? `שוחזרו בהצלחה ${restoredCount} יחידות בסיס למסלולים! ♻️`
        : 'כל יחידות הבסיס כבר פעילות במסלולים ♻️',
      'success'
    );
  }
  return restoredCount;
}

/**
 * פותח חלון עריכה אוניברסלי מהיר ונוח ליחידה מכל מסלול:
 * - עריכת כותרת ותקציר/מטרה/תיאור לכל המסלולים (נשמר ב-unitOverrides ליחידות בסיס).
 * - במסלול 3 (study_help): עריכה או מחיקה פרטנית של מושגים ושאלות בתוך היחידה.
 * - במבחנים מסכמים (summary_exam): עריכה או הסרה של שאלות ומשימות בתוך המבחן.
 * @param {string} trackId
 * @param {string} unitId
 */
function openUniversalUnitQuickEditor(trackId, unitId) {
  if (typeof document === 'undefined' || !document.body) return;

  const normTrack = String(trackId || 'general').trim();
  const uid = String(unitId || '').trim();
  const unit = findUnitAcrossTracks(normTrack, uid);

  if (!unit) {
    if (typeof showToast === 'function') {
      showToast('לא נמצאה היחידה המבוקשת לעריכה.', 'warning');
    }
    return;
  }

  const existingModal = document.getElementById('universal-unit-quick-editor-modal');
  if (existingModal) existingModal.remove();

  const trackLabelMap = {
    general: '🤖 מסלול 1: כללי ו-AI',
    accounting: '📊 מסלול 2: הנהלת חשבונות',
    study_help: '📚 מסלול 3: עזרה בלימודים',
    summary_exam: '🏆 מבחן מסכם בהנהלת חשבונות'
  };

  const summaryFieldLabelMap = {
    general: 'מטרת היחידה (Goal):',
    accounting: 'תיאור / תקציר פתיחה ליחידה:',
    study_help: 'תקציר עמודי השיעור וההקדמה (Pages Summary):',
    summary_exam: 'תיאור והנחיית פתיחה למבחן:'
  };

  const leadBlock = Array.isArray(unit.blocks) ? unit.blocks.find(b => b && b.type === 'text') : null;
  let draftTitle = String(unit.lesson_title || unit.title || '').trim();
  let draftSummary = String(
    (normTrack === 'general' ? unit.goal : '') ||
    unit.pages_summary ||
    unit.description ||
    unit.topic_summary ||
    unit.introText ||
    (leadBlock ? leadBlock.content : '') ||
    unit.goal ||
    ''
  ).trim();
  let draftCategory = String(unit.category || '').trim();

  // Working copies for Track 3 concepts & questions
  let draftConcepts = normTrack === 'study_help' && Array.isArray(unit.concepts)
    ? unit.concepts.map(c => ({ ...c }))
    : [];

  let draftQuestions = normTrack === 'study_help' && Array.isArray(unit.questions)
    ? unit.questions.map((q, origIdx) => ({
        ...q,
        _origIdx: origIdx
      }))
    : [];

  // Working copy for Summary Exam blocks
  let draftBlocks = normTrack === 'summary_exam' && Array.isArray(unit.blocks)
    ? unit.blocks.map(b => ({ ...b }))
    : [];

  const modal = document.createElement('div');
  modal.id = 'universal-unit-quick-editor-modal';
  modal.className = 'modal-overlay active';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'display: flex; z-index: 9999; padding: 1rem;';

  const syncTopFieldsFromDom = () => {
    const tEl = modal.querySelector('#uqe-title-input');
    const sEl = modal.querySelector('#uqe-summary-input');
    const cEl = modal.querySelector('#uqe-category-input');
    if (tEl) draftTitle = tEl.value;
    if (sEl) draftSummary = sEl.value;
    if (cEl) draftCategory = cEl.value;

    if (normTrack === 'study_help') {
      modal.querySelectorAll('.uqe-concept-row').forEach(row => {
        const idx = Number(row.getAttribute('data-c-idx'));
        if (draftConcepts[idx]) {
          const nameInp = row.querySelector('.uqe-concept-name');
          const expInp = row.querySelector('.uqe-concept-exp');
          if (nameInp) draftConcepts[idx].term_name = nameInp.value;
          if (expInp) draftConcepts[idx].simple_explanation = expInp.value;
        }
      });

      modal.querySelectorAll('.uqe-question-row').forEach(row => {
        const idx = Number(row.getAttribute('data-q-idx'));
        if (draftQuestions[idx]) {
          const lblInp = row.querySelector('.uqe-q-label');
          const txtInp = row.querySelector('.uqe-q-text');
          const transInp = row.querySelector('.uqe-q-trans');
          if (lblInp) draftQuestions[idx].question_number_label = lblInp.value;
          if (txtInp) {
            draftQuestions[idx].exact_book_text = txtInp.value;
            draftQuestions[idx].original_question = txtInp.value;
            draftQuestions[idx].questionText = txtInp.value;
          }
          if (transInp) {
            draftQuestions[idx].friendly_translation = transInp.value;
            draftQuestions[idx].topic_focus = transInp.value;
            draftQuestions[idx].topic = transInp.value;
          }
        }
      });
    }

    if (normTrack === 'summary_exam') {
      modal.querySelectorAll('.uqe-exam-block-row').forEach(row => {
        const bIdx = Number(row.getAttribute('data-b-idx'));
        const blk = draftBlocks[bIdx];
        const inp = row.querySelector('.uqe-exam-block-prompt');
        if (blk && inp) {
          const val = inp.value;
          if (blk.type === 'exercise' || blk.type === 'ai_eval_qa') {
            blk.question = val;
          } else if (blk.type === 'spreadsheet_task') {
            blk.action_prompt = val;
          } else if (blk.type === 'journal_grid') {
            blk.scenario = val;
          }
        }
      });
    }
  };

  const renderModalContent = () => {
    const conceptsSectionHtml = normTrack === 'study_help' ? `
      <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1.5px solid #e2e8f0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
          <strong style="color: #166534; font-size: 1rem;">💡 מושגים בשלב 1 (${draftConcepts.length}):</strong>
          <button type="button" id="uqe-add-concept-btn" class="secondary-btn" style="padding: 0.3rem 0.75rem; font-size: 0.85rem;">➕ הוסף מושג</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          ${draftConcepts.length === 0 ? `<p style="margin:0; color:#64748b; font-size:0.9rem;">אין מושגים ביחידה זו.</p>` : draftConcepts.map((c, idx) => `
            <div class="uqe-concept-row" data-c-idx="${idx}" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.7rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.45rem;">
                <input type="text" class="styled-input uqe-concept-name" value="${escapeStoreHtml(c.term_name || '')}" placeholder="שם המושג" style="font-weight: 700; flex: 1;">
                <button type="button" class="secondary-btn uqe-del-concept-btn" data-c-idx="${idx}" style="padding: 0.35rem 0.65rem; font-size: 0.82rem; color: #dc2626;">🗑️ הסר</button>
              </div>
              <textarea class="styled-textarea uqe-concept-exp" rows="2" placeholder="הסבר פשוט בגובה העיניים...">${escapeStoreHtml(c.simple_explanation || '')}</textarea>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const questionsSectionHtml = normTrack === 'study_help' ? `
      <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1.5px solid #e2e8f0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
          <strong style="color: #1e40af; font-size: 1rem;">📝 שאלות התרגול בשלב 2 (${draftQuestions.length}):</strong>
          <button type="button" id="uqe-add-question-btn" class="secondary-btn" style="padding: 0.3rem 0.75rem; font-size: 0.85rem;">➕ הוסף שאלה</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${draftQuestions.length === 0 ? `<p style="margin:0; color:#64748b; font-size:0.9rem;">אין שאלות ביחידה זו.</p>` : draftQuestions.map((q, idx) => `
            <div class="uqe-question-row" data-q-idx="${idx}" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.45rem;">
                <input type="text" class="styled-input uqe-q-label" value="${escapeStoreHtml(q.question_number_label || `שאלה ${idx + 1}`)}" placeholder="תווית שאלה" style="max-width: 220px; font-weight: 700;">
                <button type="button" class="secondary-btn uqe-del-question-btn" data-q-idx="${idx}" style="padding: 0.35rem 0.65rem; font-size: 0.82rem; color: #dc2626;">🗑️ מחק שאלה</button>
              </div>
              <textarea class="styled-textarea uqe-q-text" rows="2" placeholder="נוסח השאלה המלא..." style="margin-bottom: 0.4rem;">${escapeStoreHtml(q.exact_book_text || q.original_question || q.questionText || '')}</textarea>
              <input type="text" class="styled-input uqe-q-trans" value="${escapeStoreHtml(q.friendly_translation || '')}" placeholder="תרגום / הסבר מונגש לדניאל (אופציונלי)">
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const examBlocksSectionHtml = normTrack === 'summary_exam' ? (() => {
      const editableTypes = ['spreadsheet_task', 'journal_grid', 'exercise', 'ai_eval_qa'];
      const typeBadges = {
        spreadsheet_task: '🧮 משימת חישוב וטבלה',
        journal_grid: '📒 פקודת יומן',
        exercise: '☑️ שאלה אמריקאית',
        ai_eval_qa: '💬 שאלת הבנה פתוחה'
      };
      const itemsHtml = draftBlocks
        .map((blk, bIdx) => ({ blk, bIdx }))
        .filter(({ blk }) => blk && editableTypes.includes(blk.type))
        .map(({ blk, bIdx }, displayIdx) => {
          const promptVal = blk.type === 'spreadsheet_task'
            ? (blk.action_prompt || blk.instructions || '')
            : blk.type === 'journal_grid'
              ? (blk.scenario || blk.title || '')
              : (blk.question || '');
          return `
            <div class="uqe-exam-block-row" data-b-idx="${bIdx}" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.45rem;">
                <span class="badge-tag" style="background: #fef3c7; color: #b45309; font-weight: 700;">#${displayIdx + 1} • ${typeBadges[blk.type] || blk.type}</span>
                <button type="button" class="secondary-btn uqe-del-exam-block-btn" data-b-idx="${bIdx}" style="padding: 0.3rem 0.65rem; font-size: 0.82rem; color: #dc2626;">🗑️ הסר שאלה</button>
              </div>
              <textarea class="styled-textarea uqe-exam-block-prompt" rows="2">${escapeStoreHtml(promptVal)}</textarea>
            </div>
          `;
        })
        .join('');

      return `
        <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1.5px solid #e2e8f0;">
          <strong style="display: block; color: #92400e; font-size: 1rem; margin-bottom: 0.65rem;">🏆 שאלות ומשימות במבחן המסכם:</strong>
          <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            ${itemsHtml || '<p style="margin:0; color:#64748b; font-size:0.9rem;">אין שאלות לעריכה במבחן זה.</p>'}
          </div>
        </div>
      `;
    })() : '';

    modal.innerHTML = `
      <div class="modal-card" dir="rtl" style="max-width: 760px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; text-align: right;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
          <div>
            <span class="badge-tag" style="margin-bottom: 0.25rem; display: inline-block;">${trackLabelMap[normTrack] || normTrack}</span>
            <h3 class="modal-title" style="margin: 0;">✏️ עריכת יחידה: ${escapeStoreHtml(draftTitle)}</h3>
          </div>
          <button type="button" id="uqe-close-btn" class="modal-close-btn" aria-label="סגור">✕</button>
        </div>

        <div class="modal-body" style="overflow-y: auto; padding: 1.1rem 1.25rem; flex: 1;">
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            <div>
              <label for="uqe-title-input" style="display: block; font-weight: 700; margin-bottom: 0.3rem;">כותרת היחידה:</label>
              <input type="text" id="uqe-title-input" class="styled-input" style="width: 100%; font-weight: 700;" value="${escapeStoreHtml(draftTitle)}">
            </div>

            ${normTrack === 'general' ? `
              <div>
                <label for="uqe-category-input" style="display: block; font-weight: 700; margin-bottom: 0.3rem;">קטגוריה:</label>
                <input type="text" id="uqe-category-input" class="styled-input" style="width: 100%;" value="${escapeStoreHtml(draftCategory)}">
              </div>
            ` : ''}

            <div>
              <label for="uqe-summary-input" style="display: block; font-weight: 700; margin-bottom: 0.3rem;">${summaryFieldLabelMap[normTrack] || 'תקציר היחידה:'}</label>
              <textarea id="uqe-summary-input" class="styled-textarea" rows="3" style="width: 100%;">${escapeStoreHtml(draftSummary)}</textarea>
            </div>
          </div>

          ${conceptsSectionHtml}
          ${questionsSectionHtml}
          ${examBlocksSectionHtml}
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding-top: 0.9rem;">
          <button type="button" id="uqe-cancel-btn" class="secondary-btn">ביטול</button>
          <button type="button" id="uqe-save-btn" class="primary-btn">💾 שמור שינויים ביחידה</button>
        </div>
      </div>
    `;

    const closeModal = () => modal.remove();
    const closeBtn = modal.querySelector('#uqe-close-btn');
    const cancelBtn = modal.querySelector('#uqe-cancel-btn');
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    const addConceptBtn = modal.querySelector('#uqe-add-concept-btn');
    if (addConceptBtn) {
      addConceptBtn.onclick = () => {
        syncTopFieldsFromDom();
        const nextNum = draftConcepts.length + 1;
        draftConcepts.push({
          id: `${uid}_c_${Date.now()}`,
          index: nextNum,
          term_name: `מושג חדש ${nextNum}`,
          page_number: 1,
          simple_explanation: '',
          textbook_example: '',
          mfa_step1_question: 'מה הרעיון המרכזי במושג זה?',
          mfa_step1_options: ['יישום הכלל לפי ההסבר בשיעור', 'ניחוש ללא בדיקה'],
          mfa_step1_correct_index: 0,
          mfa_step2_why_question: 'למה חשוב להקפיד על כלל זה?',
          mfa_step2_options: ['כדי להבטיח פתרון מדויק ונכון', 'אין צורך להקפיד'],
          mfa_step2_correct_index: 0,
          check1Passed: false,
          mastered: false
        });
        renderModalContent();
      };
    }

    modal.querySelectorAll('.uqe-del-concept-btn').forEach(btn => {
      btn.onclick = () => {
        syncTopFieldsFromDom();
        const cIdx = Number(btn.getAttribute('data-c-idx'));
        draftConcepts.splice(cIdx, 1);
        renderModalContent();
      };
    });

    const addQuestionBtn = modal.querySelector('#uqe-add-question-btn');
    if (addQuestionBtn) {
      addQuestionBtn.onclick = () => {
        syncTopFieldsFromDom();
        const nextNum = draftQuestions.length + 1;
        draftQuestions.push({
          id: `${uid}_q_${Date.now()}`,
          index: nextNum,
          page_number: 1,
          question_number_label: `שאלה ${nextNum}`,
          question_type: 'open_question',
          exact_book_text: '',
          original_question: '',
          questionText: '',
          friendly_translation: '',
          step_by_step_guide: ['קריאת נתוני השאלה', 'רישום הפתרון ובדיקתו'],
          hint: 'היעזר בכללים משלב 1.',
          expected_answer_summary: '',
          isCompleted: false,
          chatHistory: [],
          _origIdx: -1
        });
        renderModalContent();
      };
    }

    modal.querySelectorAll('.uqe-del-question-btn').forEach(btn => {
      btn.onclick = () => {
        syncTopFieldsFromDom();
        const qIdx = Number(btn.getAttribute('data-q-idx'));
        draftQuestions.splice(qIdx, 1);
        renderModalContent();
      };
    });

    modal.querySelectorAll('.uqe-del-exam-block-btn').forEach(btn => {
      btn.onclick = () => {
        syncTopFieldsFromDom();
        const bIdx = Number(btn.getAttribute('data-b-idx'));
        draftBlocks.splice(bIdx, 1);
        renderModalContent();
      };
    });

    const saveBtn = modal.querySelector('#uqe-save-btn');
    if (saveBtn) {
      saveBtn.onclick = () => {
        syncTopFieldsFromDom();
        const cleanTitle = String(draftTitle || '').trim();
        if (!cleanTitle) {
          if (typeof showToast === 'function') showToast('נא להזין כותרת ליחידה.', 'warning');
          return;
        }
        const cleanSummary = String(draftSummary || '').trim();
        const cleanCat = String(draftCategory || '').trim();

        if (!appState.unitOverrides || typeof appState.unitOverrides !== 'object') {
          appState.unitOverrides = {};
        }

        if (normTrack === 'general') {
          const patch = {
            title: cleanTitle,
            goal: cleanSummary,
            ...(cleanCat ? { category: cleanCat } : {})
          };
          appState.unitOverrides[uid] = {
            ...(appState.unitOverrides[uid] || {}),
            ...patch
          };
          if (Array.isArray(appState.curriculumUnits)) {
            const idx = appState.curriculumUnits.findIndex(u => String(u.id || u.unit_id) === uid);
            if (idx !== -1) {
              appState.curriculumUnits[idx] = { ...appState.curriculumUnits[idx], ...patch };
            }
          }
        } else if (normTrack === 'accounting') {
          const patch = {
            title: cleanTitle,
            description: cleanSummary,
            pages_summary: cleanSummary
          };
          appState.unitOverrides[uid] = {
            ...(appState.unitOverrides[uid] || {}),
            ...patch
          };
          if (typeof window !== 'undefined' && Array.isArray(window._RAW_ACCOUNTING_CURRICULUM)) {
            window.ACCOUNTING_CURRICULUM = applyUnitDeletionsAndOverrides(window._RAW_ACCOUNTING_CURRICULUM);
          }
        } else if (normTrack === 'study_help') {
          const applyStudyHelpEdits = (targetObj) => {
            if (!targetObj) return;
            const prevSolved = Array.isArray(targetObj.solvedQuestions) ? targetObj.solvedQuestions : [];
            const prevChats = Array.isArray(targetObj.chatHistory) ? targetObj.chatHistory : [];

            const nextConcepts = draftConcepts.map((c, idx) => ({
              ...c,
              index: idx + 1,
              term_name: String(c.term_name || `מושג ${idx + 1}`).trim(),
              simple_explanation: String(c.simple_explanation || '').trim()
            }));

            const nextSolved = [];
            const nextChats = [];
            const nextQuestions = draftQuestions.map((q, idx) => {
              const origIdx = typeof q._origIdx === 'number' ? q._origIdx : -1;
              nextSolved.push(origIdx >= 0 ? Boolean(prevSolved[origIdx]) : Boolean(q.isCompleted));
              nextChats.push(origIdx >= 0 && Array.isArray(prevChats[origIdx]) ? prevChats[origIdx] : []);
              const copy = { ...q, index: idx + 1 };
              delete copy._origIdx;
              return copy;
            });

            targetObj.title = cleanTitle;
            targetObj.lesson_title = cleanTitle;
            targetObj.pages_summary = cleanSummary;
            targetObj.introText = cleanSummary;
            targetObj.topic_summary = cleanSummary;
            targetObj.concepts = nextConcepts;
            targetObj.questions = nextQuestions;
            targetObj.solvedQuestions = nextSolved;
            targetObj.chatHistory = nextChats;
            targetObj.currentConceptIdx = Math.min(
              Math.max(0, Number(targetObj.currentConceptIdx) || 0),
              Math.max(0, nextConcepts.length - 1)
            );
            targetObj.currentQuestionIdx = Math.min(
              Math.max(0, Number(targetObj.currentQuestionIdx) || 0),
              Math.max(0, nextQuestions.length - 1)
            );
          };

          const shUnit = (appState.studyHelpUnits || []).find(u => String(u.id || u.unit_id) === uid);
          const dailyCard = (appState.studyHelp?.dailyCards || []).find(c => String(c.id || c.unit_id) === uid);
          applyStudyHelpEdits(shUnit);
          if (dailyCard && dailyCard !== shUnit) {
            applyStudyHelpEdits(dailyCard);
          }
        } else if (normTrack === 'summary_exam') {
          const applyExamEdits = (examObj) => {
            if (!examObj) return;
            examObj.title = cleanTitle;
            examObj.description = cleanSummary;
            let updatedLead = false;
            examObj.blocks = draftBlocks.map(b => {
              if (!updatedLead && b && b.type === 'text' && cleanSummary) {
                updatedLead = true;
                return { ...b, content: cleanSummary };
              }
              return b;
            });
          };

          const ex1 = (appState.accountingSummaryExams || []).find(e => String(e.unit_id || e.id) === uid);
          const ex2 = (appState.accountingExam?.homeworkExams || []).find(e => String(e.unit_id || e.id) === uid);
          applyExamEdits(ex1);
          if (ex2 && ex2 !== ex1) applyExamEdits(ex2);
        }

        saveAppState();
        closeModal();

        if (typeof renderRoadmap === 'function') renderRoadmap();
        if (typeof renderAdminCurriculum === 'function') renderAdminCurriculum();
        if (typeof renderAdminOverview === 'function') renderAdminOverview();
        if (appState.currentView === 'unit' && String(appState.activeUnitId) === uid) {
          if (normTrack === 'study_help' && typeof openStudyHelpUnit === 'function') {
            openStudyHelpUnit(uid);
          } else if (typeof renderUnitPlayer === 'function') {
            renderUnitPlayer(uid);
          }
        }

        if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
          SoundService.playSuccessSound();
        }
        if (typeof showToast === 'function') {
          showToast(`השינויים ביחידה "${cleanTitle}" נשמרו בהצלחה! ✏️`, 'success');
        }
      };
    }
  };

  renderModalContent();
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  document.body.appendChild(modal);
}

if (typeof window !== 'undefined') {
  window.deleteUnitFromAnyTrack = deleteUnitFromAnyTrack;
  window.openUniversalUnitQuickEditor = openUniversalUnitQuickEditor;
  window.restoreDeletedBaseUnits = restoreDeletedBaseUnits;
}


