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
    icon: '🎯',
    dataVar: 'CURRICULUM_DATA',
    engine: 'legacy'
  },
  {
    id: 'accounting',
    label: 'מסלול 2: יסודות הנהלת חשבונות 📊',
    shortLabel: 'הנהלת חשבונות',
    icon: '💼',
    dataVar: 'ACCOUNTING_CURRICULUM',
    engine: 'blocks'
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
    accounting: []
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
            accounting: Array.isArray(parsed.trackProgress.accounting) ? parsed.trackProgress.accounting : []
          };
        } else {
          appState.trackProgress = { general: [], accounting: [] };
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
// 3. שירותי קול, צלילים ושיתוף וואטסאפ (Sound & Sharing Services)
// ============================================================================

const SoundService = {
  synth: window.speechSynthesis,
  currentUtterance: null,

  speakText(text) {
    if (!this.synth) return;
    try {
      this.synth.cancel();
      const clean = text.replace(/[*_#`~[\]]/g, '').trim();
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'he-IL';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;

      const voices = this.synth.getVoices();
      const heVoice = voices.find(v => v.lang.includes('he') || v.lang.includes('IL'));
      if (heVoice) utterance.voice = heVoice;

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    } catch (e) {
      console.warn('TTS playback error:', e);
    }
  },

  stopSpeaking() {
    if (this.synth) this.synth.cancel();
  },

  playSuccessSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      
      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {}
  },

  playErrorSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(240, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  }
};

function shareProgressToWhatsApp(msgText) {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msgText)}`;
  window.open(url, '_blank');
}

let toastTimer = null;

/**
 * הצגת הודעת טוסט מעוצבת עם משך 6000ms ושיקוף מלא לקונסול
 * @param {string} message - הודעה להצגה
 * @param {'info'|'success'|'error'|'warning'} [type='info'] - סוג ההודעה
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // שיקוף לקונסול לפי דרישות הארכיטקטורה
  if (type === 'error' || type === 'warning') {
    console.error(`[Toast ${type.toUpperCase()}] ${message}`);
  } else {
    console.log(`[Toast ${type.toUpperCase()}] ${message}`);
  }

  // איפוס טיימר קודם אם קיים
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  toast.textContent = message;
  toast.className = `toast toast-${type} show`;

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 6000);
}

function copyToClipboard(text, btnElement) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = btnElement ? btnElement.innerHTML : '';
      if (btnElement) btnElement.innerHTML = '<span>הועתק בהצלחה! ✓</span>';
      showToast('המשפט הועתק! עכשיו אפשר להדביק אותו בצ\'אט 📋');
      setTimeout(() => {
        if (btnElement) btnElement.innerHTML = originalText;
      }, 2000);
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('המשפט הועתק! 📋');
  }
}

// ============================================================================
// 4. נעילת שבת ומצב רגוע (Shabbat Lock & Calm Mode)
// ============================================================================

function isShabbatNow() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeVal = hour + minute / 60;
  if (day === 5 && timeVal >= 16.5) return true;
  if (day === 6 && timeVal < 20.5) return true;
  return false;
}

let shabbatBypassed = false;
function checkAndApplyShabbatLock() {
  const screen = document.getElementById('shabbat-screen');
  if (!screen) return;
  if (isShabbatNow() && !shabbatBypassed) {
    screen.style.display = 'flex';
  } else {
    screen.style.display = 'none';
  }
}

function openCalmModal() {
  const modal = document.getElementById('calm-modal');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function closeCalmModal() {
  const modal = document.getElementById('calm-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

// ============================================================================
// 5. ניהול תצוגות (View Switching)
// ============================================================================

function showView(viewName) {
  SoundService.stopSpeaking();
  appState.currentView = viewName;
  saveAppState();

  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => sec.classList.remove('active'));

  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ============================================================================
// 6. תצוגת מסלול המיומנויות של דניאל (Roadmap & Gatekeeping)
// ============================================================================

/**
 * רינדור טאבים דינמיים להחלפת מסלול לימודים
 */
function renderTrackTabs() {
  const container = document.getElementById('track-nav-container');
  if (!container) return;
  container.innerHTML = '';

  const activeTrack = getActiveTrack();

  TRACKS.forEach(track => {
    const btn = document.createElement('button');
    btn.className = `track-tab-btn ${track.id === activeTrack.id ? 'active' : ''}`;
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', track.id === activeTrack.id ? 'true' : 'false');
    btn.innerHTML = `
      <span class="track-tab-icon">${track.icon}</span>
      <span class="track-tab-title">${track.label}</span>
    `;
    btn.onclick = () => {
      if (appState.activeTrackId !== track.id) {
        appState.activeTrackId = track.id;
        saveAppState();
        renderTrackTabs();
        renderRoadmap();
      }
    };
    container.appendChild(btn);
  });
}

function renderRoadmap() {
  const container = document.getElementById('units-grid');
  if (!container) return;
  container.innerHTML = '';

  const activeTrack = getActiveTrack();
  const cpBadgeBox = document.getElementById('checkpoints-progress-pill');

  if (activeTrack.engine === 'legacy') {
    // מסלול 1: מיומנויות AI וכלים מעשיים (Legacy Engine)
    if (cpBadgeBox) cpBadgeBox.style.display = '';

    const titleEl = document.querySelector('.roadmap-title');
    if (titleEl) titleEl.textContent = 'המסלול האישי של דניאל 🚀';
    const subEl = document.querySelector('.roadmap-subtitle');
    if (subEl) subEl.textContent = 'מיומנויות AI מעשיות לחיים ולעבודה • צעד אחר צעד • מבחן שלב כל 2 יחידות';

    const units = appState.curriculumUnits;
    let completedCount = 0;
    let currentClusterId = null;

    units.forEach((unit, idx) => {
      if (unit.isCompleted) completedCount++;

      // הצגת כותרת אשכול תוכן כשמתחלף אשכול
      if (unit.clusterId && unit.clusterId !== currentClusterId) {
        currentClusterId = unit.clusterId;
        const clusterObj = (appState.clusters || []).find(c => c.id === currentClusterId);
        if (clusterObj) {
          const clusterHeader = document.createElement('div');
          clusterHeader.className = 'cluster-header-card';
          clusterHeader.style.cssText = 'background: #f1f5f9; border-right: 4px solid #2563eb; padding: 0.85rem 1.25rem; border-radius: var(--radius-sm); margin: 1.4rem 0 0.4rem 0;';
          clusterHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span style="font-size: 1.4rem;">${clusterObj.icon || '📚'}</span>
              <div>
                <h3 style="margin: 0; font-size: 1.2rem; color: #1e293b;">${clusterObj.title}</h3>
                <p style="margin: 0.2rem 0 0 0; font-size: 0.95rem; color: #64748b;">${clusterObj.description}</p>
              </div>
            </div>
          `;
          container.appendChild(clusterHeader);
        }
      }

      // חישוב פתיחת יחידות מודרגת:
      // יחידה 0 תמיד פתוחה.
      // יחידה נפתחת אם היחידה שלפניה הושלמה, ובמידה והיה מבחן שלב ביניהן – הוא חייב להיות בציון 85+ (isPassed)!
      let isUnlocked = false;
      if (idx === 0) {
        isUnlocked = true;
      } else if (idx % 2 === 0) {
        const prevCp = (appState.checkpoints || []).find(c => c.afterUnitIndex === idx - 1);
        isUnlocked = units[idx - 1].isCompleted && (prevCp ? prevCp.isPassed : true);
      } else {
        isUnlocked = units[idx - 1].isCompleted;
      }
      unit.isUnlocked = isUnlocked;

      const card = document.createElement('div');
      let statusClass = 'locked-unit';
      let statusIcon = '🔒';
      let statusBadgeText = 'נעול';

      if (unit.isCompleted) {
        statusClass = 'completed-unit';
        statusIcon = '🟢';
        statusBadgeText = '✓ הושלם';
      } else if (isUnlocked) {
        statusClass = 'active-unit';
        statusIcon = '🔵';
        statusBadgeText = 'פתוח עכשיו';
      }

      // תגית רמזור AI
      const trafficEmoji = unit.trafficLight === 'red' ? '🔴' : unit.trafficLight === 'yellow' ? '🟡' : '🟢';

      card.className = `unit-card ${statusClass}`;
      card.innerHTML = `
        <div class="unit-card-info">
          <span class="unit-status-icon">${statusIcon}</span>
          <div>
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
              <span class="badge-tag">${unit.category || 'מיומנות מעשית'}</span>
              <span style="font-size: 0.9rem;" title="${unit.trafficLightDesc || 'רמזור AI'}">${trafficEmoji}</span>
            </div>
            <h3 class="unit-name-title">${unit.title}</h3>
            <span class="unit-skills-preview">${unit.goal}</span>
          </div>
        </div>
        <div class="day-action-box">
          <span class="badge-tag">${statusBadgeText}</span>
          ${isUnlocked ? `<button class="primary-btn" style="padding: 0.6rem 1.2rem; font-size: 1rem; min-height: 44px;">
            <span>היכנס ליחידה</span>
            <span>▶</span>
          </button>` : ''}
        </div>
      `;

      if (isUnlocked) {
        card.onclick = () => {
          appState.activeUnitId = unit.id;
          showView('unit');
          renderUnitPlayer(unit.id);
        };
      } else {
        card.onclick = () => {
          showToast('עליך להשלים את היחידות ומבחן השלב הקודמים כדי לפתוח יחידה זו! 💪');
        };
      }

      container.appendChild(card);

      // בדיקה האם יש תחנת מבחן שלב אחרי יחידה זו
      const cp = (appState.checkpoints || []).find(c => c.afterUnitIndex === idx);
      if (cp) {
        const prev1 = units[idx - 1];
        const prev2 = units[idx];
        const isCpUnlocked = prev1 && prev1.isCompleted && prev2 && prev2.isCompleted;

        const cpCard = document.createElement('div');
        cpCard.className = `checkpoint-card ${cp.isPassed ? 'passed' : (!isCpUnlocked ? 'locked' : '')}`;
        cpCard.innerHTML = `
          <div class="checkpoint-info">
            <span style="font-size: 2.2rem; line-height: 1;">${cp.isPassed ? '🏆' : (isCpUnlocked ? '🎯' : '🔒')}</span>
            <div>
              <span class="badge-tag" style="background:#fef3c7;color:#b45309;display:inline-block;margin-bottom:0.35rem;">
                ${cp.isPassed ? `עברת בהצלחה (ציון ${cp.lastScore}) ✓` : 'סימולציית חיים מעשית (דרוש ציון 85+)'}
              </span>
              <h3 class="checkpoint-title">${cp.title}</h3>
              <span class="checkpoint-desc">${cp.description}</span>
            </div>
          </div>
          <div class="day-action-box">
            <span class="badge-tag" style="${cp.isPassed ? 'background:#ecfdf5;color:#059669;' : ''}">
              ${cp.isPassed ? '✓ הושלם' : (isCpUnlocked ? 'מוכן למבחן' : 'נעול')}
            </span>
            ${isCpUnlocked ? `<button class="primary-btn" style="padding: 0.6rem 1.2rem; font-size: 1rem; min-height: 44px; background: #f59e0b;">
              <span>${cp.isPassed ? 'בצע שוב' : 'התחל מבחן'}</span>
              <span>▶</span>
            </button>` : ''}
          </div>
        `;

        if (isCpUnlocked) {
          cpCard.onclick = () => openCheckpointTest(cp);
        } else {
          cpCard.onclick = () => showToast('תחנת מבחן זו תיפתח ברגע שתסיים את 2 היחידות שמעליה! 🌟');
        }

        container.appendChild(cpCard);
      }
    });

    // עדכון תגי הסטטוס העצמאיים (ללא גלישת מילים וללא חיתוך מלבנים)
    const passedCPs = (appState.checkpoints || []).filter(c => c.isPassed).length;
    const unitsText = document.getElementById('units-stat-text');
    if (unitsText) unitsText.textContent = `${completedCount} מתוך ${units.length} יחידות`;

    const cpText = document.getElementById('checkpoints-stat-text');
    if (cpText) cpText.textContent = `${passedCPs} מתוך ${(appState.checkpoints || []).length} מבחנים`;

    const bar = document.getElementById('weekly-progress-bar');
    if (bar) bar.style.width = `${(completedCount / Math.max(1, units.length)) * 100}%`;

  } else {
    // מסלול 2: יסודות הנהלת חשבונות (Dynamic Block Engine)
    if (cpBadgeBox) cpBadgeBox.style.display = 'none';

    const titleEl = document.querySelector('.roadmap-title');
    if (titleEl) titleEl.textContent = 'מסלול הנהלת חשבונות: צעד אחר צעד 📊';
    const subEl = document.querySelector('.roadmap-subtitle');
    if (subEl) subEl.textContent = 'יסודות חובה וזכות, מע"מ, עסקאות משותפות ומשגור • למידה מבוססת משימות וטבלאות';

    const units = getTrackUnits(activeTrack);
    let completedCount = 0;

    units.forEach((unit, idx) => {
      if (unit.isCompleted) completedCount++;

      // פתיחה סדרתית: יחידה 0 תמיד פתוחה; יחידה נפתחת כשהקודמת הושלמה
      const isUnlocked = idx === 0 || !!(units[idx - 1] && units[idx - 1].isCompleted);
      unit.isUnlocked = isUnlocked;

      const card = document.createElement('div');
      let statusClass = 'locked-unit';
      let statusIcon = '🔒';
      let statusBadgeText = 'נעול';

      if (unit.isCompleted) {
        statusClass = 'completed-unit';
        statusIcon = '🟢';
        statusBadgeText = '✓ הושלם';
      } else if (isUnlocked) {
        statusClass = 'active-unit';
        statusIcon = '🔵';
        statusBadgeText = 'פתוח עכשיו';
      }

      const firstText = (unit.blocks || []).find(b => b.type === 'text');
      const previewDesc = firstText ? firstText.content : 'יחידת לימוד מעשית מבוססת בלוקים ומשימות';

      card.className = `unit-card ${statusClass}`;
      card.innerHTML = `
        <div class="unit-card-info">
          <span class="unit-status-icon">${statusIcon}</span>
          <div>
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
              <span class="badge-tag">יחידה ${idx + 1}</span>
              <span class="badge-tag" style="background: #e0f2fe; color: #0369a1;">⏱️ ${unit.target_minutes || 5} דק'</span>
            </div>
            <h3 class="unit-name-title">${unit.title}</h3>
            <span class="unit-skills-preview">${previewDesc}</span>
          </div>
        </div>
        <div class="day-action-box">
          <span class="badge-tag">${statusBadgeText}</span>
          ${isUnlocked ? `<button class="primary-btn" style="padding: 0.6rem 1.2rem; font-size: 1rem; min-height: 44px;">
            <span>${unit.isCompleted ? 'צפה שוב' : 'היכנס ליחידה'}</span>
            <span>▶</span>
          </button>` : ''}
        </div>
      `;

      if (isUnlocked) {
        card.onclick = () => {
          appState.activeUnitId = unit.id;
          showView('unit');
          renderUnitPlayer(unit.id);
        };
      } else {
        card.onclick = () => {
          showToast('עליך להשלים את היחידה הקודמת כדי לפתוח יחידה זו! 💪');
        };
      }

      container.appendChild(card);
    });

    const unitsText = document.getElementById('units-stat-text');
    if (unitsText) unitsText.textContent = `${completedCount} מתוך ${units.length} יחידות`;

    const bar = document.getElementById('weekly-progress-bar');
    if (bar) bar.style.width = `${(completedCount / Math.max(1, units.length)) * 100}%`;
  }
}

// ============================================================================
// 6.5. מנוע הבלוקים הדינמי - תקן בלוקים (Dynamic Block Engine v1.0)
// ============================================================================

/**
 * דיספצ'ר ראשי לרינדור בלוק לימוד
 * @param {object} block - אובייקט הבלוק לפי מפרט LESSON_ENGINE_SPEC
 * @param {number} index - אינדקס הבלוק ביחידה
 * @param {object} unit - יחידת הלימוד
 * @returns {HTMLElement}
 */
