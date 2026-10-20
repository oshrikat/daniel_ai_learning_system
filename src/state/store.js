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
 * שליפת יחידות הלימוד עבור מסלול מסוים (כולל סטטוס השלמה)
 * @param {object} [track]
 * @returns {Array}
 */
function getTrackUnits(track) {
  if (!track) track = getActiveTrack();
  if (track.engine === 'legacy') {
    return appState.curriculumUnits || [];
  }
  if (!track.dataVar) {
    return [];
  }
  let raw = [];
  if (typeof window !== 'undefined' && window[track.dataVar]) {
    raw = window[track.dataVar];
  } else if (track.dataVar === 'ACCOUNTING_CURRICULUM' && typeof ACCOUNTING_CURRICULUM !== 'undefined') {
    raw = ACCOUNTING_CURRICULUM;
  }
  const completedList = (appState.trackProgress && appState.trackProgress[track.id]) || [];
  return raw.map(u => {
    const uid = u.unit_id || u.id;
    return {
      ...u,
      id: uid,
      isCompleted: completedList.includes(uid)
    };
  });
}

let appState = {
  version: 3,
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
  trackProgress: {
    general: [],
    accounting: [],
    study_help: []
  },
  studyHelpUnits: [],
  accountingSummaryExams: [],
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
// 2. מנגנון Preserve & Merge חכם (סנכרון Git ללא דריסת היסטוריה מקומית)
// ============================================================================

function performSmartMergeAndMigration() {
  try {
    const rawV3 = localStorage.getItem(STORAGE_KEY);
    const baseUnits = getBaseCurriculum();
    const baseCPs = getBaseCheckpoints();
    const baseClusters = getBaseClusters();

    appState.clusters = baseClusters;

    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (parsed && typeof parsed === 'object') {
        if (parsed.activeTrackId) appState.activeTrackId = parsed.activeTrackId;
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
          if (completedMap.has(unit.id)) {
            const saved = completedMap.get(unit.id);
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

        saveAppState();
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
    appState.trackProgress = appState.trackProgress || { general: [], accounting: [], study_help: [] };
    appState.trackProgress.study_help = appState.trackProgress.study_help || [];
    appState.studyHelpUnits = Array.isArray(appState.studyHelpUnits) ? appState.studyHelpUnits : [];
    appState.accountingSummaryExams = Array.isArray(appState.accountingSummaryExams) ? appState.accountingSummaryExams : [];
  } catch (err) {
    console.error('Critical error in smart merge and migration:', err);
  }
}

function saveAppState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
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


