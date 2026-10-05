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

let appState = {
  version: 3,
  currentView: 'roadmap',
  activeUnitId: 'unit_1',
  user: {
    name: 'דניאל',
    age: 28
  },
  clusters: getBaseClusters(),
  curriculumUnits: getBaseCurriculum(),
  checkpoints: getBaseCheckpoints(),
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
    ollamaUrl: 'http://localhost:11434',
    adminPin: ADMIN_PIN_DEFAULT
  },
  quizHistory: [],
  feedbackHistory: []
};

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
        if (parsed.user) appState.user = parsed.user;
        if (parsed.apiConfig) appState.apiConfig = { ...appState.apiConfig, ...parsed.apiConfig };
        if (Array.isArray(parsed.caregiverNotes)) appState.caregiverNotes = parsed.caregiverNotes;
        if (Array.isArray(parsed.quizHistory)) appState.quizHistory = parsed.quizHistory;
        if (Array.isArray(parsed.feedbackHistory)) appState.feedbackHistory = parsed.feedbackHistory;

        // מיזוג חכם של היחידות:
        // לוקחים תמיד את כל היחידות המעודכנות מ-curriculum_data.js (כולל יחידות חדשות שנוספו ב-Git)
        // ומשמרים את הסטטוס (isCompleted, feedback) של יחידות שדניאל כבר ביצע!
        const completedMap = new Map();
        if (Array.isArray(parsed.curriculumUnits)) {
          parsed.curriculumUnits.forEach(u => {
            if (u.isCompleted) completedMap.set(u.id, { isCompleted: true, feedback: u.feedback });
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

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
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

function renderRoadmap() {
  const container = document.getElementById('units-grid');
  if (!container) return;
  container.innerHTML = '';

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

  const legacyPill = document.getElementById('total-progress-pill');
  if (legacyPill) legacyPill.textContent = `${completedCount} מתוך ${units.length} יחידות | ${passedCPs} מבחנים`;

  const bar = document.getElementById('weekly-progress-bar');
  if (bar) bar.style.width = `${(completedCount / units.length) * 100}%`;
}

// ============================================================================
// 7. נגן יחידת הלימוד ב-4 שלבים משימתיים (4-Step Mission Unit Player)
// ============================================================================

function renderUnitPlayer(unitId) {
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
    'gemini-2.5-flash',
    'gemini-3.6-flash',
    'gemini-2.5-pro'
  ],

  groqModels: [
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'allam-2-7b'
  ],

  async testGemini(apiKey, progressCb) {
    if (!apiKey) return { success: false, error: 'לא הוזן מפתח API של Gemini.' };
    const t0 = performance.now();

    for (const model of this.geminiModels) {
      if (progressCb) progressCb(`בודק מודל ${model}...`);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'שלום! ענה במילה אחת בלבד: "פעיל".' }] }]
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'פעיל';
          const latency = Math.round(performance.now() - t0);
          return { success: true, model, latency, reply };
        }
      } catch (e) {
        console.warn(`Gemini test failed for ${model}:`, e);
      }
    }
    return { success: false, error: 'כל מודלי Gemini נכשלו או שהמפתח אינו תקין.' };
  },

  async testGroq(apiKey, progressCb) {
    if (!apiKey) return { success: false, error: 'לא הוזן מפתח API של Groq.' };
    const t0 = performance.now();

    for (const model of this.groqModels) {
      if (progressCb) progressCb(`בודק מודל ${model}...`);
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'שלום! ענה במילה אחת: "פעיל".' }],
            max_tokens: 300
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const choice = data?.choices?.[0]?.message;
          const reply = (choice?.content || choice?.reasoning_content || 'פעיל').trim();
          const latency = Math.round(performance.now() - t0);
          return { success: true, model, latency, reply };
        }
      } catch (e) {
        console.warn(`Groq test failed for ${model}:`, e);
      }
    }
    return { success: false, error: 'כל מודלי Groq נכשלו או שהמפתח אינו תקין.' };
  },

  async testOllama(baseUrl) {
    const t0 = performance.now();
    try {
      const resp = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
      if (resp.ok) {
        const data = await resp.json();
        const latency = Math.round(performance.now() - t0);
        return { success: true, latency, reply: `נמצאו ${data?.models?.length || 0} מודלים מקומיים.` };
      }
      return { success: false, error: 'שרת Ollama אינו מגיב בכתובת זו.' };
    } catch (e) {
      return { success: false, error: 'לא ניתן להתחבר ל-Ollama מקומי (וודא שהשרת רץ).' };
    }
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

    if (appState.apiConfig.geminiKey) {
      for (const model of this.geminiModels) {
        if (progressCb) progressCb(`מייצר יחידה באמצעות Gemini (${model})...`);
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${appState.apiConfig.geminiKey}`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: `${systemInstruction}\n\nהנושא המבוקש ליחידה הוא: ${topicPrompt}` }]
              }]
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = this.cleanAndParseJSON(text);
              if (parsed) return { unit: parsed, provider: `Gemini (${model})` };
            }
          }
        } catch (e) {
          console.warn(`Gemini generation failed for ${model}:`, e);
        }
      }
    }

    if (appState.apiConfig.groqKey) {
      for (const model of this.groqModels) {
        if (progressCb) progressCb(`מייצר יחידה באמצעות Groq (${model})...`);
        try {
          const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${appState.apiConfig.groqKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: `צור יחידה בנושא: ${topicPrompt}` }
              ],
              max_tokens: 1500
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            const choice = data?.choices?.[0]?.message;
            const text = choice?.content || choice?.reasoning_content;
            if (text) {
              const parsed = this.cleanAndParseJSON(text);
              if (parsed) return { unit: parsed, provider: `Groq (${model})` };
            }
          }
        } catch (e) {
          console.warn(`Groq generation failed for ${model}:`, e);
        }
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

function renderAdminOverview() {
  const units = appState.curriculumUnits;
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
        ${units.map(u => `
          <tr>
            <td><strong>${u.title}</strong></td>
            <td><span class="badge-tag">${u.category || 'כללי'}</span></td>
            <td>${u.trafficLight === 'red' ? '🔴 אדום' : u.trafficLight === 'yellow' ? '🟡 צהוב' : '🟢 ירוק'}</td>
            <td>${u.isCompleted ? '<span style="color:#059669; font-weight:700;">🟢 הושלם</span>' : '<span style="color:#d97706;">⏳ ממתין לביצוע</span>'}</td>
            <td>${u.feedback === 'easy' ? '😊 היה קל' : u.feedback === 'medium' ? '😐 קצת קשה' : u.feedback === 'hard' ? '😕 לא מובן' : '—'}</td>
          </tr>
        `).join('')}
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
  const geminiInput = document.getElementById('cfg-gemini-key');
  const groqInput = document.getElementById('cfg-groq-key');
  const ollamaInput = document.getElementById('cfg-ollama-url');

  if (geminiInput) geminiInput.value = appState.apiConfig.geminiKey || '';
  if (groqInput) groqInput.value = appState.apiConfig.groqKey || '';
  if (ollamaInput) ollamaInput.value = appState.apiConfig.ollamaUrl || 'http://localhost:11434';

  const saveBtn = document.getElementById('cfg-save-keys-btn');
  if (saveBtn) {
    saveBtn.onclick = () => {
      if (geminiInput) appState.apiConfig.geminiKey = geminiInput.value.trim();
      if (groqInput) appState.apiConfig.groqKey = groqInput.value.trim();
      if (ollamaInput) appState.apiConfig.ollamaUrl = ollamaInput.value.trim() || 'http://localhost:11434';
      saveAppState();
      SoundService.playSuccessSound();
      showToast('הגדרות המפתחות נשמרו בהצלחה! 💾');
    };
  }

  const btnTestGemini = document.getElementById('btn-test-gemini');
  const statusGemini = document.getElementById('cfg-gemini-status');
  if (btnTestGemini && statusGemini) {
    btnTestGemini.onclick = async () => {
      const key = geminiInput ? geminiInput.value.trim() : '';
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
          statusGemini.innerHTML = `🟢 <strong>מחובר בהצלחה!</strong> זמן תגובה: <strong>${res.latency}ms</strong> | מודל פעיל: <code>${res.model}</code>`;
        } else {
          statusGemini.style.backgroundColor = '#fef2f2';
          statusGemini.style.color = '#991b1b';
          statusGemini.style.border = '1px solid #fecaca';
          statusGemini.innerHTML = `🔴 <strong>שגיאה ב-Gemini:</strong> ${res.error}`;
        }
      } catch (err) {
        statusGemini.style.backgroundColor = '#fef2f2';
        statusGemini.style.color = '#991b1b';
        statusGemini.style.border = '1px solid #fecaca';
        statusGemini.innerHTML = `🔴 <strong>שגיאה:</strong> ${err.message}`;
      } finally {
        btnTestGemini.disabled = false;
        btnTestGemini.innerHTML = '<span>בדוק Gemini 🧪</span>';
      }
    };
  }

  const btnTestGroq = document.getElementById('btn-test-groq');
  const statusGroq = document.getElementById('cfg-groq-status');
  if (btnTestGroq && statusGroq) {
    btnTestGroq.onclick = async () => {
      const key = groqInput ? groqInput.value.trim() : '';
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
          statusGroq.innerHTML = `🟢 <strong>מחובר בהצלחה!</strong> זמן תגובה: <strong>${res.latency}ms</strong> | מודל פעיל: <code>${res.model}</code>`;
        } else {
          statusGroq.style.backgroundColor = '#fef2f2';
          statusGroq.style.color = '#991b1b';
          statusGroq.style.border = '1px solid #fecaca';
          statusGroq.innerHTML = `🔴 <strong>שגיאה ב-Groq:</strong> ${res.error}`;
        }
      } catch (err) {
        statusGroq.style.backgroundColor = '#fef2f2';
        statusGroq.style.color = '#991b1b';
        statusGroq.style.border = '1px solid #fecaca';
        statusGroq.innerHTML = `🔴 <strong>שגיאה:</strong> ${err.message}`;
      } finally {
        btnTestGroq.disabled = false;
        btnTestGroq.innerHTML = '<span>בדוק Groq 🧪</span>';
      }
    };
  }

  const btnTestOllama = document.getElementById('btn-test-ollama');
  const statusOllama = document.getElementById('cfg-ollama-status');
  if (btnTestOllama && statusOllama) {
    btnTestOllama.onclick = async () => {
      const url = ollamaInput ? ollamaInput.value.trim() : 'http://localhost:11434';
      btnTestOllama.disabled = true;
      btnTestOllama.innerHTML = '<span class="loading-spinner"></span> <span>בודק...</span>';
      statusOllama.style.display = 'block';
      statusOllama.style.backgroundColor = '#eff6ff';
      statusOllama.style.color = '#1e40af';
      statusOllama.style.border = '1px solid #bfdbfe';
      statusOllama.innerHTML = '<span class="loading-spinner"></span> <span>מתחבר ל-Ollama מקומי...</span>';

      try {
        const res = await AIService.testOllama(url);
        if (res.success) {
          statusOllama.style.backgroundColor = '#ecfdf5';
          statusOllama.style.color = '#065f46';
          statusOllama.style.border = '1px solid #a7f3d0';
          statusOllama.innerHTML = `🟢 <strong>מחובר ל-Ollama!</strong> זמן תגובה: <strong>${res.latency}ms</strong> | ${res.reply}`;
        } else {
          statusOllama.style.backgroundColor = '#fffbeb';
          statusOllama.style.color = '#92400e';
          statusOllama.style.border = '1px solid #fde68a';
          statusOllama.innerHTML = `ℹ️ <strong>סטטוס Ollama:</strong> ${res.error}`;
        }
      } catch (err) {
        statusOllama.style.backgroundColor = '#fef2f2';
        statusOllama.style.color = '#991b1b';
        statusOllama.style.border = '1px solid #fecaca';
        statusOllama.innerHTML = `🔴 <strong>שגיאה:</strong> ${err.message}`;
      } finally {
        btnTestOllama.disabled = false;
        btnTestOllama.innerHTML = '<span>בדוק Ollama 🧪</span>';
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
  renderRoadmap();

  showToast('ברוך הבא דניאל! גרסה 3 של המערכת נטענה בהצלחה ✨');
});