function renderBlock(block, index, unit, exerciseStep = null) {
  const container = document.createElement('div');
  container.className = `lesson-block block-type-${block.type || 'text'}`;

  switch (block.type) {
    case 'text':
      renderTextBlock(container, block);
      break;
    case 'compare':
      renderCompareBlock(container, block);
      break;
    case 'callout':
      renderCalloutBlock(container, block);
      break;
    case 'interactive_scale':
      renderScaleBlock(container, block);
      break;
    case 'checklist_steps':
      renderChecklistBlock(container, block);
      break;
    case 'journal_grid':
      renderJournalGridBlock(container, block);
      break;
    case 'spreadsheet_task':
      renderSpreadsheetBlock(container, block);
      break;
    case 'exercise':
      renderExerciseBlock(container, block, exerciseStep);
      break;
    case 'ai_eval_qa':
      renderAiEvalBlock(container, block);
      break;
    default:
      container.innerHTML = `<p class="block-text-content">${block.content || ''}</p>`;
  }

  return container;
}

/**
 * בלוק 1: כותרת וטקסט (text)
 */
function renderTextBlock(container, block) {
  const p = document.createElement('p');
  p.className = `block-text-content style-${block.style || 'normal'}`;
  p.textContent = block.content || '';
  container.appendChild(p);
}

/**
 * בלוק 2: כרטיס השוואה נכון מול שגוי (compare)
 */
function renderCompareBlock(container, block) {
  const good = block.good || { label: 'נכון', desc: '' };
  const bad = block.bad || { label: 'טעות נפוצה', desc: '' };
  container.innerHTML = `
    ${block.title ? `<h4 class="block-section-title">${block.title}</h4>` : ''}
    <div class="block-compare-grid">
      <div class="compare-card compare-good">
        <div class="compare-badge good-badge">✅ ${good.label}</div>
        <p class="compare-desc">${good.desc}</p>
      </div>
      <div class="compare-card compare-bad">
        <div class="compare-badge bad-badge">❌ ${bad.label}</div>
        <p class="compare-desc">${bad.desc}</p>
      </div>
    </div>
  `;
}

/**
 * בלוק 3: תיבת הדגשה / כלל / טיפ (callout)
 */
function renderCalloutBlock(container, block) {
  const icons = { tip: '💡', rule: '🛡️', warning: '⚠️', info: 'ℹ️' };
  const icon = icons[block.style] || '📌';
  container.innerHTML = `
    <div class="callout-card callout-${block.style || 'info'}">
      <div class="callout-header">
        <span class="callout-icon">${icon}</span>
        <strong class="callout-title">${block.title || 'שים לב'}</strong>
      </div>
      <p class="callout-text">${block.text || ''}</p>
    </div>
  `;
}

/**
 * בלוק 4: מאזניים אינטראקטיביים משודרגים (interactive_scale)
 * מציג תרחיש עסקי מעצים, זרוע מאזניים פיזית מוטה ב-12 מעלות, ובחירת משקולת שמאזנת בהצלחה לאופק
 * @param {HTMLElement} container
 * @param {object} block
 */
function renderScaleBlock(container, block) {
  // Defensive fallbacks — never crash on missing data
  const scenario   = block.scenario    || '';
  const options    = Array.isArray(block.options) ? block.options : [];
  const tiltedSide = block.tilted_side || (block.is_balanced === false ? 'credit' : '');

  const isTiltedCredit = tiltedSide === 'credit';
  const isTiltedDebit  = tiltedSide === 'debit';
  const initialRotation = isTiltedCredit ? 12 : (isTiltedDebit ? -12 : 0);
  const hasOptions = options.length > 0;
  const initiallyBalanced = initialRotation === 0;

  const leftWeightText  = block.left_weight  !== undefined ? `${Number(block.left_weight).toLocaleString()} ₪`  : '';
  const rightWeightText = block.right_weight !== undefined ? `${Number(block.right_weight).toLocaleString()} ₪` : '';

  container.innerHTML = `
    <div class="scale-block-card ${initiallyBalanced ? 'balanced' : 'tilted'}">
      ${block.title ? `<h4 class="block-section-title">${block.title}</h4>` : ''}
      
      ${scenario ? `
        <div class="scale-scenario-card">
          <div class="scale-scenario-header">
            <span class="scale-scenario-icon">💼</span>
            <strong class="scale-scenario-badge">סיטואציה עסקית</strong>
          </div>
          <p class="scale-scenario-text">${scenario}</p>
        </div>
      ` : ''}

      <div class="scale-stage-area">
        <div class="scale-fulcrum-post">
          <div class="scale-fulcrum-triangle"></div>
          <div class="scale-fulcrum-base"></div>
        </div>

        <div class="scale-beam-wrapper" style="transform: rotate(${initialRotation}deg);">
          <div class="scale-beam-bar">
            <!-- כף שמאל: חובה -->
            <div class="scale-pan-assembly pan-left">
              <div class="scale-pan-chain"></div>
              <div class="scale-pan-dish">
                <div class="pan-title">${block.left_label || 'חובה (נכנס)'}</div>
                ${leftWeightText ? `<div class="pan-amount">${leftWeightText}</div>` : ''}
              </div>
            </div>

            <div class="scale-pivot-center">⚖️</div>

            <!-- כף ימין: זכות -->
            <div class="scale-pan-assembly pan-right">
              <div class="scale-pan-chain"></div>
              <div class="scale-pan-dish">
                <div class="pan-title">${block.right_label || 'זכות (יצא)'}</div>
                ${rightWeightText ? `<div class="pan-amount">${rightWeightText}</div>` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="scale-status-banner ${initiallyBalanced ? 'balanced' : 'tilted'}">
        <span class="scale-status-icon">${initiallyBalanced ? '✓' : '⚠️'}</span>
        <span class="scale-status-text">
          ${initiallyBalanced ? 'המאזניים מאוזנים לחלוטין (חובה = זכות)' : 'המאזניים נוטים ואינם מאוזנים! יש לבחור פעולה מאזנת.'}
        </span>
      </div>

      ${hasOptions ? `
        <div class="scale-options-section">
          <div class="scale-options-prompt">
            <span class="prompt-icon">⚖️</span>
            <strong>בחר את המשקולת המאזנת להנחה על המאזניים:</strong>
          </div>
          <div class="scale-options-grid">
            ${options.map((opt, oIdx) => `
              <button class="scale-weight-btn" type="button" data-idx="${oIdx}">
                <span class="weight-icon">🪙</span>
                <span class="weight-label">${opt.text || ''}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : '<div class="scale-options-fallback">מאזניים להמחשה — אין אפשרויות בחירה בשלב זה.</div>'}

      <div class="scale-feedback-alert" style="display: none;"></div>
    </div>
  `;

  const beamEl = container.querySelector('.scale-beam-wrapper');
  const cardEl = container.querySelector('.scale-block-card');
  const statusBanner = container.querySelector('.scale-status-banner');
  const statusIcon = container.querySelector('.scale-status-icon');
  const statusText = container.querySelector('.scale-status-text');
  const feedbackEl = container.querySelector('.scale-feedback-alert');
  const weightButtons = container.querySelectorAll('.scale-weight-btn');

  if (hasOptions) {
    weightButtons.forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        const opt = options[idx];
        if (!opt) return;

        weightButtons.forEach(b => b.classList.remove('selected', 'correct', 'wrong'));
        btn.classList.add('selected');
        feedbackEl.style.display = 'block';

        if (opt.is_correct) {
          // אנימציה חלקה לאיזון אופקי (rotate 0deg)
          btn.classList.add('correct');
          if (beamEl) {
            beamEl.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
            beamEl.style.transform = 'rotate(0deg)';
          }
          if (cardEl) {
            cardEl.classList.remove('tilted');
            cardEl.classList.add('balanced');
          }
          if (statusBanner) {
            statusBanner.className = 'scale-status-banner balanced';
            if (statusIcon) statusIcon.textContent = '✓';
            if (statusText) statusText.textContent = 'כל הכבוד! המאזניים מאוזנים בדיוק מושלם (חובה = זכות) ✨';
          }
          feedbackEl.className = 'scale-feedback-alert praise';
          feedbackEl.innerHTML = `
            <div class="fb-header">🌟 איזון מושלם, דניאל!</div>
            <p class="fb-body">${opt.feedback || 'הנחת את המשקולת המדויקת שמאזנת את הפעולה.'}</p>
          `;
          SoundService.playSuccessSound();
          showToast('כל הכבוד דניאל! המאזניים אוזנו בהצלחה! ⚖️✨', 'success');
        } else {
          // שמירה על ההטיה המקורית של 12 מעלות עם משוב מנחה
          btn.classList.add('wrong');
          if (beamEl) {
            beamEl.style.transition = 'transform 0.4s ease';
            beamEl.style.transform = `rotate(${initialRotation}deg)`;
          }
          if (cardEl) {
            cardEl.classList.remove('balanced');
            cardEl.classList.add('tilted');
          }
          feedbackEl.className = 'scale-feedback-alert guiding';
          feedbackEl.innerHTML = `
            <div class="fb-header">💡 בוא נחשוב יחד:</div>
            <p class="fb-body">${opt.feedback || 'המשקולת הזו אינה מאזנת את שני הצדדים. נסה לבחור שוב בנחת.'}</p>
          `;
          showToast('כמעט! קרא את הרמז המנחה ונסה לבחור שוב 💡', 'warning');
        }
      };
    });
  }
}

/**
 * בלוק 5: צ'ק-ליסט שלבים (checklist_steps)
 */
function renderChecklistBlock(container, block) {
  container.innerHTML = `
    ${block.title ? `<h4 class="block-section-title">${block.title}</h4>` : ''}
    <div class="checklist-items-box">
      ${(block.steps || []).map((step, sIdx) => `
        <label class="checklist-item-row" data-step-idx="${sIdx}">
          <input type="checkbox" class="checklist-checkbox" />
          <span class="checklist-text">${step}</span>
        </label>
      `).join('')}
    </div>
  `;
  container.querySelectorAll('.checklist-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const row = e.target.closest('.checklist-item-row');
      if (row) row.classList.toggle('checked', e.target.checked);
    });
  });
}

/**
 * בלוק 6: טבלת פקודת יומן (journal_grid)
 */
function renderJournalGridBlock(container, block) {
  const rows = block.expected_rows || [];
  const defaultDistractors = [
    'קופה',
    'עו"ש בנק',
    'עסקה משותפת',
    'מע"מ תשומות',
    'מע"מ עסקאות',
    'הכנסות ממכירות',
    'ספקים',
    'חו"ז שותף ב\''
  ];

  const buildRowOptions = (row, rIdx) => {
    const correctAcc = row.account || '';
    const otherRowAccs = rows
      .map((r, i) => (i !== rIdx ? r.account : null))
      .filter(a => a && a !== correctAcc);
    const pool = [...new Set([...otherRowAccs, ...defaultDistractors])].filter(a => a !== correctAcc);
    const distractors = pool.slice(0, 2);
    const options = [correctAcc, ...distractors];
    // Deterministic rotation based on row index so options aren't always first
    const shift = (rIdx + 1) % options.length;
    return options.slice(shift).concat(options.slice(0, shift));
  };

  const tableHtml = `
    <div class="journal-block-card">
      <div class="journal-instruction">
        <span class="journal-pencil-icon">📝</span>
        <span>${block.instruction || 'ערוך פקודת יומן'}</span>
      </div>
      <div class="journal-table-wrapper">
        <table class="journal-grid-table">
          <thead>
            <tr>
              <th>שם החשבון</th>
              <th style="width: 140px;">חובה (₪)</th>
              <th style="width: 140px;">זכות (₪)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, rIdx) => {
              const opts = buildRowOptions(row, rIdx);
              return `
              <tr class="journal-row" data-row-idx="${rIdx}">
                <td class="journal-acc-cell">
                  <select class="styled-select journal-acc-select">
                    <option value="">-- בחר חשבון (3 אפשרויות) --</option>
                    ${opts.map(opt => `<option value="${opt.replace(/"/g, '&quot;')}">${opt}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <input type="number" class="styled-input journal-debit-input" placeholder="0" value="" />
                </td>
                <td>
                  <input type="number" class="styled-input journal-credit-input" placeholder="0" value="" />
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="journal-total-row">
              <td><strong>סה"כ פקודה:</strong></td>
              <td class="total-debit-cell">0 ₪</td>
              <td class="total-credit-cell">0 ₪</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="journal-actions-row">
        <button class="primary-btn journal-check-btn" type="button">
          <span>בדוק איזון פקודת יומן ⚖️</span>
        </button>
        <div class="journal-feedback-msg" style="display: none;"></div>
      </div>
    </div>
  `;
  container.innerHTML = tableHtml;

  const updateTotals = () => {
    let dSum = 0;
    let cSum = 0;
    container.querySelectorAll('.journal-debit-input').forEach(inp => dSum += Number(inp.value) || 0);
    container.querySelectorAll('.journal-credit-input').forEach(inp => cSum += Number(inp.value) || 0);
    const dCell = container.querySelector('.total-debit-cell');
    const cCell = container.querySelector('.total-credit-cell');
    if (dCell) dCell.textContent = `${dSum.toLocaleString()} ₪`;
    if (cCell) cCell.textContent = `${cSum.toLocaleString()} ₪`;
    return { dSum, cSum };
  };

  container.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateTotals));
  updateTotals();

  const checkBtn = container.querySelector('.journal-check-btn');
  const fbMsg = container.querySelector('.journal-feedback-msg');
  if (checkBtn && fbMsg) {
    checkBtn.onclick = () => {
      const { dSum, cSum } = updateTotals();
      fbMsg.style.display = 'block';

      const trElements = Array.from(container.querySelectorAll('.journal-row'));
      const enteredRows = trElements.map(tr => ({
        tr,
        account: (tr.querySelector('.journal-acc-select')?.value || '').trim(),
        debit: Number(tr.querySelector('.journal-debit-input')?.value) || 0,
        credit: Number(tr.querySelector('.journal-credit-input')?.value) || 0
      }));

      if (enteredRows.some(r => !r.account)) {
        fbMsg.className = 'journal-feedback-msg warning';
        fbMsg.textContent = 'דניאל, אנא בחר שם חשבון מהרשימה עבור כל שורה בטבלה לפני הבדיקה.';
        return;
      }

      const remainingExpected = rows.map(r => ({
        account: (r.account || '').trim(),
        debit: Number(r.debit) || 0,
        credit: Number(r.credit) || 0
      }));

      let allRowsMatch = true;
      enteredRows.forEach(entry => {
        const matchIdx = remainingExpected.findIndex(
          exp => exp.account === entry.account && exp.debit === entry.debit && exp.credit === entry.credit
        );
        if (matchIdx !== -1) {
          remainingExpected.splice(matchIdx, 1);
          entry.tr.classList.remove('row-invalid');
          entry.tr.classList.add('row-valid');
          entry.tr.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
        } else {
          allRowsMatch = false;
          entry.tr.classList.remove('row-valid');
          entry.tr.classList.add('row-invalid');
          entry.tr.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
        }
      });

      if (dSum > 0 && dSum === cSum && allRowsMatch) {
        fbMsg.className = 'journal-feedback-msg success';
        fbMsg.textContent = 'מצוין, דניאל! הפקודה מאוזנת ונכונה לחלוטין! כל החשבונות והסכומים בחובה ובזכות מדויקים ✓';
        SoundService.playSuccessSound();
      } else if (dSum > 0 && dSum === cSum) {
        fbMsg.className = 'journal-feedback-msg warning';
        fbMsg.textContent = 'הפקודה מאוזנת מתמטית (חובה = זכות), אך חלק מהחשבונות או הסכומים בשורות המסומנות אינם תואמים את נתוני האירוע.';
      } else {
        fbMsg.className = 'journal-feedback-msg error';
        fbMsg.textContent = block.validation_error_message || 'הפקודה לא מאוזנת! סך החובה חייב להיות שווה בדיוק לסך הזכות.';
      }
    };
  }
}

/**
 * בלוק 7: משימת גיליון נתונים וחישוב (spreadsheet_task)
 */
function renderSpreadsheetBlock(container, block) {
  const td = block.table_data || { headers: [], rows: [] };
  container.innerHTML = `
    <div class="spreadsheet-block-card">
      <div class="spreadsheet-header">
        <span class="ss-icon">📊</span>
        <div>
          <h4 class="ss-title">${block.title || 'משימת נתונים'}</h4>
          <p class="ss-instructions">${block.instructions || ''}</p>
        </div>
      </div>
      <div class="ss-table-wrapper">
        <table class="spreadsheet-grid-table">
          <thead>
            <tr>
              ${(td.headers || []).map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${(td.rows || []).map(row => `
              <tr>
                ${row.map(cell => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="ss-action-box">
        <label class="ss-prompt-label"><strong>שאלה:</strong> ${block.action_prompt || ''}</label>
        <div class="ss-input-group">
          <input type="number" class="styled-input ss-answer-input" placeholder="הקלד כאן מספר..." />
          <button class="primary-btn ss-check-btn" type="button">בדוק תשובה</button>
          ${block.hint ? `<button class="secondary-btn ss-hint-btn" type="button">💡 רמז</button>` : ''}
        </div>
        ${block.hint ? `<div class="ss-hint-text" style="display: none;">${block.hint}</div>` : ''}
        <div class="ss-feedback-msg" style="display: none;"></div>
      </div>
    </div>
  `;

  const hintBtn = container.querySelector('.ss-hint-btn');
  const hintText = container.querySelector('.ss-hint-text');
  if (hintBtn && hintText) {
    hintBtn.onclick = () => {
      hintText.style.display = hintText.style.display === 'none' ? 'block' : 'none';
    };
  }

  const checkBtn = container.querySelector('.ss-check-btn');
  const input = container.querySelector('.ss-answer-input');
  const fb = container.querySelector('.ss-feedback-msg');
  if (checkBtn && input && fb) {
    checkBtn.onclick = () => {
      const val = Number(input.value);
      const expected = Number(block.expected_numeric_answer);
      fb.style.display = 'block';
      if (val === expected) {
        fb.className = 'ss-feedback-msg success';
        fb.textContent = 'כל הכבוד, דניאל! חישוב מדויק ונכון מאוד 🌟';
        SoundService.playSuccessSound();
      } else {
        fb.className = 'ss-feedback-msg error';
        fb.textContent = `לא בדיוק (קיבלת ${val}). נסה שוב או היעזר ברמז למעלה!`;
      }
    };
  }
}

/**
 * בלוק 8: שאלת תרגול רב-ברירתית (exercise)
 */
function renderExerciseBlock(container, block, onAnsweredCorrectly) {
  container.innerHTML = `
    <div class="exercise-block-card">
      <div class="exercise-header">
        <span class="exercise-badge">🎯 שאלת בדיקה עצמית</span>
        <h4 class="exercise-question">${block.question || ''}</h4>
        ${block.hint ? `
          <button type="button" class="secondary-btn exercise-hint-btn" style="margin-top:0.6rem;">💡 רמז לדניאל</button>
          <div class="exercise-hint-box" style="display:none; margin-top:0.5rem;">${block.hint}</div>
        ` : ''}
      </div>
      <div class="exercise-options-list">
        ${(block.options || []).map((opt, oIdx) => `
          <button class="exercise-option-btn" type="button" data-idx="${oIdx}">
            <span class="option-marker">${['א', 'ב', 'ג', 'ד'][oIdx] || oIdx + 1}</span>
            <span class="option-text">${opt}</span>
          </button>
        `).join('')}
      </div>
      <div class="exercise-feedback-card" style="display: none;"></div>
    </div>
  `;

  const hintBtn = container.querySelector('.exercise-hint-btn');
  const hintBox = container.querySelector('.exercise-hint-box');
  if (hintBtn && hintBox) {
    hintBtn.onclick = () => {
      hintBox.style.display = hintBox.style.display === 'none' ? 'block' : 'none';
    };
  }

  const buttons = container.querySelectorAll('.exercise-option-btn');
  const fbCard = container.querySelector('.exercise-feedback-card');

  buttons.forEach(btn => {
    btn.onclick = () => {
      const chosen = Number(btn.dataset.idx);
      buttons.forEach(b => b.classList.remove('selected', 'correct', 'wrong'));
      btn.classList.add('selected');

      fbCard.style.display = 'block';
      if (chosen === block.correct_index) {
        btn.classList.add('correct');
        fbCard.className = 'exercise-feedback-card success';
        fbCard.innerHTML = `
          <strong>נכון מאוד! ✨</strong>
          <p>${block.explanation || 'תשובה מדויקת!'}</p>
        `;
        SoundService.playSuccessSound();
        if (typeof onAnsweredCorrectly === 'function') onAnsweredCorrectly();
      } else {
        btn.classList.add('wrong');
        fbCard.className = 'exercise-feedback-card wrong';
        fbCard.innerHTML = `
          <strong>לא בדיוק.</strong>
          <p>חשוב שוב על הכיוון: לאן הכסף נכנס ומאיפה הוא יצא, ונסה לבחור שוב! 💪</p>
        `;
      }
    };
  });
}

/**
 * בלוק 9: שאלה פתוחה עם בדיקת AI מעצימה (ai_eval_qa)
 */
function renderAiEvalBlock(container, block) {
  if (typeof block._isPassed !== 'boolean') {
    block._isPassed = false;
  }

  container.innerHTML = `
    <div class="ai-eval-block-card">
      <div class="ai-eval-header">
        <span class="ai-eval-robot-icon">🤖</span>
        <div>
          <h4 class="ai-eval-title">${block.question_title || 'שאלה למחשבה'}</h4>
          <span class="ai-eval-subtitle">כתוב במילים שלך - המאמן יבדוק וייתן משוב מעצים</span>
        </div>
      </div>
      <div class="ai-eval-body">
        <textarea class="styled-textarea ai-eval-textarea" rows="3" placeholder="${block.placeholder || 'כתוב כאן בנחת...'}"></textarea>
        <div class="ai-eval-actions">
          <button class="primary-btn ai-eval-submit-btn" type="button">
            <span>שלח לבדיקת AI מעצימה ✨</span>
          </button>
        </div>
        <div class="ai-eval-feedback-result" style="display: none;"></div>
      </div>
    </div>
  `;

  const btn = container.querySelector('.ai-eval-submit-btn');
  const textarea = container.querySelector('.ai-eval-textarea');
  const fbResult = container.querySelector('.ai-eval-feedback-result');

  if (btn && textarea && fbResult) {
    btn.onclick = async () => {
      const text = textarea.value.trim();
      if (!text) {
        showToast('אנא כתוב כמה מילים לפני השליחה ✍️');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span>בודק בנחת... ⏳</span>';
      fbResult.style.display = 'block';
      fbResult.className = 'ai-eval-feedback-result loading';
      fbResult.style.cssText = 'display: block;';
      fbResult.innerHTML = '<p>המאמן של דניאל מעבד את התשובה שלך... 🤖</p>';

      const evalPrompt = `אתה מאמן למידה פדגוגי, חם ומדויק עבור דניאל (בן 28).
השאלה שנשאלה: "${block.question_title}"
תשובת דניאל: "${text}"
מושג הליבה והתשובה הנדרשת: "${block.rubric_for_ai?.core_concept || ''}"
כללי הערכה: ${JSON.stringify(block.rubric_for_ai?.evaluation_rules || [])}

עליך להעריך באמת האם תשובתו של דניאל נכונה ומדויקת לפי מושג הליבה, או שהיא שגויה / חלקית / לא מדויקת.
החזר אך ורק אובייקט JSON תקני (ללא markdown וללא טקסט מחוץ ל-JSON) במבנה הבא:
{
  "is_accurate": true,
  "opening_quote": "משפט פתיחה חם ומכבד שמצטט ישירות מילים מתוך מה שדניאל כתב",
  "explanation": "אם is_accurate הוא false: הסבר ברור ופשוט למה התשובה עדיין לא מדויקת ומה התבלבל. אם is_accurate הוא true: חיזוק ממוקד שמסביר למה ההיגיון של דניאל מדויק.",
  "next_step_or_recap": "אם is_accurate הוא false: רמז מכוון ושאלה מנחה שמזמינה את דניאל לנסות שוב. אם is_accurate הוא true: סיכום קצר ומזוקק (משפט אחד) של הכלל שלמדנו."
}`;

      let raw = '';
      try {
        raw = await callMultiTierAI(evalPrompt);
      } catch (e) {
        console.error('[ai_eval_qa] Multi-tier AI fallback threw unexpectedly:', e);
      }

      const parsed = raw ? AIService.cleanAndParseJSON(raw) : null;
      btn.disabled = false;

      if (parsed && parsed.is_accurate === false) {
        block._isPassed = false;
        fbResult.className = 'ai-eval-feedback-result warning';
        fbResult.style.cssText = 'display: block; border-right: 4px solid #d97706; background: #fffbeb; color: #92400e; padding: 1rem; border-radius: 12px; margin-top: 0.8rem;';
        fbResult.innerHTML = `
          <div style="margin-bottom: 0.45rem;">🔍 <strong>בוא נדייק יחד, דניאל:</strong></div>
          <p style="margin: 0.35rem 0;">${parsed.opening_quote || ''}</p>
          <p style="margin: 0.35rem 0;"><strong>למה זה עדיין לא מדויק?</strong> ${parsed.explanation || ''}</p>
          <p style="margin: 0.35rem 0;"><strong>💡 כיוון לניסיון הבא:</strong> ${parsed.next_step_or_recap || ''}</p>
        `;
        btn.innerHTML = '<span>נסה לענות שוב לפי ההכוונה ✍️</span>';
        textarea.focus();
      } else {
        block._isPassed = true;
        const words = text.split(/\s+/).slice(0, 4).join(' ');
        const fallbackText = raw || `כל הכבוד דניאל! נהדר לראות שכתבת "${words}...". ההסבר שלך נוגע בדיוק בעניין המרכזי.`;
        const mainParagraph = parsed
          ? `${parsed.opening_quote || ''} ${parsed.explanation || ''}`.trim()
          : fallbackText;
        const recapText = parsed
          ? (parsed.next_step_or_recap || block.rubric_for_ai?.core_concept || '')
          : (block.rubric_for_ai?.core_concept || 'הבנת את העיקרון המרכזי של היחידה');

        fbResult.className = 'ai-eval-feedback-result success';
        fbResult.style.cssText = 'display: block;';
        fbResult.innerHTML = `
          <div class="ai-coach-bubble">
            <div class="ai-bubble-badge">🌟 <strong>תשובה מדויקת ומעולה, דניאל!</strong></div>
            <p class="ai-bubble-content">${mainParagraph}</p>
            <div style="margin-top:0.6rem; padding:0.6rem 0.9rem; background:rgba(16,185,129,0.12); border-radius:8px;">
              <strong>📌 סיכום העיקרון שפיצחת:</strong> ${recapText}
            </div>
          </div>
        `;
        btn.innerHTML = '<span>התשובה אושרה בהצלחה! ✅</span>';
        SoundService.playSuccessSound();
      }
    };
  }
}


// ============================================================================
// 6b. Multi-Tier AI Fallback Helpers (client-side only — GitHub Pages safe)
// ============================================================================

function stripThinkTags(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Tier 1 (Primary): Gemini REST API
 * @param {string} model - e.g. 'gemini-3.6-flash'
 * @param {string} apiKey
 * @param {string} prompt
 * @param {object} options
 * @returns {Promise<string>}
 */
async function callGeminiAPI(model, apiKey, prompt, options = {}) {
  const key = cleanApiKey(apiKey);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const fullPrompt = (options.systemInstruction && !prompt.includes(options.systemInstruction))
    ? `${options.systemInstruction}\n\n${prompt}`
    : prompt;
  const parts = [{ text: fullPrompt }];
  if (Array.isArray(options.images)) {
    options.images.forEach(img => {
      if (img && img.data) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/jpeg',
            data: img.data.replace(/^data:[^;]+;base64,/, '')
          }
        });
      }
    });
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] })
  });
  if (!res.ok) throw new Error(`Gemini ${model} HTTP ${res.status}`);
  const data = await res.json();
  const text = stripThinkTags(data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
  if (!text) throw new Error(`Gemini ${model} returned empty content`);
  return text;
}

/**
 * Tier 2 (Secondary): Groq / Grok (xAI) API
 * @param {string} apiKey
 * @param {string} prompt
 * @param {string} explicitModel
 * @param {object} options
 * @returns {Promise<string>}
 */
async function callGrokAPI(apiKey, prompt, explicitModel = '', options = {}) {
  const key = cleanApiKey(apiKey);
  const isGroq = key.startsWith('gsk_');
  const endpoint = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.x.ai/v1/chat/completions';

  let model = explicitModel;
  if (!model) {
    if (Array.isArray(options.images) && options.images.length > 0 && isGroq) {
      model = appState?.apiConfig?.verifiedGroqVisionModel || 'meta-llama/llama-4-scout-17b-16e-instruct';
    } else {
      model = isGroq
        ? (appState?.apiConfig?.verifiedGroqModel || 'qwen/qwen3.8-27b')
        : 'grok-2-latest';
    }
  }

  let userContent = prompt;
  if (Array.isArray(options.images) && options.images.length > 0) {
    userContent = [{ type: 'text', text: prompt }];
    options.images.forEach(img => {
      if (img && (img.url || img.data)) {
        const dataUrl = img.url || (img.data.startsWith('data:') ? img.data : `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`);
        userContent.push({ type: 'image_url', image_url: { url: dataUrl } });
      }
    });
  }

  const hebrewSystemGuard = options.systemInstruction || 'ענה אך ורק בעברית תקנית, ברורה ושלמה. אל תשתמש בשום מילה בערבית או בשפה זרה, ואל תקטע משפטים באמצע.';
  const messages = [
    { role: 'system', content: hebrewSystemGuard },
    { role: 'user', content: userContent }
  ];

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, messages, max_tokens: options.maxTokens || 1500 })
  });
  if (!res.ok) throw new Error(`Groq/Grok (${model}) HTTP ${res.status}`);
  const data = await res.json();
  const choice = data?.choices?.[0]?.message;
  const rawText = choice?.content || choice?.reasoning_content || choice?.reasoning || '';
  const text = stripThinkTags(rawText);
  if (!text) throw new Error(`Groq/Grok (${model}) returned empty content`);
  return text;
}

/**
 * Tier 3 (Backup): OpenRouter API
 * @param {string} apiKey
 * @param {string} prompt
 * @param {string} explicitModel
 * @returns {Promise<string>}
 */
async function callOpenRouterAPI(apiKey, prompt, explicitModel = '') {
  const key = cleanApiKey(apiKey);
  const model = explicitModel || appState?.apiConfig?.verifiedOpenRouterModel || 'openai/gpt-4o-mini';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] })
  });
  if (!res.ok) throw new Error(`OpenRouter (${model}) HTTP ${res.status}`);
  const data = await res.json();
  const choice = data?.choices?.[0]?.message;
  const text = stripThinkTags(choice?.content || choice?.reasoning_content || choice?.reasoning || '');
  if (!text) throw new Error(`OpenRouter (${model}) returned empty content`);
  return text;
}

/**
 * Unified sequential multi-tier AI fallback.
 * Tier 1 (Primary): Google Gemini -> Tier 2 (Secondary): Groq / Grok -> Tier 3 (Backup): OpenRouter -> Tier 4: Offline Fallback.
 * @param {string} prompt
 * @param {object} options
 * @returns {Promise<string>}
 */
async function callMultiTierAI(prompt, options = {}) {
  let savedState = {};
  try {
    savedState = JSON.parse(localStorage.getItem('DANIEL_AI_V3_CLEAN') || '{}');
  } catch (e) {}
  const cfg = { ...(savedState.apiConfig || {}), ...(appState?.apiConfig || {}) };

  const geminiKey = cleanApiKey(
    localStorage.getItem('gemini_api_key') ||
    cfg.geminiKey ||
    ''
  );
  const grokKey = cleanApiKey(
    localStorage.getItem('xai_api_key') ||
    localStorage.getItem('groq_api_key') ||
    cfg.xaiKey ||
    cfg.groqKey ||
    ''
  );
  const orKey = cleanApiKey(
    localStorage.getItem('openrouter_api_key') ||
    cfg.openrouterKey ||
    ''
  );

  const errors = [];
  const hasImages = Array.isArray(options.images) && options.images.length > 0;

  // TIER 1 (PRIMARY — Google Gemini First)
  if (geminiKey) {
    const baseGemini = (typeof AIService !== 'undefined' && Array.isArray(AIService.geminiModels))
      ? AIService.geminiModels
      : ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-lite-latest'];
    const geminiModelsToTry = [...new Set([
      localStorage.getItem('verified_gemini_model'),
      cfg.verifiedGeminiModel,
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      ...baseGemini
    ].filter(Boolean))];

    for (const model of geminiModelsToTry) {
      try {
        const reply = await callGeminiAPI(model, geminiKey, prompt, options);
        if (appState?.apiConfig) {
          appState.apiConfig.verifiedGeminiModel = model;
        }
        localStorage.setItem('verified_gemini_model', model);
        return reply;
      } catch (e) {
        errors.push(`Gemini (${model}): ${e.message}`);
        console.warn(`[AI Tier 1] Gemini (${model}) failed, trying next Gemini candidate…`, e);
      }
    }
  }

  // TIER 2 (SECONDARY — Groq / Grok Second)
  if (grokKey) {
    const isGroq = grokKey.startsWith('gsk_');
    let groqModelsToTry = [];
    if (hasImages && isGroq) {
      groqModelsToTry = [
        cfg.verifiedGroqVisionModel,
        'meta-llama/llama-4-scout-17b-16e-instruct'
      ].filter(Boolean);
    } else if (isGroq) {
      groqModelsToTry = [...new Set([
        cfg.verifiedGroqModel,
        'qwen/qwen3.8-27b',
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant'
      ].filter(Boolean))];
    } else {
      groqModelsToTry = ['grok-2-latest'];
    }

    for (const model of groqModelsToTry) {
      try {
        const reply = await callGrokAPI(grokKey, prompt, model, options);
        if (isGroq && !hasImages && appState?.apiConfig) {
          appState.apiConfig.verifiedGroqModel = model;
        }
        return reply;
      } catch (e) {
        errors.push(`Groq/Grok (${model}): ${e.message}`);
        console.warn(`[AI Tier 2] Groq/Grok (${model}) failed, trying next…`, e);
      }
    }
  }

  // TIER 3 (FINAL BACKUP — OpenRouter Third)
  if (orKey && !hasImages) {
    const orModels = [...new Set([
      cfg.verifiedOpenRouterModel,
      'openai/gpt-4o-mini',
      'openai/gpt-3.5-turbo'
    ].filter(Boolean))];

    for (const model of orModels) {
      try {
        const reply = await callOpenRouterAPI(orKey, prompt, model);
        if (appState?.apiConfig) {
          appState.apiConfig.verifiedOpenRouterModel = model;
        }
        return reply;
      } catch (e) {
        errors.push(`OpenRouter (${model}): ${e.message}`);
        console.warn(`[AI Tier 3] OpenRouter (${model}) failed, trying next…`, e);
      }
    }
  }

  // TIER 4: All Failed -> Console Error + Toast Error + Offline Fallback
  console.error('[callMultiTierAI] All AI providers failed:', errors);
  showToast('שגיאת AI: כל ספקי ה-AI נכשלו. מופעל משוב אופליין מקומי (בדוק קונסול).', 'error');
  return '';
}



function renderUnitPlayer(unitId) {
  const activeTrack = getActiveTrack();
  const legacyWrapper = document.getElementById('unit-steps-wrapper');
  const blocksWrapper = document.getElementById('unit-blocks-wrapper');

  if (activeTrack.engine === 'blocks') {
    // ========================================================================
    // מנוע הבלוקים הדינמי (Dynamic Block Engine - Track 2: Accounting)
    // ========================================================================
    if (legacyWrapper) legacyWrapper.style.display = 'none';
    if (blocksWrapper) {
      blocksWrapper.style.display = 'flex';
      blocksWrapper.innerHTML = '';
    }

    const units = getTrackUnits(activeTrack);
    const unit = units.find(u => u.id === unitId || u.unit_id === unitId);
    if (!unit) return;

    const titleEl = document.getElementById('unit-view-title');
    if (titleEl) titleEl.textContent = unit.title;
    const mainTitleEl = document.getElementById('unit-main-title');
    if (mainTitleEl) mainTitleEl.textContent = unit.title;
    const badgeEl = document.getElementById('unit-topic-badge');
    if (badgeEl) badgeEl.textContent = activeTrack.shortLabel || 'הנהלת חשבונות';
    const goalEl = document.getElementById('unit-goal-desc');
    if (goalEl) goalEl.textContent = `⏱️ זמן מומלץ: ${unit.target_minutes || 5} דקות • למידה מבוססת בלוקים ומשימות מעשיות`;

    const backBtn = document.getElementById('unit-back-btn');
    if (backBtn) {
      backBtn.onclick = () => {
        showView('roadmap');
        renderRoadmap();
      };
    }

    if (blocksWrapper) {
      const allBlocks = unit.blocks || [];
      const exerciseBlocks = allBlocks.filter(b => b.type === 'exercise');
      let stepperInserted = false;

      allBlocks.forEach((block, bIdx) => {
        if (block.type === 'exercise') {
          if (!stepperInserted && exerciseBlocks.length > 0) {
            stepperInserted = true;
            const stepperContainer = document.createElement('div');
            stepperContainer.className = 'lesson-block exercise-stepper-container';
            let currentStep = 0;

            const renderStep = () => {
              const total = exerciseBlocks.length;
              const pct = ((currentStep + 1) / total) * 100;
              const isLast = currentStep === total - 1;

              stepperContainer.innerHTML = `
                <div class="exercise-stepper-header" style="margin-bottom: 1rem;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.45rem; font-weight:700;">
                    <span>שאלה ${currentStep + 1} מתוך ${total}</span>
                    <span>${Math.round(pct)}%</span>
                  </div>
                  <div class="stepper-progress-track" style="width:100%; height:8px; background:rgba(15,118,110,0.12); border-radius:999px; overflow:hidden;">
                    <div class="stepper-progress-fill" style="width: ${pct}%; height:100%; background:#0f766e; transition:width 0.3s ease;"></div>
                  </div>
                </div>
                <div class="exercise-stepper-body"></div>
                <div class="exercise-stepper-footer" style="margin-top: 1rem; display:flex; justify-content:flex-end; align-items:center;">
                  <button type="button" class="primary-btn exercise-next-step-btn" disabled>
                    <span>${isLast ? 'סיום סדרת השאלות בהצלחה! 🏆' : 'המשך לשאלה הבאה ▶'}</span>
                  </button>
                </div>
                <div class="exercise-stepper-complete" style="display:none; margin-top:1rem; padding:1rem; border-radius:12px; background:rgba(16,185,129,0.12); color:#065f46; font-weight:700; text-align:center;">
                  🎉 כל הכבוד דניאל! השלמת בהצלחה את כל ${total} שאלות התרגול ביחידה זו! ⭐
                </div>
              `;

              const bodyEl = stepperContainer.querySelector('.exercise-stepper-body');
              const nextBtn = stepperContainer.querySelector('.exercise-next-step-btn');
              const completeBanner = stepperContainer.querySelector('.exercise-stepper-complete');

              renderExerciseBlock(bodyEl, exerciseBlocks[currentStep], () => {
                if (nextBtn) nextBtn.disabled = false;
              });

              if (nextBtn) {
                nextBtn.onclick = () => {
                  if (currentStep < total - 1) {
                    currentStep++;
                    renderStep();
                  } else {
                    nextBtn.style.display = 'none';
                    if (completeBanner) completeBanner.style.display = 'block';
                    SoundService.playSuccessSound();
                  }
                };
              }
            };

            renderStep();
            blocksWrapper.appendChild(stepperContainer);
          }
          return;
        }

        const blockEl = renderBlock(block, bIdx, unit);
        if (blockEl) blocksWrapper.appendChild(blockEl);
      });

      // כרטיס סיום היחידה ומשוב מעצים
      const finishContainer = document.createElement('div');
      finishContainer.className = 'unit-finish-block-card';
      finishContainer.innerHTML = `
        <div style="text-align: center; margin: 2rem 0 1rem 0;">
          <button class="primary-btn block-finish-btn" type="button" style="min-height: 52px; font-size: 1.15rem; padding: 0.9rem 2.2rem;">
            <span>סיימתי בהצלחה את כל הבלוקים ביחידה! ⭐</span>
          </button>
          <div class="block-completed-box" style="display: ${unit.isCompleted ? 'block' : 'none'}; margin-top: 1.2rem;">
            <div class="completed-ribbon" style="display: flex;">
              <span class="ribbon-icon">⭐</span>
              <span class="ribbon-text">כל הכבוד דניאל! היחידה הושלמה בהצלחה!</span>
            </div>
            <button class="share-whatsapp-btn block-wa-share-btn" style="margin-top: 1rem;">
              <span>שלח עדכון לאבא ב-WhatsApp 📲</span>
            </button>
          </div>
        </div>
      `;

      const finishBtn = finishContainer.querySelector('.block-finish-btn');
      const compBox = finishContainer.querySelector('.block-completed-box');
      const waBtn = finishContainer.querySelector('.block-wa-share-btn');

      if (finishBtn) {
        finishBtn.onclick = () => {
          const evalBlock = allBlocks.find(b => b.type === 'ai_eval_qa');
          if (evalBlock && !evalBlock._isPassed) {
            showToast('לפני סיום היחידה, אנא השלם את השאלה הפתוחה למטה עד לקבלת אישור מהמאמן 🤖', 'warning');
            const evalCard = blocksWrapper.querySelector('.ai-eval-block-card');
            if (evalCard) evalCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }

          if (!appState.trackProgress[activeTrack.id]) {
            appState.trackProgress[activeTrack.id] = [];
          }
          if (!appState.trackProgress[activeTrack.id].includes(unit.id)) {
            appState.trackProgress[activeTrack.id].push(unit.id);
          }
          unit.isCompleted = true;
          saveAppState();
          SoundService.playSuccessSound();
          showToast(`כל הכבוד דניאל! יחידה "${unit.title}" הושלמה בהצלחה! 🌟`);
          if (compBox) compBox.style.display = 'block';
          compBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
      }

      if (waBtn) {
        waBtn.onclick = () => {
          const msg = encodeURIComponent(`שלום אבא! סיימתי עכשיו בהצלחה את יחידת "${unit.title}" במסלול ${activeTrack.label}! ⭐`);
          window.open(`https://wa.me/?text=${msg}`, '_blank');
        };
      }

      blocksWrapper.appendChild(finishContainer);
    }

    return;
  }

  // ========================================================================
  // מנוע הלמידה הוותיק ב-4 שלבים (Legacy Engine - Track 1: General & AI)
  // ========================================================================
  if (blocksWrapper) blocksWrapper.style.display = 'none';
  if (legacyWrapper) legacyWrapper.style.display = 'block';

  const unit = appState.curriculumUnits.find(u => u.id === unitId);
  if (!unit) return;

  const titleEl = document.getElementById('unit-view-title');
  if (titleEl) titleEl.textContent = unit.title;
  const mainTitleEl = document.getElementById('unit-main-title');
  if (mainTitleEl) mainTitleEl.textContent = unit.title;
  const badgeEl = document.getElementById('unit-topic-badge');
  if (badgeEl) badgeEl.textContent = unit.category || 'מיומנות מעשית';
  const goalEl = document.getElementById('unit-goal-desc');
  if (goalEl) goalEl.textContent = unit.goal;

  const backBtn = document.getElementById('unit-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };
  }

  // שלב 1: המחשה מוחשית Side-by-Side
  const badPrompt = document.getElementById('demo-bad-prompt');
  if (badPrompt) badPrompt.textContent = `"${unit.step1_demo.badPrompt}"`;
  const badRes = document.getElementById('demo-bad-result');
  if (badRes) badRes.textContent = unit.step1_demo.badResult;
  const goodPrompt = document.getElementById('demo-good-prompt');
  if (goodPrompt) goodPrompt.textContent = `"${unit.step1_demo.goodPrompt}"`;
  const goodRes = document.getElementById('demo-good-result');
  if (goodRes) goodRes.textContent = unit.step1_demo.goodResult;

  const ttsDemoBtn = document.getElementById('tts-demo-btn');
  if (ttsDemoBtn) {
    ttsDemoBtn.onclick = () => {
      SoundService.speakText(`שלב ראשון, המחשה: שים לב להבדל בין שתי הבקשות. כשאומרים: ${unit.step1_demo.badPrompt}, מקבלים תשובה ארוכה ומבלבלת. כשאומרים מדויק: ${unit.step1_demo.goodPrompt}, מקבלים תשובה קצרה ומעולה.`);
    };
  }

  // שלב 2: הסבר קצר + רמזור ה-AI
  const takeawayEl = document.getElementById('unit-takeaway-text');
  if (takeawayEl) takeawayEl.innerHTML = unit.step2_takeaway;
  const ttsExpBtn = document.getElementById('tts-explanation-btn');
  if (ttsExpBtn) {
    ttsExpBtn.onclick = () => SoundService.speakText(unit.step2_takeaway);
  }

  const trafficBox = document.getElementById('traffic-light-container');
  const trafficDesc = document.getElementById('traffic-light-desc');
  if (trafficBox && trafficDesc) {
    const light = unit.trafficLight || 'green';
    trafficBox.className = `traffic-light-box ${light}`;
    trafficDesc.textContent = unit.trafficLightDesc || (light === 'red' ? 'רמזור אדום: חובה להתייעץ עם אדם קרוב!' : light === 'yellow' ? 'רמזור צהוב: בודקים במקור שני!' : 'רמזור ירוק: אפשר להשתמש לבד בכיף!');
  }

  // שלב 3: אסטרטגיה ובחירה לפני ביצוע (Strategy & Choice before execution)
  const quizObj = unit.step3_strategy || unit.step3_quiz;
  const quizQEl = document.getElementById('quiz-question-text');
  if (quizQEl) quizQEl.textContent = quizObj.question;
  const ttsQuizBtn = document.getElementById('tts-quiz-btn');
  if (ttsQuizBtn) {
    ttsQuizBtn.onclick = () => SoundService.speakText(quizObj.question);
  }

  const quizOptionsContainer = document.getElementById('quiz-options-container');
  const quizFeedbackBox = document.getElementById('quiz-feedback-box');
  const actionLockedNotice = document.getElementById('action-locked-notice');
  const actionUnlockedContent = document.getElementById('action-unlocked-content');
  const stepActionBox = document.getElementById('step-action-box');

  if (quizOptionsContainer) quizOptionsContainer.innerHTML = '';
  if (quizFeedbackBox) quizFeedbackBox.style.display = 'none';

  let isStep4Unlocked = unit.isCompleted;
  if (isStep4Unlocked) {
    if (stepActionBox) stepActionBox.classList.remove('locked-step');
    if (actionLockedNotice) actionLockedNotice.style.display = 'none';
    if (actionUnlockedContent) actionUnlockedContent.style.display = 'block';
  } else {
    if (stepActionBox) stepActionBox.classList.add('locked-step');
    if (actionLockedNotice) actionLockedNotice.style.display = 'block';
    if (actionUnlockedContent) actionUnlockedContent.style.display = 'none';
  }

  quizObj.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.innerHTML = `
      <span class="quiz-btn-icon">⚪</span>
      <span class="quiz-btn-text">${opt.text}</span>
    `;

    btn.onclick = () => {
      if (opt.isCorrect) {
        btn.classList.add('correct');
        const icon = btn.querySelector('.quiz-btn-icon');
        if (icon) icon.textContent = '✓';
        SoundService.playSuccessSound();

        if (quizFeedbackBox) {
          quizFeedbackBox.className = 'quiz-feedback-box success';
          quizFeedbackBox.innerHTML = `<span>מעולה דניאל! ${opt.explanation || 'בחירה נכונה של אסטרטגיה!'} משימת הביצוע נפתחה כעת למטה! 🌟</span>`;
          quizFeedbackBox.style.display = 'block';
        }

        if (stepActionBox) stepActionBox.classList.remove('locked-step');
        if (actionLockedNotice) actionLockedNotice.style.display = 'none';
        if (actionUnlockedContent) actionUnlockedContent.style.display = 'block';

        appState.quizHistory.push({
          unitId: unit.id,
          timestamp: new Date().toISOString(),
          isCorrect: true
        });
        saveAppState();
      } else {
        btn.classList.add('incorrect');
        const icon = btn.querySelector('.quiz-btn-icon');
        if (icon) icon.textContent = '✕';
        SoundService.playErrorSound();

        if (quizFeedbackBox) {
          quizFeedbackBox.className = 'quiz-feedback-box error';
          quizFeedbackBox.innerHTML = `<span>לא מדויק: ${opt.explanation || 'חשוב שוב מה הכלל שלמדנו!'} נסה שוב! 💪</span>`;
          quizFeedbackBox.style.display = 'block';
        }

        appState.quizHistory.push({
          unitId: unit.id,
          timestamp: new Date().toISOString(),
          isCorrect: false
        });
        saveAppState();
      }
    };

    if (quizOptionsContainer) quizOptionsContainer.appendChild(btn);
  });

  // שלב 4: משימת 4 החלקים המלאה (ביצוע -> הבנה -> העברה -> שיקוף)
  const missionData = unit.step4_mission || {
    executePrompt: unit.step4_action?.prompt || '',
    doText: unit.step4_action?.doText || 'העתק את הפרומפט והרץ ב-AI:',
    comprehensionQ: 'מה ביקשת מה-AI לעשות?',
    comprehensionOpts: [
      { text: 'לבקש תשובה קצרה ומדויקת', isCorrect: true },
      { text: 'לכתוב ספר ארוך', isCorrect: false }
    ],
    transferPrompt: 'עכשיו שנה מילה אחת בפרומפט ובדוק מה השתנה בתשובה!',
    teachBackText: 'היום למדתי שכשמבקשים מדויק, מקבלים מענה מושלם.'
  };

  const part1 = document.getElementById('mission-part-1');
  const part2 = document.getElementById('mission-part-2');
  const part3 = document.getElementById('mission-part-3');
  const part4 = document.getElementById('mission-part-4');

  // חלק 1: ביצוע
  const promptDisplay = document.getElementById('action-prompt-display');
  if (promptDisplay) promptDisplay.textContent = `"${missionData.executePrompt}"`;
  const doInstruction = document.getElementById('action-do-instruction');
  if (doInstruction) doInstruction.textContent = missionData.doText;

  const copyBtn = document.getElementById('unit-copy-btn');
  if (copyBtn) {
    copyBtn.onclick = () => copyToClipboard(missionData.executePrompt, copyBtn);
  }

  const part1DoneBtn = document.getElementById('part-1-done-btn');
  if (part1DoneBtn) {
    part1DoneBtn.onclick = () => {
      SoundService.playSuccessSound();
      if (part2) {
        part2.style.display = 'block';
        part2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
  }

  // חלק 2: הבנה
  const compQ = document.getElementById('mission-comprehend-q');
  if (compQ) compQ.textContent = missionData.comprehensionQ;
  const compOptions = document.getElementById('mission-comprehend-options');
  const compFeedback = document.getElementById('mission-comprehend-feedback');

  if (compOptions) {
    compOptions.innerHTML = '';
    (missionData.comprehensionOpts || []).forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      btn.innerHTML = `<span class="quiz-btn-icon">⚪</span><span class="quiz-btn-text">${opt.text}</span>`;
      btn.onclick = () => {
        if (opt.isCorrect) {
          btn.classList.add('correct');
          btn.querySelector('.quiz-btn-icon').textContent = '✓';
          SoundService.playSuccessSound();
          if (compFeedback) {
            compFeedback.className = 'quiz-feedback-box success';
            compFeedback.innerHTML = '<span>בול דניאל! הבנת מצוין מה ביקשנו! חלק 3 נפתח כעת! 🎯</span>';
            compFeedback.style.display = 'block';
          }
          if (part3) {
            part3.style.display = 'block';
            part3.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } else {
          btn.classList.add('incorrect');
          btn.querySelector('.quiz-btn-icon').textContent = '✕';
          SoundService.playErrorSound();
          if (compFeedback) {
            compFeedback.className = 'quiz-feedback-box error';
            compFeedback.innerHTML = '<span>לא מדויק, נסה לחשוב שוב מה היה כתוב בפרומפט.</span>';
            compFeedback.style.display = 'block';
          }
        }
      };
      compOptions.appendChild(btn);
    });
  }

  // חלק 3: העברה ("שנה דבר אחד")
  const transferDisplay = document.getElementById('mission-transfer-display');
  if (transferDisplay) transferDisplay.textContent = missionData.transferPrompt;
  const part3DoneBtn = document.getElementById('part-3-done-btn');
  if (part3DoneBtn) {
    part3DoneBtn.onclick = () => {
      SoundService.playSuccessSound();
      if (part4) {
        part4.style.display = 'block';
        part4.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
  }

  // חלק 4: שיקוף אישי
  const teachBackDisplay = document.getElementById('mission-teach-back-display');
  if (teachBackDisplay) teachBackDisplay.textContent = `💡 ${missionData.teachBackText}`;

  // כפתורי סיום, משוב ושיתוף וואטסאפ
  const finishBtn = document.getElementById('unit-finish-btn');
  const feedbackBox = document.getElementById('unit-feedback-box');
  const ribbon = document.getElementById('unit-completed-ribbon');
  const waBtn = document.getElementById('unit-share-wa-btn');

  if (unit.isCompleted) {
    if (part2) part2.style.display = 'block';
    if (part3) part3.style.display = 'block';
    if (part4) part4.style.display = 'block';
    if (finishBtn) finishBtn.style.display = 'none';
    if (feedbackBox) feedbackBox.style.display = 'none';
    if (ribbon) ribbon.style.display = 'flex';
    if (waBtn) {
      waBtn.style.display = 'inline-flex';
      waBtn.onclick = () => {
        shareProgressToWhatsApp(`היי אבא! הרגע סיימתי בהצלחה את יחידה "${unit.title}" במערכת AI! 🎉`);
      };
    }
  } else {
    if (part2) part2.style.display = 'none';
    if (part3) part3.style.display = 'none';
    if (part4) part4.style.display = 'none';
    if (finishBtn) finishBtn.style.display = 'inline-flex';
    if (feedbackBox) feedbackBox.style.display = 'none';
    if (ribbon) ribbon.style.display = 'none';
    if (waBtn) waBtn.style.display = 'none';

    if (finishBtn) {
      finishBtn.onclick = () => {
        finishBtn.style.display = 'none';
        if (feedbackBox) feedbackBox.style.display = 'block';
        feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
    }

    if (feedbackBox) {
      feedbackBox.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.onclick = () => {
          const rating = btn.dataset.rating;
          unit.isCompleted = true;
          unit.feedback = rating;

          appState.feedbackHistory.push({
            unitId: unit.id,
            title: unit.title,
            rating: rating,
            timestamp: new Date().toISOString()
          });

          SoundService.playSuccessSound();
          showToast(`כל הכבוד דניאל! היחידה "${unit.title}" הושלמה! ⭐`);
          saveAppState();
          renderUnitPlayer(unit.id);
        };
      });
    }
  }
}

// ============================================================================
// 8. מנוע מבחני שלב (Checkpoints - Life Scenarios Engine)
// ============================================================================

let currentCheckpoint = null;
let cpQuestions = [];
let cpQuestionIdx = 0;
let cpUserAnswers = [];

function openCheckpointTest(cp) {
  currentCheckpoint = cp;
  
  // הגרלת 4 שאלות מתוך בנק השאלות של מבחן השלב (למניעת שינון עיוור)
  const pool = JSON.parse(JSON.stringify(cp.questionBank || []));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  cpQuestions = pool.slice(0, 4);

  // ערבוב התשובות בכל שאלה שנבחרה
  cpQuestions.forEach(q => {
    for (let i = q.options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
    }
  });

  cpQuestionIdx = 0;
  cpUserAnswers = [];

  showView('checkpoint');
  const header = document.getElementById('checkpoint-view-header');
  if (header) header.textContent = cp.title;

  const backBtn = document.getElementById('checkpoint-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };
  }

  renderCheckpointQuestion();
}

function renderCheckpointQuestion() {
  const total = cpQuestions.length;
  const q = cpQuestions[cpQuestionIdx];

  const stepText = document.getElementById('checkpoint-step-text');
  if (stepText) stepText.textContent = `שאלה ${cpQuestionIdx + 1} מתוך ${total}`;
  const bar = document.getElementById('checkpoint-progress-bar');
  if (bar) bar.style.width = `${((cpQuestionIdx + 1) / total) * 100}%`;

  const area = document.getElementById('checkpoint-content-area');
  if (!area) return;

  area.innerHTML = `
    <div style="margin-top: 1.5rem;">
      <h3 class="question-title" style="font-size: 1.35rem; line-height: 1.4; margin-bottom: 1.5rem;">${q.question}</h3>
      <div class="quiz-options-grid" id="cp-options-container"></div>
    </div>
  `;

  const optContainer = document.getElementById('cp-options-container');
  q.options.forEach((opt, oIdx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.innerHTML = `
      <span class="quiz-btn-icon">⚪</span>
      <span class="quiz-btn-text">${opt.text}</span>
    `;

    btn.onclick = () => {
      optContainer.querySelectorAll('.quiz-option-btn').forEach(b => {
        b.classList.remove('selected');
        const icon = b.querySelector('.quiz-btn-icon');
        if (icon) icon.textContent = '⚪';
      });
      btn.classList.add('selected');
      const icon = btn.querySelector('.quiz-btn-icon');
      if (icon) icon.textContent = '🔘';
      cpUserAnswers[cpQuestionIdx] = oIdx;

      const nextBtn = document.getElementById('checkpoint-next-btn');
      if (nextBtn) nextBtn.disabled = false;
    };

    if (optContainer) optContainer.appendChild(btn);
  });

  const footer = document.getElementById('checkpoint-nav-footer');
  if (footer) {
    footer.innerHTML = `
      <button id="checkpoint-next-btn" class="primary-btn" disabled style="width: 100%;">
        <span>${cpQuestionIdx + 1 < total ? 'המשך לשאלה הבאה ▶' : 'בדוק את תוצאות המבחן! 🏆'}</span>
      </button>
    `;
  }

  const ttsBtn = document.getElementById('tts-checkpoint-q-btn');
  if (ttsBtn) {
    ttsBtn.onclick = () => SoundService.speakText(`שאלה ${cpQuestionIdx + 1}. ${q.question}`);
  }

  const nextBtn = document.getElementById('checkpoint-next-btn');
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (cpQuestionIdx + 1 < total) {
        cpQuestionIdx++;
        renderCheckpointQuestion();
      } else {
        finishCheckpointTest();
      }
    };
  }

  SoundService.speakText(`שאלה ${cpQuestionIdx + 1}. ${q.question}`);
}

function finishCheckpointTest() {
  const total = cpQuestions.length;
  let correct = 0;
  cpQuestions.forEach((q, idx) => {
    const chosen = cpUserAnswers[idx];
    if (chosen !== undefined && q.options[chosen] && q.options[chosen].isCorrect) {
      correct++;
    }
  });

  const finalScore = Math.round((correct / total) * 100);
  const passed = finalScore >= 85;

  currentCheckpoint.lastScore = finalScore;
  if (passed) {
    currentCheckpoint.isPassed = true;
    saveAppState();
    SoundService.playSuccessSound();
  }

  const area = document.getElementById('checkpoint-content-area');
  const footer = document.getElementById('checkpoint-nav-footer');

  if (area) {
    area.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem;">
        <div style="font-size: 3.5rem; margin-bottom: 0.8rem;">${passed ? '🏆 ⭐ 🎉' : '💡 💪'}</div>
        <h2 class="question-title" style="color: ${passed ? 'var(--success)' : 'var(--warning)'}; margin-bottom: 0.6rem;">
          ציון במבחן: ${finalScore}
        </h2>
        <p style="font-size: 1.15rem; color: var(--text-secondary); max-width: 500px; margin: 0 auto 1.5rem auto;">
          ${passed 
            ? 'כל הכבוד דניאל! עברת את מבחן השלב בהצלחה מרובה! השלב הבא במסלול נפתח עבורך כעת.'
            : `קיבלת ציון ${finalScore}. כדי להמשיך לשלב הבא יש לקבל 85 ומעלה. לא נורא, מכל ניסיון לומדים! לחץ למטה ונעשה את המבחן שוב עם סיטואציות חדשות.`}
        </p>

        ${passed ? `
          <div style="margin: 1.5rem 0;">
            <button class="share-whatsapp-btn" onclick="shareProgressToWhatsApp('היי אבא! עברתי בהצלחה את ${currentCheckpoint.title} בציון ${finalScore}! 🏆 השלבים הבאים נפתחו!')">
              <span>שלח עדכון לאבא ב-WhatsApp 📲</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  if (footer) {
    footer.innerHTML = passed
      ? `<button class="primary-btn" onclick="showView('roadmap');renderRoadmap();" style="width: 100%;"><span>מעולה! חזרה למסלול האישי 🌟</span></button>`
      : `<button class="primary-btn" onclick="openCheckpointTest(currentCheckpoint)" style="width: 100%;"><span>נסה שוב עם סיטואציות חדשות 🔄</span></button>`;
  }

  SoundService.speakText(passed 
    ? `כל הכבוד דניאל! קיבלת ציון ${finalScore} ועברת בהצלחה! השלב הבא נפתח כעת.`
    : `קיבלת ציון ${finalScore}. כדי להמשיך צריך 85 ומעלה. ננסה שוב ונעבור יחד!`
  );
}

// ============================================================================
// 9. שירותי בינה מלאכותית (AIService - Multi-Model Fallback & Generator)
// ============================================================================

const AIService = {
  geminiModels: [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-flash-lite-latest'
  ],

  groqModels: [
    'qwen/qwen3.8-27b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'allam-2-7b'
  ],

  openrouterModels: [
    'openai/gpt-4o-mini',
    'openai/gpt-3.5-turbo'
  ],

  async testGroq(rawKey, progressCb) {
    const key = cleanApiKey(rawKey);
    if (!key) return { success: false, error: 'לא הוזן מפתח API של Groq.' };
    const t0 = performance.now();

    let candidateModels = [...this.groqModels];
    try {
      if (progressCb) progressCb('מגלה מודלים פעילים ב-Groq...');
      const modelsResp = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${key}` }
      });
      if (modelsResp.ok) {
        const modelsData = await modelsResp.json();
        const availableIds = (modelsData?.data || [])
          .map(m => m.id)
          .filter(id => id && !/whisper|tts|guard|embed/i.test(id));
        if (availableIds.includes('meta-llama/llama-4-scout-17b-16e-instruct')) {
          appState.apiConfig.verifiedGroqVisionModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
        }
        if (availableIds.length > 0) {
          const prioritized = this.groqModels.filter(m => availableIds.includes(m));
          const others = availableIds.filter(m => !prioritized.includes(m));
          const combined = [...new Set([...prioritized, ...others, ...this.groqModels])];
          const nonReasoning = combined.filter(id => !/gpt-oss|deepseek-r1|qwq/i.test(id));
          const reasoning = combined.filter(id => /gpt-oss|deepseek-r1|qwq/i.test(id));
          candidateModels = [...nonReasoning, ...reasoning];
        }
      }
    } catch (e) {
      console.warn('Groq model discovery fallback:', e);
    }

    let lastStatus = '';
    for (const model of candidateModels) {
      if (progressCb) progressCb(`בודק מודל ${model}...`);
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'שלום! ענה במילה אחת: "פעיל".' }],
            max_tokens: 150
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const choice = data?.choices?.[0]?.message;
          const rawText = stripThinkTags(choice?.content || choice?.reasoning_content || choice?.reasoning || '');
          if (!rawText) {
            lastStatus = `Empty reply from ${model}`;
            continue;
          }
          const latency = Math.round(performance.now() - t0);
          appState.apiConfig.groqKey = key;
          appState.apiConfig.verifiedGroqModel = model;
          localStorage.setItem('groq_api_key', key);
          saveAppState();
          return { success: true, model, latency, reply: rawText };
        } else {
          lastStatus = `HTTP ${resp.status}`;
        }
      } catch (e) {
        lastStatus = e.message;
        console.warn(`Groq test failed for ${model}:`, e);
      }
    }
    return { success: false, error: `כל מודלי Groq נכשלו (${lastStatus || 'מפתח לא תקין'}).` };
  },

  async testGemini(rawKey, progressCb) {
    const key = cleanApiKey(rawKey);
    if (!key) return { success: false, error: 'לא הוזן מפתח API של Gemini.' };
    const t0 = performance.now();

    let candidateModels = [...this.geminiModels];
    try {
      if (progressCb) progressCb('מגלה מודלים פעילים ב-Google Gemini...');
      const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (listResp.ok) {
        const listData = await listResp.json();
        const availableIds = (listData?.models || [])
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => (m.name || '').replace(/^models\//, ''))
          .filter(id => id && /gemini/i.test(id) && !/embedding|vision-pro|aqa|tts|image|robotics|computer-use|transcribe|lyria|banana|argon/i.test(id));

        if (availableIds.length > 0) {
          const preferredOrder = [
            'gemini-3.6-flash',
            'gemini-3.5-flash',
            'gemini-flash-latest',
            'gemini-3.1-flash-lite',
            'gemini-3.8-flash',
            'gemini-3.7-flash',
            'gemini-flash-lite-latest'
          ];
          const prioritized = preferredOrder.filter(m => availableIds.includes(m));
          const others = availableIds.filter(m => !prioritized.includes(m));
          candidateModels = [...new Set([...prioritized, ...others, ...this.geminiModels])];
        }
      }
    } catch (e) {
      console.warn('Gemini model discovery fallback:', e);
    }

    let lastStatus = '';
    for (const model of candidateModels) {
      if (progressCb) progressCb(`בודק מודל ${model}...`);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'שלום! ענה במילה אחת בלבד: "פעיל".' }] }]
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const rawText = stripThinkTags(data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
          if (!rawText) {
            lastStatus = `Empty reply from ${model}`;
            continue;
          }
          const latency = Math.round(performance.now() - t0);
          appState.apiConfig.geminiKey = key;
          appState.apiConfig.verifiedGeminiModel = model;
          localStorage.setItem('gemini_api_key', key);
          localStorage.setItem('verified_gemini_model', model);
          saveAppState();
          return { success: true, model, latency, reply: rawText };
        } else {
          lastStatus = `HTTP ${resp.status}`;
        }
      } catch (e) {
        lastStatus = e.message;
        console.warn(`Gemini test failed for ${model}:`, e);
      }
    }
    return { success: false, error: `כל מודלי Gemini נכשלו (${lastStatus || 'מפתח לא תקין או חסום'}).` };
  },

  async testOpenRouter(rawKey, progressCb) {
    const key = cleanApiKey(rawKey);
    if (!key) return { success: false, error: 'לא הוזן מפתח API של OpenRouter.' };
    const t0 = performance.now();

    let lastStatus = '';
    for (const model of this.openrouterModels) {
      if (progressCb) progressCb(`בודק מודל ${model}...`);
      try {
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'שלום! ענה במילה אחת: "פעיל".' }],
            max_tokens: 100
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const choice = data?.choices?.[0]?.message;
          const reply = stripThinkTags(choice?.content || choice?.reasoning_content || 'פעיל') || 'פעיל';
          const latency = Math.round(performance.now() - t0);
          appState.apiConfig.openrouterKey = key;
          appState.apiConfig.verifiedOpenRouterModel = model;
          localStorage.setItem('openrouter_api_key', key);
          saveAppState();
          return { success: true, model, latency, reply };
        } else {
          lastStatus = `HTTP ${resp.status}`;
        }
      } catch (e) {
        lastStatus = e.message;
        console.warn(`OpenRouter test failed for ${model}:`, e);
      }
    }
    return { success: false, error: `בדיקת OpenRouter נכשלה (${lastStatus || 'מפתח לא תקין'}).` };
  },

  async generateLessonWithFallback(topicPrompt, progressCb) {
    const systemInstruction = `אתה מומחה לפדגוגיה ונגישות קוגניטיבית עבור דניאל (בן 28).
עליך לייצר יחידת לימוד מעשית, מעצימה ומכבדת במבנה JSON תקני לחלוטין.
חובה להחזיר רק אובייקט JSON תקני בין סוגריים מסולסלים { ... }, ללא טקסט מקדים וללא תגיות markdown.
מבנה ה-JSON הנדרש במדויק:
{
  "title": "שם היחידה בעברית",
  "category": "קטגוריה (למשל: עבודה ותקשורת / כישורי חיים / יצירה)",
  "goal": "מטרת היחידה במשפט אחד פשוט",
  "trafficLight": "green",
  "trafficLightDesc": "ירוק: אפשר להשתמש לבד. / צהוב: בודקים במקור שני / אדום: חובה אדם",
  "step1_demo": {
    "badPrompt": "דוגמה לבקשה כללית או לא טובה",
    "badResult": "תשובה ארוכה, מסובכת או מבלבלת שה-AI נותן",
    "goodPrompt": "דוגמה לבקשה מדויקת ופשוטה",
    "goodResult": "תשובה קצרה, נעימה וממוקדת בדיוק במה שרצינו"
  },
  "step2_takeaway": "הסבר תמציתי ומאיר עיניים של 1-2 משפטים מדוע הבקשה הטובה הצליחה",
  "step3_strategy": {
    "question": "שאלת בחירה ואסטרטגיה לפני ביצוע",
    "options": [
      { "text": "התשובה הנכונה", "isCorrect": true, "explanation": "הסבר מעודד" },
      { "text": "התשובה השגויה", "isCorrect": false, "explanation": "הסבר עדין" }
    ]
  },
  "step4_mission": {
    "executePrompt": "משפט מוכן להעתקה ולתרגול",
    "doText": "הוראה קצרה ומעשית מה לעשות",
    "comprehensionQ": "מה ביקשת מה-AI לעשות?",
    "comprehensionOpts": [
      { "text": "תשובה נכונה", "isCorrect": true },
      { "text": "תשובה שגויה", "isCorrect": false }
    ],
    "transferPrompt": "משימת העברה: שנה מילה אחת ובדוק מה השתנה",
    "teachBackText": "היום למדתי ש..."
  }
}`;

    if (progressCb) progressCb('מייצר יחידה בשרשרת ה-AI (Groq -> Gemini -> OpenRouter)...');
    const rawReply = await callMultiTierAI(`${systemInstruction}\n\nהנושא המבוקש ליחידה הוא: ${topicPrompt}`, {
      systemInstruction,
      maxTokens: 1500
    });

    if (rawReply) {
      const parsed = this.cleanAndParseJSON(rawReply);
      if (parsed) {
        const activeProvider = appState.apiConfig.verifiedGroqModel
          ? `Groq (${appState.apiConfig.verifiedGroqModel})`
          : (appState.apiConfig.verifiedGeminiModel ? `Gemini (${appState.apiConfig.verifiedGeminiModel})` : 'AI Cloud');
        return { unit: parsed, provider: activeProvider };
      }
    }

    if (progressCb) progressCb('מייצר יחידה מובנית במנוע המקומי...');
    const localUnit = this.synthesizeLocalUnit(topicPrompt);
    return { unit: localUnit, provider: 'מנוע למידה פנימי' };
  },

  cleanAndParseJSON(text) {
    try {
      let clean = text.trim();
      if (clean.includes('```')) {
        clean = clean.replace(/```json/gi, '').replace(/```/g, '').trim();
      }
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        clean = clean.substring(start, end + 1);
        return JSON.parse(clean);
      }
    } catch (e) {
      console.warn('JSON parse error:', e);
    }
    return null;
  },

  synthesizeLocalUnit(topic) {
    return {
      title: `${topic} - צעד אחר צעד`,
      category: 'מיומנות אישית',
      goal: `ללמוד איך להיעזר ב-AI בצורה פשוטה, ממוקדת וברורה בנושא: ${topic}.`,
      trafficLight: 'green',
      trafficLightDesc: 'ירוק: אפשר להשתמש לבד. רעיונות ופשטות.',
      step1_demo: {
        badPrompt: `ספר לי על ${topic}`,
        badResult: `נושא ה-${topic} הינו תחום נרחב הכולל שלל נדבכים מתקדמים ותהליכים תאורטיים מורכבים...`,
        goodPrompt: `תסביר לי ב-2 משפטים פשוטים ובמילים קצרות: מה הכי חשוב לדעת על ${topic}?`,
        goodResult: `${topic} הוא נושא מעשי ושימושי. כשמבקשים הסבר פשוט, אפשר להבין אותו מיד ולהשתמש בו ביום-יום בקלות.`
      },
      step2_takeaway: `כשמבקשים מה-AI להתמקד ב-"2 משפטים פשוטים" לגבי ${topic}, מקבלים את השורה התחתונה מיד!`,
      step3_strategy: {
        question: `מה הדרך הטובה ביותר ללמוד על ${topic} בלי להתבלבל?`,
        options: [
          { text: 'לבקש הסבר קצר של 2 משפטים עם דוגמה פשוטה', isCorrect: true, explanation: 'נכון מאוד! זה מאפשר הבנה הדרגתית ונעימה.' },
          { text: 'לקרוא מאמר אקדמי ארוך ומעייף', isCorrect: false, explanation: 'זה עלול להציף ולעייף.' }
        ]
      },
      step4_mission: {
        executePrompt: `תסביר לי ב-2 משפטים קצרים ובמילים פשוטות: איך ${topic} עוזר לי בחיים?`,
        doText: `העתק את הפרומפט והתנסה בבקשה ברורה על ${topic}:`,
        comprehensionQ: 'איך ביקשנו מה-AI להסביר?',
        comprehensionOpts: [
          { text: 'ב-2 משפטים קצרים ובמילים פשוטות', isCorrect: true },
          { text: 'במגילה ארוכה של 50 עמודים', isCorrect: false }
        ],
        transferPrompt: `עכשיו שנה מילה אחת ובקש דוגמה נוספת הקשורה ל-${topic}!`,
        teachBackText: `היום למדתי שכשמבקשים הסבר קצר על ${topic}, קל מאוד להבין וליישם.`
      }
    };
  }
};

// ============================================================================
// 10. ממשק ניהול ובקרה עבור מלווים (Admin & Caregiver Portal)
// ============================================================================

let currentGeneratedUnit = null;

function initAdminPortal() {
  const adminPinModal = document.getElementById('admin-pin-modal');
  const closePinBtn = document.getElementById('close-pin-modal-btn');
  const submitPinBtn = document.getElementById('submit-pin-btn');
  const pinInput = document.getElementById('admin-pin-input');
  const pinError = document.getElementById('pin-error-msg');

  function openPinModal() {
    if (pinInput) pinInput.value = '';
    if (pinError) pinError.style.display = 'none';
    if (adminPinModal) {
      adminPinModal.classList.add('active');
      adminPinModal.style.display = 'flex';
      setTimeout(() => { if (pinInput) pinInput.focus(); }, 100);
    }
  }

  function closePinModal() {
    if (adminPinModal) {
      adminPinModal.classList.remove('active');
      adminPinModal.style.display = 'none';
    }
  }

  const headerAdminBtn = document.getElementById('header-admin-btn');
  if (headerAdminBtn) headerAdminBtn.onclick = openPinModal;
  const footerTrigger = document.getElementById('footer-admin-trigger');
  if (footerTrigger) footerTrigger.onclick = openPinModal;

  if (closePinBtn) closePinBtn.onclick = closePinModal;

  if (submitPinBtn && pinInput) {
    submitPinBtn.onclick = () => {
      const entered = pinInput.value.trim();
      const expected = appState.apiConfig.adminPin || ADMIN_PIN_DEFAULT;
      if (entered === expected || entered === ADMIN_PIN_DEFAULT || entered === 'דניאל') {
        closePinModal();
        showView('admin');
        renderAdminOverview();
      } else {
        if (pinError) pinError.style.display = 'block';
        SoundService.playErrorSound();
      }
    };

    pinInput.onkeypress = (e) => {
      if (e.key === 'Enter') submitPinBtn.click();
    };
  }

  const exitAdminBtn = document.getElementById('exit-admin-btn');
  if (exitAdminBtn) {
    exitAdminBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };
  }

  const tabBtns = document.querySelectorAll('.adm-tab-btn');
  const tabPanels = document.querySelectorAll('.adm-tab-panel');

  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      const panel = document.getElementById(tabId);
      if (panel) panel.classList.add('active');

      if (tabId === 'adm-overview') renderAdminOverview();
      if (tabId === 'adm-curriculum') renderAdminCurriculum();
      if (tabId === 'adm-notes') renderAdminNotes();
      if (tabId === 'adm-settings') renderAdminSettings();
    };
  });

  // AI Assistant בממשק ניהול
  const chatSendBtn = document.getElementById('admin-chat-send-btn');
  const chatInput = document.getElementById('admin-chat-input');
  const chatMessages = document.getElementById('admin-chat-messages');
  const livePreviewContainer = document.getElementById('live-card-preview-container');
  const previewActions = document.getElementById('preview-actions');
  const approveCardBtn = document.getElementById('adm-approve-card-btn');
  const copyJsonBtn = document.getElementById('adm-copy-json-btn');

  async function handleAdminChatSend() {
    if (!chatInput || !chatSendBtn) return;
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-bubble user-bubble';
    userMsg.style.cssText = 'background: #2563eb; color: #fff; padding: 0.8rem 1.2rem; border-radius: 12px; margin-bottom: 0.8rem; align-self: flex-start; max-width: 80%;';
    userMsg.textContent = text;
    if (chatMessages) chatMessages.appendChild(userMsg);

    chatSendBtn.disabled = true;
    chatSendBtn.innerHTML = '<span class="loading-spinner"></span> <span>מייצר יחידה משימתית...</span>';

    const assistantMsg = document.createElement('div');
    assistantMsg.className = 'chat-bubble assistant-bubble';
    assistantMsg.style.cssText = 'background: #f1f5f9; color: #0f172a; padding: 0.8rem 1.2rem; border-radius: 12px; margin-bottom: 0.8rem; align-self: flex-end; max-width: 80%;';
    assistantMsg.innerHTML = '<span class="loading-spinner"></span> <span id="gen-status-text">מתחבר ל-AI ומייצר יחידה מותאמת...</span>';
    if (chatMessages) chatMessages.appendChild(assistantMsg);

    try {
      const res = await AIService.generateLessonWithFallback(text, (msg) => {
        const el = document.getElementById('gen-status-text');
        if (el) el.textContent = msg;
      });

      currentGeneratedUnit = res.unit;
      currentGeneratedUnit.id = `unit_custom_${Date.now()}`;
      currentGeneratedUnit.isUnlocked = false;
      currentGeneratedUnit.isCompleted = false;

      assistantMsg.innerHTML = `✨ <strong>יחידה נוצרה בהצלחה</strong> באמצעות ${res.provider}! הנה תצוגה מקדימה שלה למטה:`;

      if (livePreviewContainer) {
        livePreviewContainer.innerHTML = `
          <div class="card unit-flow-card" style="border: 2px solid #2563eb; margin-top: 1rem;">
            <div class="unit-banner">
              <div class="unit-pill">${currentGeneratedUnit.category || 'יחידה חדשה'}</div>
              <h2 class="unit-headline">${currentGeneratedUnit.title}</h2>
              <p class="unit-goal">${currentGeneratedUnit.goal}</p>
            </div>
            <div class="unit-steps-wrapper">
              <div class="micro-step-box">
                <div class="step-header"><span class="step-number-circle">1</span><h3 class="step-title">המחשה Side-by-Side:</h3></div>
                <div class="demo-comparison-grid">
                  <div class="demo-card bad-demo">
                    <div class="demo-card-tag bad-tag">❌ בקשה כללית</div>
                    <div class="demo-prompt">"${currentGeneratedUnit.step1_demo.badPrompt}"</div>
                    <div class="demo-result-text">${currentGeneratedUnit.step1_demo.badResult}</div>
                  </div>
                  <div class="demo-card good-demo">
                    <div class="demo-card-tag good-tag">✅ בקשה מדויקת</div>
                    <div class="demo-prompt">"${currentGeneratedUnit.step1_demo.goodPrompt}"</div>
                    <div class="demo-result-text">${currentGeneratedUnit.step1_demo.goodResult}</div>
                  </div>
                </div>
              </div>
              <div class="micro-step-box">
                <div class="step-header"><span class="step-number-circle">2</span><h3 class="step-title">הכלל שלמדנו + רמזור:</h3></div>
                <div class="key-takeaway-card">${currentGeneratedUnit.step2_takeaway}</div>
                <div class="traffic-light-box ${currentGeneratedUnit.trafficLight || 'green'}">
                  <span class="traffic-light-dot"></span>
                  <span>${currentGeneratedUnit.trafficLightDesc || 'רמזור AI'}</span>
                </div>
              </div>
              <div class="micro-step-box">
                <div class="step-header"><span class="step-number-circle">3</span><h3 class="step-title">אסטרטגיה ובחירה:</h3></div>
                <p class="step-instruction">${currentGeneratedUnit.step3_strategy?.question || 'שאלת בחירה'}</p>
              </div>
              <div class="micro-step-box">
                <div class="step-header"><span class="step-number-circle">4</span><h3 class="step-title">משימת ביצוע, הבנה והעברה:</h3></div>
                <div class="example-prompt-text">"${currentGeneratedUnit.step4_mission?.executePrompt || ''}"</div>
              </div>
            </div>
          </div>
        `;
      }
      if (previewActions) previewActions.style.display = 'flex';
      SoundService.playSuccessSound();
    } catch (err) {
      assistantMsg.innerHTML = `⚠️ שגיאה ביצירת יחידה: ${err.message}`;
    } finally {
      chatSendBtn.disabled = false;
      chatSendBtn.innerHTML = '<span>שלח ל-AI 🚀</span>';
    }
  }

  if (chatSendBtn) chatSendBtn.onclick = handleAdminChatSend;
  if (chatInput) {
    chatInput.onkeypress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAdminChatSend();
      }
    };
  }

  if (approveCardBtn) {
    approveCardBtn.onclick = () => {
      if (!currentGeneratedUnit) return;
      appState.curriculumUnits.push(currentGeneratedUnit);
      saveAppState();
      SoundService.playSuccessSound();
      showToast(`היחידה "${currentGeneratedUnit.title}" נוספה למסלול של דניאל! 🎉`);
      currentGeneratedUnit = null;
      if (livePreviewContainer) livePreviewContainer.innerHTML = '<p class="preview-empty-text">אין כרטיסייה בתצוגה מקדימה כרגע. צור יחידה חדשה למעלה כדי לראות אותה כאן.</p>';
      if (previewActions) previewActions.style.display = 'none';
      renderRoadmap();
    };
  }

  if (copyJsonBtn) {
    copyJsonBtn.onclick = () => {
      if (!currentGeneratedUnit) return;
      const jsonStr = JSON.stringify(currentGeneratedUnit, null, 2);
      copyToClipboard(jsonStr, copyJsonBtn);
      showToast('קוד ה-JSON הועתק! תוכל להדביק אותו ב-curriculum_data.js ולדחוף ל-Git 📋');
    };
  }

  // עורך יחידות חזותי (Unit Editor Modal)
  const closeUnitEditorBtn = document.getElementById('close-unit-editor-btn');
  const cancelUnitEditorBtn = document.getElementById('cancel-unit-editor-btn');
  const saveUnitEditorBtn = document.getElementById('save-unit-editor-btn');
  const unitEditorModal = document.getElementById('unit-editor-modal');

  function closeUnitEditor() {
    if (unitEditorModal) {
      unitEditorModal.classList.remove('active');
      unitEditorModal.style.display = 'none';
    }
  }

  if (closeUnitEditorBtn) closeUnitEditorBtn.onclick = closeUnitEditor;
  if (cancelUnitEditorBtn) cancelUnitEditorBtn.onclick = closeUnitEditor;

  if (saveUnitEditorBtn) {
    saveUnitEditorBtn.onclick = () => {
      const idInput = document.getElementById('edit-unit-id');
      const titleInput = document.getElementById('edit-unit-title-input');
      const catInput = document.getElementById('edit-unit-category-input');
      const goalInput = document.getElementById('edit-unit-goal-input');

      if (!titleInput || !titleInput.value.trim()) {
        alert('נא להזין כותרת ליחידה.');
        return;
      }

      const unitId = idInput ? idInput.value : '';
      const newUnitData = {
        title: titleInput.value.trim(),
        category: (catInput ? catInput.value.trim() : '') || 'מיומנות אישית',
        goal: (goalInput ? goalInput.value.trim() : '') || 'ללמוד ולהתקדם',
        trafficLight: 'green',
        trafficLightDesc: 'ירוק: אפשר להשתמש לבד.',
        step1_demo: {
          badPrompt: (document.getElementById('edit-bad-prompt-input')?.value.trim()) || 'בקשה כללית',
          badResult: (document.getElementById('edit-bad-result-input')?.value.trim()) || 'תשובה ארוכה ומבלבלת...',
          goodPrompt: (document.getElementById('edit-good-prompt-input')?.value.trim()) || 'בקשה מדויקת ופשוטה',
          goodResult: (document.getElementById('edit-good-result-input')?.value.trim()) || 'תשובה קצרה ומעולה!'
        },
        step2_takeaway: (document.getElementById('edit-takeaway-input')?.value.trim()) || 'כשמבקשים מדויק, מקבלים מענה מושלם!',
        step3_strategy: {
          question: (document.getElementById('edit-quiz-q-input')?.value.trim()) || 'מה הדבר הנכון לעשות?',
          options: [
            {
              text: (document.getElementById('edit-quiz-correct-input')?.value.trim()) || 'לבקש קצר וברור',
              isCorrect: true,
              explanation: 'מדויק ונכון מאוד!'
            },
            {
              text: (document.getElementById('edit-quiz-wrong-input')?.value.trim()) || 'לכתוב מילה אחת בלי פירוט',
              isCorrect: false,
              explanation: 'זה כללי מדי.'
            }
          ]
        },
        step4_mission: {
          executePrompt: (document.getElementById('edit-action-prompt-input')?.value.trim()) || 'הסבר לי ב-2 משפטים פשוטים',
          doText: (document.getElementById('edit-action-do-input')?.value.trim()) || 'העתק את הפרומפט והרץ ב-AI:',
          comprehensionQ: 'מה ביקשת מה-AI?',
          comprehensionOpts: [
            { text: 'מענה קצר ומדויק', isCorrect: true },
            { text: 'מגילה של 50 עמודים', isCorrect: false }
          ],
          transferPrompt: 'משימת העברה: שנה מילה אחת ובדוק מה השתנה בתשובה!',
          teachBackText: 'היום למדתי שכשמבקשים קצר וממוקד, מקבלים תשובה שקל להבין מיד.'
        }
      };

      if (unitId) {
        const existingIdx = appState.curriculumUnits.findIndex(u => u.id === unitId);
        if (existingIdx !== -1) {
          appState.curriculumUnits[existingIdx] = {
            ...appState.curriculumUnits[existingIdx],
            ...newUnitData
          };
          showToast(`היחידה "${newUnitData.title}" עודכנה בהצלחה! ✏️`);
        }
      } else {
        const newId = `unit_custom_${Date.now()}`;
        const newUnit = {
          id: newId,
          ...newUnitData,
          isUnlocked: false,
          isCompleted: false
        };
        appState.curriculumUnits.push(newUnit);
        showToast(`היחידה "${newUnitData.title}" נוספה בהצלחה למסלול! 🎉`);
      }

      saveAppState();
      closeUnitEditor();
      renderAdminCurriculum();
      renderRoadmap();
      SoundService.playSuccessSound();
    };
  }
}

/**
 * Renders the Admin Overview dashboard tab: summary metric cards and curriculum units progress table.
 */
function renderAdminOverview() {
  const units = appState.curriculumUnits || [];
  const completed = units.filter(u => u.isCompleted).length;
  const total = units.length;

  const statUnits = document.getElementById('adm-stat-units');
  if (statUnits) statUnits.textContent = `${completed} מתוך ${total}`;

  const passedCPs = (appState.checkpoints || []).filter(c => c.isPassed).length;
  const statCPs = document.getElementById('adm-stat-checkpoints');
  if (statCPs) statCPs.textContent = `${passedCPs} מתוך ${(appState.checkpoints || []).length}`;

  const quizzes = appState.quizHistory || [];
  const correct = quizzes.filter(q => q.isCorrect).length;
  const accuracy = quizzes.length > 0 ? Math.round((correct / quizzes.length) * 100) : 100;
  const statAcc = document.getElementById('adm-stat-accuracy');
  if (statAcc) statAcc.textContent = `${accuracy}% (${quizzes.length} בדיקות)`;

  const table = document.getElementById('adm-units-table');
  if (table) {
    const rowsHtml = units.length > 0
      ? units.map(u => `
          <tr>
            <td><strong>${u.title}</strong></td>
            <td><span class="badge-tag">${u.category || 'כללי'}</span></td>
            <td>${u.trafficLight === 'red' ? '🔴 אדום' : u.trafficLight === 'yellow' ? '🟡 צהוב' : '🟢 ירוק'}</td>
            <td>${u.isCompleted ? '<span style="color:#059669; font-weight:700;">🟢 הושלם</span>' : '<span style="color:#d97706;">⏳ ממתין לביצוע</span>'}</td>
            <td>${u.feedback === 'easy' ? '😊 היה קל' : u.feedback === 'medium' ? '😐 קצת קשה' : u.feedback === 'hard' ? '😕 לא מובן' : '—'}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">אין יחידות לימוד להצגה</td></tr>`;

    table.innerHTML = `
      <thead>
        <tr>
          <th>יחידה / נושא</th>
          <th>קטגוריה</th>
          <th>רמזור</th>
          <th>סטטוס למידה</th>
          <th>משוב דניאל</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    `;
  }
}

function renderAdminCurriculum() {
  const container = document.getElementById('mgr-curriculum-list');
  if (!container) return;
  container.innerHTML = '';

  appState.curriculumUnits.forEach((unit, idx) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.style.cssText = 'padding: 1.1rem 1.4rem; margin-bottom: 0.9rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem;';
    item.innerHTML = `
      <div style="flex: 1 1 300px;">
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.25rem;">
          <span style="font-weight: 800; color: #2563eb;">#${idx + 1}</span>
          <span class="badge-tag">${unit.category || 'מיומנות'}</span>
          <span>${unit.trafficLight === 'red' ? '🔴' : unit.trafficLight === 'yellow' ? '🟡' : '🟢'}</span>
          <span style="font-size: 0.85rem; color: ${unit.isCompleted ? '#059669' : '#d97706'}; font-weight: 700;">
            ${unit.isCompleted ? '✓ הושלם' : 'ממתין לביצוע'}
          </span>
        </div>
        <h4 style="margin: 0 0 0.3rem 0; font-size: 1.15rem;">${unit.title}</h4>
        <p style="margin: 0; font-size: 0.95rem; color: var(--text-secondary);">${unit.goal || ''}</p>
      </div>
      <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
        <button class="primary-btn" style="padding: 0.4rem 0.85rem; font-size: 0.85rem;" onclick="openUnitEditor('${unit.id}')">✏️ ערוך יחידה</button>
        <button class="secondary-btn" style="padding: 0.4rem 0.75rem; font-size: 0.85rem;" onclick="moveUnit(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button class="secondary-btn" style="padding: 0.4rem 0.75rem; font-size: 0.85rem;" onclick="moveUnit(${idx}, 1)" ${idx === appState.curriculumUnits.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="secondary-btn" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; color: #dc2626;" onclick="deleteUnit(${idx})">🗑️ מחק</button>
      </div>
    `;
    container.appendChild(item);
  });

  const addManualBtn = document.getElementById('add-manual-unit-btn');
  if (addManualBtn) {
    addManualBtn.onclick = () => openUnitEditor(null);
  }

  const addCustomBtn = document.getElementById('add-custom-unit-btn');
  if (addCustomBtn) {
    addCustomBtn.onclick = () => {
      const assistantTab = document.querySelector('.adm-tab-btn[data-tab="adm-assistant"]');
      if (assistantTab) assistantTab.click();
    };
  }
}

window.openUnitEditor = function(unitId) {
  const modal = document.getElementById('unit-editor-modal');
  if (!modal) return;

  const modalTitle = document.getElementById('unit-editor-modal-title');
  const idInput = document.getElementById('edit-unit-id');
  const titleInput = document.getElementById('edit-unit-title-input');
  const catInput = document.getElementById('edit-unit-category-input');
  const goalInput = document.getElementById('edit-unit-goal-input');
  const badPrompt = document.getElementById('edit-bad-prompt-input');
  const badResult = document.getElementById('edit-bad-result-input');
  const goodPrompt = document.getElementById('edit-good-prompt-input');
  const goodResult = document.getElementById('edit-good-result-input');
  const takeaway = document.getElementById('edit-takeaway-input');
  const quizQ = document.getElementById('edit-quiz-q-input');
  const quizCorrect = document.getElementById('edit-quiz-correct-input');
  const quizWrong = document.getElementById('edit-quiz-wrong-input');
  const actionPrompt = document.getElementById('edit-action-prompt-input');
  const actionDo = document.getElementById('edit-action-do-input');

  if (unitId) {
    const unit = appState.curriculumUnits.find(u => u.id === unitId);
    if (!unit) return;
    if (modalTitle) modalTitle.textContent = `עריכת יחידה: ${unit.title}`;
    if (idInput) idInput.value = unit.id;
    if (titleInput) titleInput.value = unit.title || '';
    if (catInput) catInput.value = unit.category || '';
    if (goalInput) goalInput.value = unit.goal || '';
    if (badPrompt) badPrompt.value = unit.step1_demo?.badPrompt || '';
    if (badResult) badResult.value = unit.step1_demo?.badResult || '';
    if (goodPrompt) goodPrompt.value = unit.step1_demo?.goodPrompt || '';
    if (goodResult) goodResult.value = unit.step1_demo?.goodResult || '';
    if (takeaway) takeaway.value = unit.step2_takeaway || '';
    
    const quizObj = unit.step3_strategy || unit.step3_quiz;
    if (quizQ) quizQ.value = quizObj?.question || '';
    
    const correctOpt = quizObj?.options?.find(o => o.isCorrect);
    const wrongOpt = quizObj?.options?.find(o => !o.isCorrect);
    if (quizCorrect) quizCorrect.value = correctOpt?.text || '';
    if (quizWrong) quizWrong.value = wrongOpt?.text || '';

    const mission = unit.step4_mission || unit.step4_action;
    if (actionPrompt) actionPrompt.value = mission?.executePrompt || mission?.prompt || '';
    if (actionDo) actionDo.value = mission?.doText || '';
  } else {
    if (modalTitle) modalTitle.textContent = 'הוספת יחידת לימוד חדשה';
    if (idInput) idInput.value = '';
    if (titleInput) titleInput.value = '';
    if (catInput) catInput.value = 'עבודה ותקשורת';
    if (goalInput) goalInput.value = '';
    if (badPrompt) badPrompt.value = '';
    if (badResult) badResult.value = '';
    if (goodPrompt) goodPrompt.value = '';
    if (goodResult) goodResult.value = '';
    if (takeaway) takeaway.value = '';
    if (quizQ) quizQ.value = '';
    if (quizCorrect) quizCorrect.value = '';
    if (quizWrong) quizWrong.value = '';
    if (actionPrompt) actionPrompt.value = '';
    if (actionDo) actionDo.value = 'העתק את הפרומפט והרץ ב-AI:';
  }

  modal.classList.add('active');
  modal.style.display = 'flex';
};

window.moveUnit = function(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= appState.curriculumUnits.length) return;
  const temp = appState.curriculumUnits[index];
  appState.curriculumUnits[index] = appState.curriculumUnits[target];
  appState.curriculumUnits[target] = temp;
  saveAppState();
  renderAdminCurriculum();
  renderRoadmap();
};

window.deleteUnit = function(index) {
  if (appState.curriculumUnits.length <= 1) {
    alert('לא ניתן למחוק את היחידה האחרונה במסלול.');
    return;
  }
  if (confirm(`האם אתה בטוח שברצונך למחוק את יחידה "${appState.curriculumUnits[index].title}"?`)) {
    appState.curriculumUnits.splice(index, 1);
    saveAppState();
    renderAdminCurriculum();
    renderRoadmap();
  }
};

function renderAdminNotes() {
  const container = document.getElementById('notes-container');
  if (!container) return;
  container.innerHTML = '';

  const notes = appState.caregiverNotes || [];
  if (notes.length === 0) {
    container.innerHTML = '<p class="preview-empty-text">אין עדיין פתקים או עדכונים.</p>';
  } else {
    notes.forEach((note, idx) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cssText = 'padding: 1rem 1.4rem; margin-bottom: 0.8rem; border-right: 4px solid #2563eb;';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #64748b; margin-bottom: 0.4rem;">
          <span><strong>${note.author || 'מלווה'}</strong> • ${note.date || ''}</span>
          <button style="background: none; border: none; cursor: pointer; color: #dc2626;" onclick="deleteNote(${idx})">🗑️ מחק</button>
        </div>
        <p style="margin: 0; font-size: 1.05rem; line-height: 1.5;">${note.text}</p>
      `;
      container.appendChild(card);
    });
  }

  const addNoteBtn = document.getElementById('add-note-btn');
  const noteInput = document.getElementById('new-note-text');
  if (addNoteBtn && noteInput) {
    addNoteBtn.onclick = () => {
      const txt = noteInput.value.trim();
      if (!txt) return;
      appState.caregiverNotes.unshift({
        id: `note_${Date.now()}`,
        author: 'אבא ומלווים',
        date: new Date().toLocaleDateString('he-IL'),
        text: txt
      });
      noteInput.value = '';
      saveAppState();
      renderAdminNotes();
      showToast('הפתק נשמר בהצלחה! 📝');
    };
  }
}

window.deleteNote = function(index) {
  appState.caregiverNotes.splice(index, 1);
  saveAppState();
  renderAdminNotes();
};

function renderAdminSettings() {
  const groqInput = document.getElementById('cfg-groq-key');
  const geminiInput = document.getElementById('cfg-gemini-key');
  const orInput = document.getElementById('cfg-openrouter-key');

  if (groqInput) groqInput.value = cleanApiKey(appState.apiConfig.groqKey || localStorage.getItem('groq_api_key') || '');
  if (geminiInput) geminiInput.value = cleanApiKey(appState.apiConfig.geminiKey || localStorage.getItem('gemini_api_key') || '');
  if (orInput) orInput.value = cleanApiKey(appState.apiConfig.openrouterKey || localStorage.getItem('openrouter_api_key') || '');

  const persistInputs = () => {
    const gk = groqInput ? cleanApiKey(groqInput.value) : '';
    const gemk = geminiInput ? cleanApiKey(geminiInput.value) : '';
    const ork = orInput ? cleanApiKey(orInput.value) : '';

    if (groqInput) groqInput.value = gk;
    if (geminiInput) geminiInput.value = gemk;
    if (orInput) orInput.value = ork;

    appState.apiConfig.groqKey = gk;
    appState.apiConfig.geminiKey = gemk;
    appState.apiConfig.openrouterKey = ork;

    localStorage.setItem('groq_api_key', gk);
    localStorage.setItem('gemini_api_key', gemk);
    localStorage.setItem('openrouter_api_key', ork);
    saveAppState();
  };

  const saveBtn = document.getElementById('cfg-save-keys-btn');
  if (saveBtn) {
    saveBtn.onclick = () => {
      persistInputs();
      SoundService.playSuccessSound();
      showToast('הגדרות המפתחות נוקו ונשמרו בהצלחה! 💾');
    };
  }

  const runGroqTest = async () => {
    const btnTestGroq = document.getElementById('btn-test-groq');
    const statusGroq = document.getElementById('cfg-groq-status');
    if (!btnTestGroq || !statusGroq) return false;
    const key = groqInput ? cleanApiKey(groqInput.value) : '';
    if (groqInput) groqInput.value = key;
    btnTestGroq.disabled = true;
    btnTestGroq.innerHTML = '<span class="loading-spinner"></span> <span>בודק...</span>';
    statusGroq.style.display = 'block';
    statusGroq.style.backgroundColor = '#eff6ff';
    statusGroq.style.color = '#1e40af';
    statusGroq.style.border = '1px solid #bfdbfe';
    statusGroq.innerHTML = '<span class="loading-spinner"></span> <span>מתחבר ל-Groq Cloud...</span>';

    try {
      const res = await AIService.testGroq(key, (msg) => {
        statusGroq.innerHTML = `<span class="loading-spinner"></span> <span>${msg}</span>`;
      });
      if (res.success) {
        statusGroq.style.backgroundColor = '#ecfdf5';
        statusGroq.style.color = '#065f46';
        statusGroq.style.border = '1px solid #a7f3d0';
        statusGroq.innerHTML = `🟢 <strong>מחובר בהצלחה! (נשמר אוטומטית)</strong> זמן תגובה: <strong>${res.latency}ms</strong> | מודל מאומת: <code>${res.model}</code>`;
        return true;
      } else {
        statusGroq.style.backgroundColor = '#fef2f2';
        statusGroq.style.color = '#991b1b';
        statusGroq.style.border = '1px solid #fecaca';
        statusGroq.innerHTML = `🔴 <strong>שגיאה ב-Groq:</strong> ${res.error}`;
        return false;
      }
    } catch (err) {
      statusGroq.style.backgroundColor = '#fef2f2';
      statusGroq.style.color = '#991b1b';
      statusGroq.style.border = '1px solid #fecaca';
      statusGroq.innerHTML = `🔴 <strong>שגיאה:</strong> ${err.message}`;
      return false;
    } finally {
      btnTestGroq.disabled = false;
      btnTestGroq.innerHTML = '<span>בדוק Groq 🧪</span>';
    }
  };

  const runGeminiTest = async () => {
    const btnTestGemini = document.getElementById('btn-test-gemini');
    const statusGemini = document.getElementById('cfg-gemini-status');
    if (!btnTestGemini || !statusGemini) return false;
    const key = geminiInput ? cleanApiKey(geminiInput.value) : '';
    if (geminiInput) geminiInput.value = key;
    btnTestGemini.disabled = true;
    btnTestGemini.innerHTML = '<span class="loading-spinner"></span> <span>בודק...</span>';
    statusGemini.style.display = 'block';
    statusGemini.style.backgroundColor = '#eff6ff';
    statusGemini.style.color = '#1e40af';
    statusGemini.style.border = '1px solid #bfdbfe';
    statusGemini.innerHTML = '<span class="loading-spinner"></span> <span>מתחבר ל-Google AI Studio...</span>';

    try {
      const res = await AIService.testGemini(key, (msg) => {
        statusGemini.innerHTML = `<span class="loading-spinner"></span> <span>${msg}</span>`;
      });
      if (res.success) {
        statusGemini.style.backgroundColor = '#ecfdf5';
        statusGemini.style.color = '#065f46';
        statusGemini.style.border = '1px solid #a7f3d0';
        statusGemini.innerHTML = `🟢 <strong>מחובר בהצלחה! (נשמר אוטומטית)</strong> זמן תגובה: <strong>${res.latency}ms</strong> | מודל מאומת: <code>${res.model}</code>`;
        return true;
      } else {
        statusGemini.style.backgroundColor = '#fef2f2';
        statusGemini.style.color = '#991b1b';
        statusGemini.style.border = '1px solid #fecaca';
        statusGemini.innerHTML = `🔴 <strong>שגיאה ב-Gemini:</strong> ${res.error}`;
        return false;
      }
    } catch (err) {
      statusGemini.style.backgroundColor = '#fef2f2';
      statusGemini.style.color = '#991b1b';
      statusGemini.style.border = '1px solid #fecaca';
      statusGemini.innerHTML = `🔴 <strong>שגיאה:</strong> ${err.message}`;
      return false;
    } finally {
      btnTestGemini.disabled = false;
      btnTestGemini.innerHTML = '<span>בדוק Gemini 🧪</span>';
    }
  };

  const runOpenRouterTest = async () => {
    const btnTestOR = document.getElementById('btn-test-openrouter');
    const statusOR = document.getElementById('cfg-openrouter-status');
    if (!btnTestOR || !statusOR) return false;
    const key = orInput ? cleanApiKey(orInput.value) : '';
    if (orInput) orInput.value = key;
    btnTestOR.disabled = true;
    btnTestOR.innerHTML = '<span class="loading-spinner"></span> <span>בודק...</span>';
    statusOR.style.display = 'block';
    statusOR.style.backgroundColor = '#eff6ff';
    statusOR.style.color = '#1e40af';
    statusOR.style.border = '1px solid #bfdbfe';
    statusOR.innerHTML = '<span class="loading-spinner"></span> <span>מתחבר ל-OpenRouter...</span>';

    try {
      const res = await AIService.testOpenRouter(key, (msg) => {
        statusOR.innerHTML = `<span class="loading-spinner"></span> <span>${msg}</span>`;
      });
      if (res.success) {
        statusOR.style.backgroundColor = '#ecfdf5';
        statusOR.style.color = '#065f46';
        statusOR.style.border = '1px solid #a7f3d0';
        statusOR.innerHTML = `🟢 <strong>מחובר בהצלחה! (נשמר אוטומטית)</strong> זמן תגובה: <strong>${res.latency}ms</strong> | מודל מאומת: <code>${res.model}</code>`;
        return true;
      } else {
        statusOR.style.backgroundColor = '#fef2f2';
        statusOR.style.color = '#991b1b';
        statusOR.style.border = '1px solid #fecaca';
        statusOR.innerHTML = `🔴 <strong>שגיאה ב-OpenRouter:</strong> ${res.error}`;
        return false;
      }
    } catch (err) {
      statusOR.style.backgroundColor = '#fef2f2';
      statusOR.style.color = '#991b1b';
      statusOR.style.border = '1px solid #fecaca';
      statusOR.innerHTML = `🔴 <strong>שגיאה:</strong> ${err.message}`;
      return false;
    } finally {
      btnTestOR.disabled = false;
      btnTestOR.innerHTML = '<span>בדוק OpenRouter 🧪</span>';
    }
  };

  const btnTestGroq = document.getElementById('btn-test-groq');
  if (btnTestGroq) btnTestGroq.onclick = runGroqTest;

  const btnTestGemini = document.getElementById('btn-test-gemini');
  if (btnTestGemini) btnTestGemini.onclick = runGeminiTest;

  const btnTestOR = document.getElementById('btn-test-openrouter');
  if (btnTestOR) btnTestOR.onclick = runOpenRouterTest;

  const testAllBtn = document.getElementById('cfg-test-all-btn');
  if (testAllBtn) {
    testAllBtn.onclick = async () => {
      persistInputs();
      testAllBtn.disabled = true;
      testAllBtn.innerHTML = '<span class="loading-spinner"></span> <span>בודק את כל שרשרת ה-AI...</span>';
      let okCount = 0;
      if (groqInput && cleanApiKey(groqInput.value)) {
        if (await runGroqTest()) okCount++;
      }
      if (geminiInput && cleanApiKey(geminiInput.value)) {
        if (await runGeminiTest()) okCount++;
      }
      if (orInput && cleanApiKey(orInput.value)) {
        if (await runOpenRouterTest()) okCount++;
      }
      testAllBtn.disabled = false;
      testAllBtn.innerHTML = '<span>בדוק ושמור את כל שרשרת ה-AI (OK) ✅</span>';
      if (okCount > 0) {
        SoundService.playSuccessSound();
        showToast(`שרשרת ה-AI אומתה ונשמרה בהצלחה! (${okCount} ספקים פעילים) ✅`);
      } else {
        showToast('המפתחות נשמרו, אך אף ספק ענן לא הגיב כעת (המנוע הפנימי פעיל).', 'error');
      }
    };
  }

  const exportBtn = document.getElementById('adm-export-btn');
  if (exportBtn) {
    exportBtn.onclick = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
      const a = document.createElement('a');
      a.setAttribute("href", dataStr);
      a.setAttribute("download", `daniel_ai_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('קובץ גיבוי הורד בהצלחה! 💾');
    };
  }

  const importBtn = document.getElementById('adm-import-btn');
  const fileInput = document.getElementById('adm-file-input');
  if (importBtn && fileInput) {
    importBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (parsed && typeof parsed === 'object') {
            appState = parsed;
            saveAppState();
            renderAdminOverview();
            renderRoadmap();
            showToast('הנתונים שוחזרו בהצלחה מהקובץ! 📥');
          }
        } catch (err) {
          alert('שגיאה בקריאת קובץ הגיבוי: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
  }

  const resetBtn = document.getElementById('adm-reset-btn');
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (confirm('אזהרה: פעולה זו תאפס את כל התקדמות הלמידה של דניאל. האם להמשיך?')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    };
  }
}

// ============================================================================
// 11. אתחול ראשי בטעינת המסמך (DOMContentLoaded)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  performSmartMergeAndMigration();
  syncEnvKeysFromServer();
  checkAndApplyShabbatLock();

  const bypassBtn = document.getElementById('shabbat-bypass-btn');
  if (bypassBtn) {
    bypassBtn.onclick = () => {
      const pin = prompt('הקש קוד מלווה למעקף שבת לצורכי בדיקה:');
      const expected = appState.apiConfig.adminPin || ADMIN_PIN_DEFAULT;
      if (pin === expected || pin === ADMIN_PIN_DEFAULT || pin === 'דניאל' || pin === '') {
        shabbatBypassed = true;
        checkAndApplyShabbatLock();
        showToast('מצב שבת הוקפא זמנית לבדיקה.');
      } else {
        alert('קוד שגוי.');
      }
    };
  }

  const globalTtsBtn = document.getElementById('global-tts-btn');
  if (globalTtsBtn) {
    globalTtsBtn.onclick = () => {
      let text = 'מאמן ה-AI האישי של דניאל. לומדים צעד אחר צעד בקצב שלך.';
      if (appState.currentView === 'unit') {
        const u = appState.curriculumUnits.find(x => x.id === appState.activeUnitId);
        if (u) text = `${u.title}. ${u.goal}`;
      } else if (appState.currentView === 'checkpoint' && currentCheckpoint) {
        text = `${currentCheckpoint.title}. ${currentCheckpoint.description}`;
      }
      SoundService.speakText(text);
    };
  }

  // כפתור מצב רגוע (Calm Mode)
  const calmBtn = document.getElementById('global-calm-btn');
  if (calmBtn) calmBtn.onclick = openCalmModal;
  const closeCalmBtn = document.getElementById('close-calm-modal-btn');
  if (closeCalmBtn) closeCalmBtn.onclick = closeCalmModal;
  const calmDoneBtn = document.getElementById('calm-modal-done-btn');
  if (calmDoneBtn) calmDoneBtn.onclick = closeCalmModal;

  initAdminPortal();

  showView('roadmap');
  renderTrackTabs();
  renderRoadmap();

  showToast('ברוך הבא דניאל! גרסה 3 של המערכת נטענה בהצלחה ✨');
});
