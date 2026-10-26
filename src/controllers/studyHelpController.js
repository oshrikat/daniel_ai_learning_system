/**
 * Track 3 Controller: Study Help & Daily Homework Practice (עזרה בלימודים - תרגול יומי)
 * Provides:
 * 1. Dual Upload Hub (CamScanner PDF / Images up to 15 pages + Direct Text Paste)
 * 2. Calming Async Loading Overlay with live page-by-page extraction progress & Retry Modal (zero fake questions)
 * 3. Full Lesson AI Extraction (`generateDailyStudyUnitFromMaterial`):
 *    - Extracts `lesson_title`, `pages_summary`, `concepts` (with 2-step gentle MFA), and grounded `questions`
 *    - Stores `pageSnapshots` (`{ pageNumber, dataUrl }`) for inline textbook page viewing
 * 4. 2-Stage Interactive Study Unit View (`openStudyHelpUnit`):
 *    - Stage 1: Lesson Promo + Concept & Textbook Example Mastery Gate with Gentle 2-Step MFA
 *    - Stage 2: Grounded Textbook Questions & Real-Time Socratic Coach Chat
 * 5. Automatic Summary Exam Generator (`completeStudyHelpUnitAndGenerateExam`)
 */

let _loadingStepTimer = null;
let _lastUploadRetryContext = null;

/**
 * Escapes HTML special characters and converts newlines / bold markdown to safe HTML.
 * @param {string} str
 * @returns {string}
 */
function formatCoachChatHtml(str) {
  const safe = String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return safe
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

/**
 * Returns today's formatted date in Hebrew (e.g., "יום שני, 19.10.2026").
 * @param {Date} [dateObj]
 * @returns {string}
 */
function getTodayHebrewDateLabel(dateObj = new Date()) {
  const days = [
    'יום ראשון',
    'יום שני',
    'יום שלישי',
    'יום רביעי',
    'יום חמישי',
    'יום שישי',
    'יום שבת'
  ];
  const d = dateObj instanceof Date && !isNaN(dateObj) ? dateObj : new Date();
  const dayName = days[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dayName}, ${dd}.${mm}.${yyyy}`;
}

/**
 * Ensures `appState.studyHelpStats` is initialized, updates `streakDays` automatically
 * whenever Daniel studies on a new day, and syncs `lessonsCompleted`.
 * @returns {{ streakDays: number, lastStudyDate: string, totalStars: number, lessonsCompleted: number }}
 */
function ensureStudyHelpStats() {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (!appState.studyHelpStats || typeof appState.studyHelpStats !== 'object') {
    appState.studyHelpStats = {
      streakDays: 1,
      lastStudyDate: todayIso,
      totalStars: 0,
      lessonsCompleted: 0
    };
  }

  const lastDate = String(appState.studyHelpStats.lastStudyDate || '');
  if (lastDate && lastDate !== todayIso) {
    const prev = new Date(lastDate + 'T00:00:00');
    const curr = new Date(todayIso + 'T00:00:00');
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      appState.studyHelpStats.streakDays = (Number(appState.studyHelpStats.streakDays) || 1) + 1;
    } else if (diffDays > 1) {
      appState.studyHelpStats.streakDays = Math.max(1, Number(appState.studyHelpStats.streakDays) || 1);
    }
    appState.studyHelpStats.lastStudyDate = todayIso;
    saveAppState();
  } else if (!lastDate) {
    appState.studyHelpStats.lastStudyDate = todayIso;
  }

  const completedUnitsCount = Array.isArray(appState.studyHelpUnits)
    ? appState.studyHelpUnits.filter(u => Boolean(u && (u.completed || u.isCompleted))).length
    : 0;
  if (completedUnitsCount > (Number(appState.studyHelpStats.lessonsCompleted) || 0)) {
    appState.studyHelpStats.lessonsCompleted = completedUnitsCount;
  }

  return appState.studyHelpStats;
}

/**
 * Awards Mastery Stars (`+1 ⭐` for Concept, `+2 ⭐` for Question+MFA, `+5 ⭐` for Lesson Completion),
 * updates `appState.studyHelpStats`, and shows an energizing celebration toast.
 * @param {number} starsToAdd
 * @param {string} reasonLabel
 */
function awardStudyHelpStars(starsToAdd = 1, reasonLabel = '') {
  const stats = ensureStudyHelpStats();
  const added = Math.max(0, Number(starsToAdd) || 0);
  if (added <= 0) return;

  stats.totalStars = (Number(stats.totalStars) || 0) + added;
  saveAppState();

  document.querySelectorAll('.js-study-stars-count').forEach(el => {
    el.textContent = String(stats.totalStars);
  });
  document.querySelectorAll('.js-study-lessons-count').forEach(el => {
    el.textContent = String(stats.lessonsCompleted);
  });
  document.querySelectorAll('.js-study-streak-count').forEach(el => {
    el.textContent = String(stats.streakDays);
  });

  if (typeof showToast === 'function') {
    showToast(`⭐ +${added} כוכבי שליטה! ${reasonLabel ? `(${reasonLabel})` : ''} סה"כ: ${stats.totalStars} ⭐`, 'success');
  }
}

/**
 * Builds the motivating Habit & Momentum Bar HTML for the top of the Study Help tab and unit player.
 * @returns {string}
 */
function buildHabitMomentumBarHtml() {
  const stats = ensureStudyHelpStats();
  return `
    <section class="study-habit-momentum-bar" aria-label="מדד התמדה וכוכבי שליטה של דניאל">
      <div class="study-habit-greeting-row">
        <span class="study-habit-wave-icon" aria-hidden="true">🌟</span>
        <p class="study-habit-greeting-text">
          איזה כיף שחזרת דניאל! כל מושג ושאלה שאתה מפצח היום מקדמים אותך לצבירת כוכבים ולשליטה מלאה בחומר 🌟
        </p>
      </div>
      <div class="study-habit-counters-row">
        <div class="study-habit-stat-pill streak-pill" title="רצף ימי למידה">
          <span class="habit-pill-icon">🔥</span>
          <span>רצף למידה: <strong class="js-study-streak-count">${stats.streakDays}</strong> ימים</span>
        </div>
        <div class="study-habit-stat-pill stars-pill" title="כוכבי שליטה שצברת (+1 על מושג, +2 על שאלה, +5 על סיום שיעור)">
          <span class="habit-pill-icon">⭐</span>
          <span>כוכבי שליטה: <strong class="js-study-stars-count">${stats.totalStars}</strong></span>
        </div>
        <div class="study-habit-stat-pill lessons-pill" title="שיעורים מלאים שהושלמו">
          <span class="habit-pill-icon">🏆</span>
          <span>שיעורים שהושלמו: <strong class="js-study-lessons-count">${stats.lessonsCompleted}</strong></span>
        </div>
      </div>
    </section>
  `;
}

/**
 * Builds the visual Guiding Stones Timeline HTML inside `openStudyHelpUnit(unitId)` driven by `UnitBeatCursor`:
 * Promo (`🎬 פתיחה`) -> [Concept Slides (`💎 מושג ...`) -> WhatsApp Private Tutor (`☀️ מורה פרטי ...`)] -> Gate (`🔓`/`🔒`) -> Homework Slides (`📝 שאלה ...`) -> Trophy (`🏆 מבחן מסכם`).
 * @param {object} unit
 * @returns {string}
 */
function buildGuidingStonesTimelineHtml(unit) {
  const deck = UnitBeatCursor.getFlatSlideDeck(unit);
  const activeSlide = UnitBeatCursor.getCurrentSlide(unit);
  const allBeatsMastered = UnitBeatCursor.areAllConceptBeatsMastered(unit);
  const questions = Array.isArray(unit.questions) ? unit.questions : [];
  const solvedArr = Array.isArray(unit.solvedQuestions) ? unit.solvedQuestions : [];
  const allQuestionsSolved = questions.length === 0 ? allBeatsMastered : (solvedArr.filter(Boolean).length === questions.length);
  const unitDone = Boolean(unit.completed || unit.isCompleted || (allBeatsMastered && allQuestionsSolved));

  const stage1Nodes = deck.filter(s => s.type !== 'HOMEWORK_SLIDE');
  const hwNodes = deck.filter(s => s.type === 'HOMEWORK_SLIDE');

  const stage1StonesHtml = stage1Nodes.map(s => {
    const isCurrent = activeSlide && activeSlide.slideIndex === s.slideIndex;
    const isDone = Boolean(s.isCompleted);
    const isLocked = !s.isUnlocked;
    let emoji = '💎';
    let stoneClass = 'concept-stone';
    if (s.type === 'PROMO_OVERVIEW_SLIDE') {
      emoji = isDone ? '✅' : '🎬';
      stoneClass = 'promo-stone';
    } else if (s.type === 'PRIVATE_TUTOR_SLIDE') {
      emoji = isDone ? '✅' : (isLocked ? '🔒' : '☀️');
      stoneClass = 'tutor-stone';
    } else {
      emoji = isDone ? '✅' : (isLocked ? '🔒' : '💎');
    }

    return `
      <button
        type="button"
        class="study-timeline-stone ${stoneClass} ${isDone ? 'stone-completed' : ''} ${isCurrent ? 'stone-current' : ''} ${isLocked ? 'stone-locked' : ''}"
        data-cursor-slide-idx="${s.slideIndex}"
        ${isLocked ? 'disabled' : ''}
        title="${escapeHtmlAttr(s.fullTitle || s.shortLabel)}"
      >
        <span class="stone-emoji">${emoji}</span>
        <span class="stone-label">${escapeHtmlAttr(s.shortLabel)}</span>
      </button>
    `;
  }).join('<span class="study-timeline-connector" aria-hidden="true"></span>');

  const gateStoneHtml = questions.length > 0 ? `
    <span class="study-timeline-connector" aria-hidden="true"></span>
    <div
      class="study-timeline-stone gate-stone ${allBeatsMastered ? 'stone-completed' : 'stone-locked'}"
      title="${allBeatsMastered ? 'שער שיעורי הבית פתוח!' : 'השלם את כל קבוצות המושגים ושיחות המורה הפרטי כדי לפתוח את שער שיעורי הבית'}"
    >
      <span class="stone-emoji">${allBeatsMastered ? '🔓' : '🔒'}</span>
      <span class="stone-label">שער שיעורי הבית</span>
    </div>
    <span class="study-timeline-connector" aria-hidden="true"></span>
  ` : '';

  const hwStonesHtml = hwNodes.map(s => {
    const isCurrent = activeSlide && activeSlide.slideIndex === s.slideIndex;
    const isDone = Boolean(s.isCompleted);
    const isLocked = !s.isUnlocked;
    return `
      <button
        type="button"
        class="study-timeline-stone question-stone ${isDone ? 'stone-completed' : ''} ${isCurrent ? 'stone-current' : ''} ${isLocked ? 'stone-locked' : ''}"
        data-cursor-slide-idx="${s.slideIndex}"
        ${isLocked ? 'disabled' : ''}
        title="${escapeHtmlAttr(s.fullTitle || s.shortLabel)}"
      >
        <span class="stone-emoji">${isDone ? '✅' : (isLocked ? '🔒' : '📝')}</span>
        <span class="stone-label">${escapeHtmlAttr(s.shortLabel)}</span>
      </button>
    `;
  }).join('<span class="study-timeline-connector" aria-hidden="true"></span>');

  const trophyStoneHtml = `
    <span class="study-timeline-connector" aria-hidden="true"></span>
    <button
      type="button"
      class="study-timeline-stone trophy-stone ${unitDone ? 'stone-completed' : 'stone-locked'}"
      id="btn-timeline-trophy-exam"
      ${!unitDone ? 'disabled' : ''}
      title="מבחן מסכם מעשי בחלונית הנהלת חשבונות"
    >
      <span class="stone-emoji">🏆</span>
      <span class="stone-label">מבחן מסכם</span>
    </button>
  `;

  return `
    <div class="study-guiding-stones-timeline" role="navigation" aria-label="מסלול שקופיות ופעימות השיעור">
      ${stage1StonesHtml}
      ${gateStoneHtml}
      ${hwStonesHtml}
      ${trophyStoneHtml}
    </div>
  `;
}

/**
 * Displays the soothing full-screen Calming Async Loading Overlay for Daniel.
 * @param {string} [statusText]
 */
function showStudyHelpLoadingOverlay(statusText = 'קורא את הדפים שהעלית...') {
  let overlay = document.getElementById('study-help-loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'study-help-loading-overlay';
    overlay.className = 'study-calming-overlay active';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
      <div class="study-calming-modal">
        <div class="study-breathing-orb" aria-hidden="true">🌿</div>
        <h3 class="study-calming-title">המאמן האישי קורא ומסדר לך את השיעור של היום...</h3>
        <p id="study-help-loading-status" class="study-calming-step-label">${statusText}</p>
        <div class="study-calming-steps-list">
          <div class="study-calming-step-pill" data-step="1">1. קורא וסורק את כל עמודי השיעור שהעלית...</div>
          <div class="study-calming-step-pill" data-step="2">2. מחלץ מושגים, דוגמאות מהספר ושאלות תרגול מדויקות...</div>
          <div class="study-calming-step-pill" data-step="3">3. מכין את השקופית ואת שיחת המורה הפרטי...</div>
        </div>
        <p class="study-calming-subtitle">
          קח נשימה רגועה, דניאל 💙 עוד כמה שניות הכל יהיה מונגש ומסודר צעד אחר צעד.
        </p>
      </div>
    `;
    document.body.appendChild(overlay);
  } else {
    overlay.style.display = 'flex';
    overlay.classList.add('active');
    const statusEl = overlay.querySelector('#study-help-loading-status');
    if (statusEl) statusEl.textContent = statusText;
  }

  const updateActiveStepPill = (text) => {
    const statusEl = overlay.querySelector('#study-help-loading-status');
    if (statusEl) statusEl.textContent = text;
    const pills = overlay.querySelectorAll('.study-calming-step-pill');
    pills.forEach(pill => {
      const stepNum = pill.getAttribute('data-step');
      const isMatch =
        (stepNum === '1' && (text.includes('קורא') || text.includes('סורק'))) ||
        (stepNum === '2' && (text.includes('ממפה') || text.includes('מזהה') || text.includes('מחלץ') || text.includes('מנתח'))) ||
        (stepNum === '3' && (text.includes('בונה') || text.includes('מכין') || text.includes('פעימ') || text.includes('מעביר') || text.includes('מורה')));
      pill.classList.toggle('active', isMatch);
    });
  };

  updateActiveStepPill(statusText);
}

/**
 * Hides the full-screen Calming Async Loading Overlay.
 */
function hideStudyHelpLoadingOverlay() {
  if (_loadingStepTimer) {
    clearInterval(_loadingStepTimer);
    _loadingStepTimer = null;
  }
  const overlay = document.getElementById('study-help-loading-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
}

/**
 * Shows a calm, clear retry modal when file/lesson AI extraction fails,
 * ensuring fake ungrounded questions are NEVER injected.
 * @param {string} diagnosticReason
 * @param {function} onRetry
 */
function showStudyHelpRetryModal(diagnosticReason, onRetry) {
  hideStudyHelpLoadingOverlay();
  console.error('[StudyHelp Diagnostic] File/Lesson extraction failed:', diagnosticReason);

  let modal = document.getElementById('study-help-retry-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'study-help-retry-modal';
  modal.className = 'study-calming-overlay active';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="study-calming-modal study-retry-modal-card" dir="rtl">
      <div style="font-size:2.8rem; margin-bottom:0.6rem;">📄🔍</div>
      <h3 class="study-calming-title">לא הצלחנו להשלים את קריאת קובץ השיעור בניסיון הראשון</h3>
      <p class="study-calming-subtitle" style="margin-bottom:1rem;">
        אל דאגה דניאל! לפעמים קובץ PDF מרובה עמודים לוקח עוד רגע לפענוח מלא מול השרת. אנחנו לא ממציאים שאלות שלא מופיעות בקובץ שלך.
      </p>
      <div class="study-retry-diagnostic-box">
        <small>פרטי אבחון טכניים: ${formatCoachChatHtml(diagnosticReason || 'שגיאת תקשורת או פענוח JSON')}</small>
      </div>
      <div class="study-celebration-actions" style="margin-top:1.2rem;">
        <button type="button" id="btn-retry-lesson-analysis" class="primary-btn study-create-unit-btn">
          <span>🔄 נסה שוב לקרוא ולנתח את קובץ השיעור</span>
        </button>
        <button type="button" id="btn-close-retry-modal" class="secondary-btn">
          <span>סגור</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const retryBtn = modal.querySelector('#btn-retry-lesson-analysis');
  const closeBtn = modal.querySelector('#btn-close-retry-modal');

  if (retryBtn) {
    retryBtn.onclick = async () => {
      modal.remove();
      if (typeof onRetry === 'function') {
        await onRetry();
      }
    };
  }
  if (closeBtn) {
    closeBtn.onclick = () => modal.remove();
  }
}

/**
 * Opens an inline/modal zoomable viewer for a specific textbook page snapshot from the uploaded PDF.
 * @param {object} unit
 * @param {number} pageNumber
 */
function openLessonPageViewerModal(unit, pageNumber = 1) {
  const snapshots = Array.isArray(unit && unit.pageSnapshots) ? unit.pageSnapshots : [];
  if (snapshots.length === 0) {
    if (typeof showToast === 'function') {
      showToast('צילום העמוד מתוך הקובץ אינו זמין ביחידה זו.', 'warning');
    }
    return;
  }

  let currentSnap = snapshots.find(s => Number(s.pageNumber) === Number(pageNumber)) || snapshots[0];

  let modal = document.getElementById('study-page-viewer-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'study-page-viewer-modal';
  modal.className = 'study-calming-overlay active';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const renderViewerContent = () => {
    const imgSrc = currentSnap.dataUrl || (currentSnap.data ? `data:${currentSnap.mimeType || 'image/jpeg'};base64,${currentSnap.data}` : '');
    modal.innerHTML = `
      <div class="study-page-viewer-card" dir="rtl">
        <div class="study-page-viewer-header">
          <div>
            <h3 class="study-page-viewer-title">📄 עמוד ${currentSnap.pageNumber} מתוך קובץ השיעור</h3>
            <span class="study-page-viewer-sub">${unit.title || ''}</span>
          </div>
          <div class="study-page-viewer-nav">
            ${snapshots.map(s => `
              <button
                type="button"
                class="study-page-pill-btn ${Number(s.pageNumber) === Number(currentSnap.pageNumber) ? 'active' : ''}"
                data-view-page="${s.pageNumber}"
              >
                עמ' ${s.pageNumber}
              </button>
            `).join('')}
            <button type="button" id="btn-close-page-viewer" class="secondary-btn">✖ סגור</button>
          </div>
        </div>
        <div class="study-page-viewer-body">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="עמוד ${currentSnap.pageNumber} מתוך קובץ השיעור" class="study-page-snapshot-img" />`
            : `<p>לא ניתן להציג תמונה לעמוד זה.</p>`
          }
        </div>
      </div>
    `;

    modal.querySelectorAll('.study-page-pill-btn').forEach(btn => {
      btn.onclick = () => {
        const targetPage = Number(btn.getAttribute('data-view-page'));
        const found = snapshots.find(s => Number(s.pageNumber) === targetPage);
        if (found) {
          currentSnap = found;
          renderViewerContent();
        }
      };
    });

    const closeBtn = modal.querySelector('#btn-close-page-viewer');
    if (closeBtn) {
      closeBtn.onclick = () => modal.remove();
    }
  };

  renderViewerContent();
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  document.body.appendChild(modal);
}

// ============================================================================
// ITERATIVE "BEATS" CONTENT GENERATION ENGINE (`BeatGenerator`)
// Stage A: Beat 0 Zero-Loss Blueprint (3-page chunked multimodal extraction)
// Stage B: Dynamic Concept Beat & Homework Beat Slide Generation
// Stage C: Immediate Beat 1 Launch + Asynchronous Background Beat Queue
// ============================================================================

const _activeBeatWorkerPromises = new Map();
const _inFlightBeatPromises = new Map();

/**
 * Safely parses JSON from an AI response string.
 * @param {string|object} rawResponse
 * @returns {object|null}
 */
function parseJsonFromAIResponse(rawResponse) {
  if (!rawResponse) return null;
  if (typeof rawResponse === 'object') return rawResponse;
  if (typeof AIService !== 'undefined' && typeof AIService.cleanAndParseJSON === 'function') {
    return AIService.cleanAndParseJSON(rawResponse);
  }
  const str = String(rawResponse).trim();
  const match = str.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : str);
}

/**
 * Creates the default dynamic learner adaptation profile tracked per unit.
 * Updated continuously as Daniel answers Beat questions or requests simpler analogies.
 * @returns {object}
 */
function createDefaultLearnerAdaptationProfile() {
  return {
    pace: 'balanced',
    preferredAnalogyStyle: 'everyday_concrete',
    askedForSimplerAnalogyCount: 0,
    wrongMcAttemptsCount: 0,
    challengingTerms: [],
    masteredTerms: [],
    recentLearnerNotes: [],
    dirtyForNextBeat: false
  };
}

/**
 * Extracts only the `--- עמוד P ---` text sections matching `[startPage..endPage]`
 * from `fullText`. Falls back to returning `fullText` if no page markers exist.
 * @param {string} fullText
 * @param {number} startPage
 * @param {number} endPage
 * @returns {string}
 */
function sliceExtractedTextForPages(fullText, startPage, endPage) {
  const clean = String(fullText || '').trim();
  if (!clean) return '';

  const markerRegex = /---\s*עמוד\s*(\d+)\s*---/g;
  const matches = Array.from(clean.matchAll(markerRegex));
  if (matches.length === 0) {
    return clean;
  }

  const matchingChunks = [];
  for (let i = 0; i < matches.length; i++) {
    const pageNum = Number(matches[i][1]);
    const sectionStart = matches[i].index;
    const sectionEnd = i + 1 < matches.length ? matches[i + 1].index : clean.length;
    if (pageNum >= startPage && pageNum <= endPage) {
      matchingChunks.push(clean.slice(sectionStart, sectionEnd).trim());
    }
  }

  return matchingChunks.join('\n\n').trim();
}

/**
 * Retrieves up to 3 inline image objects (`{ mimeType, data, pageNumber }`) from `unit.pageSnapshots`
 * matching the requested `pageNumbers`, so individual Beat generation calls stay fast and grounded.
 * @param {object} unit
 * @param {Array<number>} pageNumbers
 * @returns {Array<object>}
 */
function getSnapshotInlineImagesForPages(unit, pageNumbers = []) {
  const snapshots = Array.isArray(unit?.pageSnapshots) ? unit.pageSnapshots : [];
  if (snapshots.length === 0) return [];

  const uniquePages = Array.from(
    new Set(
      (Array.isArray(pageNumbers) ? pageNumbers : [])
        .map(n => Number(n))
        .filter(n => !isNaN(n) && n > 0)
    )
  ).slice(0, 3);

  const result = [];
  for (const pNum of uniquePages) {
    const snap = snapshots.find(s => Number(s.pageNumber) === pNum);
    if (!snap) continue;
    const rawDataUrl = String(snap.dataUrl || '');
    const base64Data = snap.data || rawDataUrl.replace(/^data:[^;]+;base64,/, '');
    if (base64Data) {
      result.push({
        mimeType: snap.mimeType || 'image/jpeg',
        data: base64Data,
        pageNumber: pNum
      });
    }
  }
  return result;
}

/**
 * Grounded offline blueprint builder for direct pasted text when cloud AI is unreachable.
 * Uses ONLY Daniel's pasted text — NEVER injects fake hardcoded questions!
 * @param {object} params
 * @returns {object|null}
 */
function buildGroundedPastedTextBlueprint({ extractedText = '', sourceLabel = '' } = {}) {
  const cleanText = String(extractedText || '').trim();
  if (!cleanText) return null;

  const dateStr = getTodayHebrewDateLabel();
  const lines = cleanText.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const rawQuestions = cleanText
    .split(/(?=(?:^|\n)\s*(?:שאלה\s*\d+|תרגיל\s*\d+|סעיף\s*[א-ת]|\d+[\.\)\-]\s+))/g)
    .map(s => s.trim())
    .filter(s => s.length >= 6);

  const questionChunks = rawQuestions.length > 0 ? rawQuestions : [cleanText];

  const concept_outlines = [
    {
      term_name: 'זיהוי הנתונים והפעולה החשבונאית בשאלה',
      page_number: 1,
      source_section_label: 'עמוד 1 - עיקרון מרכזי מתוך הטקסט שהודבק',
      raw_book_excerpt: lines.slice(0, 3).join('\n') || cleanText.slice(0, 260)
    }
  ];

  const question_outlines = questionChunks.map((qText, idx) => ({
    question_number_label: `שאלה ${idx + 1}`,
    page_number: 1,
    question_type: 'open_question',
    exact_book_text: qText
  }));

  return {
    lesson_title: sourceLabel || `שיעור ותרגול יומי (${dateStr})`,
    pages_summary: 'יחידת לימוד זו נבנתה ישירות מתוך הטקסט שהדבקת: תחילה נבין את מושגי היסוד ולאחר מכן נפתור את כל השאלות צעד אחר צעד.',
    concept_outlines,
    question_outlines
  };
}

/**
 * Groups `concept_outlines` into Concept Beats (`conceptBeats`), each containing 1 to 3 related concepts
 * (`beatIndex: 0, 1, 2...`). Ensures at least 1 Concept Beat exists so Stage 1 always prepares Daniel.
 * @param {Array<object>} conceptOutlines
 * @param {string} unitId
 * @param {object} fallbackContext
 * @returns {{ normalizedOutlines: Array<object>, conceptBeats: Array<object> }}
 */
function groupConceptOutlinesIntoBeats(conceptOutlines = [], unitId = 'unit', fallbackContext = {}) {
  let cleanOutlines = (Array.isArray(conceptOutlines) ? conceptOutlines : [])
    .filter(c => c && (c.term_name || c.raw_book_excerpt))
    .map((c, idx) => ({
      outlineIndex: idx,
      term_name: String(c.term_name || `מושג ${idx + 1}`).trim(),
      page_number: Math.max(1, Number(c.page_number) || 1),
      source_section_label: String(c.source_section_label || `עמוד ${Math.max(1, Number(c.page_number) || 1)}`).trim(),
      raw_book_excerpt: String(c.raw_book_excerpt || c.term_name || '').trim()
    }));

  if (cleanOutlines.length === 0) {
    const firstQ = Array.isArray(fallbackContext.questionOutlines) && fallbackContext.questionOutlines[0]
      ? fallbackContext.questionOutlines[0]
      : null;
    cleanOutlines = [
      {
        outlineIndex: 0,
        term_name: String(fallbackContext.lessonTitle || 'העיקרון המרכזי בדפי התרגול').trim(),
        page_number: firstQ ? (Number(firstQ.page_number) || 1) : 1,
        source_section_label: `עמוד ${firstQ ? (Number(firstQ.page_number) || 1) : 1} - הכנה לפתרון השאלות`,
        raw_book_excerpt: String(
          firstQ?.exact_book_text ||
          fallbackContext.pagesSummary ||
          'קריאת נתוני השאלה מהעמוד, זיהוי צד החובה וצד הזכות ובדיקת איזון מלאה.'
        ).trim()
      }
    ];
  }

  const rawGroups = [];
  let currentGroup = [];

  for (let i = 0; i < cleanOutlines.length; i++) {
    const item = cleanOutlines[i];
    if (currentGroup.length === 0) {
      currentGroup.push(item);
      continue;
    }
    const pageSpan = Math.abs(item.page_number - currentGroup[0].page_number);
    if (currentGroup.length >= 3 || (currentGroup.length >= 2 && pageSpan > 2)) {
      rawGroups.push(currentGroup);
      currentGroup = [item];
    } else {
      currentGroup.push(item);
    }
  }
  if (currentGroup.length > 0) {
    rawGroups.push(currentGroup);
  }

  let runningConceptIdx = 0;
  const conceptBeats = rawGroups.map((group, beatIdx) => {
    const conceptIndices = group.map(() => runningConceptIdx++);
    return {
      beatIndex: beatIdx,
      id: `${unitId}_cbeat_${beatIdx}`,
      status: 'pending',
      conceptOutlines: group,
      conceptIndices,
      slides: [],
      tutorSlide: {
        beatIndex: beatIdx,
        required_terms_checklist: group.map((g, localIdx) => ({
          term_id: `${unitId}_c${conceptIndices[localIdx] + 1}`,
          term_name: g.term_name,
          page_number: g.page_number,
          verified: false
        })),
        chatHistory: [],
        handoffCompleted: false,
        all_beat_terms_mastered: false,
        completed: false
      },
      completed: false
    };
  });

  return { normalizedOutlines: cleanOutlines, conceptBeats };
}

/**
 * Groups `question_outlines` into Homework Beats (`homeworkBeats`) with 2–3 homework questions per beat.
 * Balances trailing single-item remainder into 2 + 2 when total questions >= 4.
 * @param {Array<object>} questionOutlines
 * @param {string} unitId
 * @returns {{ normalizedQuestionOutlines: Array<object>, homeworkBeats: Array<object> }}
 */
function groupQuestionOutlinesIntoBeats(questionOutlines = [], unitId = 'unit') {
  const cleanQuestions = (Array.isArray(questionOutlines) ? questionOutlines : [])
    .filter(q => q && (q.exact_book_text || q.question_number_label))
    .map((q, idx) => ({
      outlineIndex: idx,
      question_number_label: String(q.question_number_label || `שאלה ${idx + 1}`).trim(),
      page_number: Math.max(1, Number(q.page_number) || 1),
      question_type: String(q.question_type || 'open_question').trim(),
      exact_book_text: String(q.exact_book_text || q.question_number_label || `שאלה ${idx + 1}`).trim()
    }));

  if (cleanQuestions.length === 0) {
    return { normalizedQuestionOutlines: [], homeworkBeats: [] };
  }

  const rawGroups = [];
  let idx = 0;
  while (idx < cleanQuestions.length) {
    const remaining = cleanQuestions.length - idx;
    let take = 3;
    if (remaining === 4) {
      take = 2; // Balance 4 remaining questions into two beats of 2 + 2
    } else if (remaining <= 3) {
      take = remaining;
    }
    rawGroups.push(cleanQuestions.slice(idx, idx + take));
    idx += take;
  }

  let runningQIdx = 0;
  const homeworkBeats = rawGroups.map((group, beatIdx) => {
    const questionIndices = group.map(() => runningQIdx++);
    return {
      beatIndex: beatIdx,
      id: `${unitId}_hwbeat_${beatIdx}`,
      status: 'pending',
      questionOutlines: group,
      questionIndices,
      questions: [],
      completed: false
    };
  });

  return { normalizedQuestionOutlines: cleanQuestions, homeworkBeats };
}

/**
 * Stage A — `extractLessonBeatBlueprint` (Beat 0 Blueprint):
 * Scans ALL uploaded pages in chunks of up to 3 pages per AI call (when `inlineImages.length > 3`)
 * so no single request ever times out or truncates, returning a 100% zero-loss inventory of
 * `concept_outlines` and `question_outlines`, grouped into `conceptBeats` (1–3 concepts/beat)
 * and `homeworkBeats` (2–3 questions/beat).
 * @param {object} params
 * @returns {Promise<object>}
 */
async function extractLessonBeatBlueprint({
  extractedText = '',
  inlineImages = [],
  rawPdfPart = null,
  sourceLabel = '',
  isFileUpload = false
} = {}) {
  const cleanText = String(extractedText || '').trim();
  const pageImages = (Array.isArray(inlineImages) ? inlineImages : []).filter(
    img => img && !img.isNativePdf && img.mimeType !== 'application/pdf'
  );
  const hasNativePdfOnly = pageImages.length === 0 && Boolean(rawPdfPart && rawPdfPart.data);
  const hasAnyVisuals = pageImages.length > 0 || hasNativePdfOnly;

  const systemInstruction = `אתה מומחה למיפוי ספרי לימוד ודפי עבודה בהנהלת חשבונות עבור דניאל (בחור בן 28).
חובה לחלץ 100% מכל תתי-הנושאים, המושגים, הדוגמאות הפתורות וכל השאלות והסעיפים המופיעים בעמודים אלו — אסור לדלג על אף שאלה ואסור לאחד שאלות לשאלה אחת!
אסור בתכלית האיסור להמציא מושגים או שאלות שלא מופיעים בעמודים המצורפים. החזר אך ורק אובייקט JSON תקני בעברית.`;

  const buildChunkBlueprintPrompt = ({ chunkText, startPage, endPage, totalPages }) => {
    const pageRangeDesc = totalPages > 0
      ? `עמודים ${startPage} עד ${endPage} מתוך ${totalPages}`
      : 'חומר הלימוד המצורף';

    return `בצע מיפוי מלא ללא שום השמטה (${pageRangeDesc}) מתוך השיעור${sourceLabel ? ` "${sourceLabel}"` : ''}.
חובה לחלץ 100% מכל תתי-הנושאים, המושגים, הדוגמאות הפתורות וכל השאלות והסעיפים המופיעים בעמודים אלו — אסור לדלג על אף שאלה ואסור לאחד שאלות לשאלה אחת!
אם לשאלה יש סעיפים (למשל סעיף א', סעיף ב', או מספר אירועים עסקיים בטבלה/רשימה), רשום כל סעיף או שאלה עם כל הנתונים והמספרים המדויקים מתוך העמוד.

${chunkText ? `טקסט שחולץ מ${pageRangeDesc}:\n"""\n${chunkText}\n"""\n` : 'קרא בקפידה את כל הטקסט, ההגדרות, הדוגמאות, הטבלאות והתרגילים מתוך צילומי העמודים המצורפים.\n'}

החזר אך ורק אובייקט JSON תקני במבנה המדויק הבא:
{
  "lesson_title": "הכותרת המדויקת של השיעור או הנושא מתוך העמודים",
  "pages_summary": "סיכום קצר וברור של מה שמופיע בעמודים אלו",
  "concept_outlines": [
    {
      "term_name": "שם המושג / הכלל / תת-הנושא מתוך העמוד",
      "page_number": ${startPage || 1},
      "source_section_label": "עמוד ${startPage || 1} - הגדרת ...",
      "raw_book_excerpt": "הטקסט והדוגמה המדויקים מהעמוד (כולל המספרים והכללים כפי שמופיעים בספר)"
    }
  ],
  "question_outlines": [
    {
      "question_number_label": "שאלה 1 סעיף א'",
      "page_number": ${endPage || 1},
      "question_type": "journal_table | general_table | calculation | multiple_choice | open_question",
      "exact_book_text": "כל נוסח השאלה, הטבלה והמספרים במדויק מתוך העמוד"
    }
  ]
}`;
  };

  // Build list of chunks:
  // - If pageImages.length > 3: chunks of 3 pages per AI call!
  // - If 1..3 pageImages: single 1..3 page call.
  // - If native PDF fallback or text-only: chunk large text (> 8500 chars) or single call.
  const chunks = [];
  if (pageImages.length > 0) {
    const CHUNK_SIZE = 3;
    const totalPages = pageImages.length;
    for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
      const slice = pageImages.slice(i, i + CHUNK_SIZE);
      const startPage = Number(slice[0]?.pageNumber) || (i + 1);
      const endPage = Number(slice[slice.length - 1]?.pageNumber) || Math.min(totalPages, i + slice.length);
      chunks.push({
        images: slice,
        rawPdf: null,
        chunkText: sliceExtractedTextForPages(cleanText, startPage, endPage),
        startPage,
        endPage,
        totalPages
      });
    }
  } else if (hasNativePdfOnly) {
    chunks.push({
      images: [],
      rawPdf: rawPdfPart,
      chunkText: cleanText,
      startPage: 1,
      endPage: 1,
      totalPages: 1
    });
  } else if (cleanText) {
    if (cleanText.length > 8500) {
      const paragraphs = cleanText.split(/\n{2,}/);
      let buffer = '';
      let partNum = 1;
      const parts = [];
      for (const p of paragraphs) {
        if ((buffer + '\n\n' + p).length > 7500 && buffer.length > 0) {
          parts.push(buffer.trim());
          buffer = p;
        } else {
          buffer = buffer ? `${buffer}\n\n${p}` : p;
        }
      }
      if (buffer.trim()) parts.push(buffer.trim());
      for (const partText of parts) {
        chunks.push({
          images: [],
          rawPdf: null,
          chunkText: partText,
          startPage: partNum,
          endPage: partNum,
          totalPages: parts.length
        });
        partNum++;
      }
    } else {
      chunks.push({
        images: [],
        rawPdf: null,
        chunkText: cleanText,
        startPage: 1,
        endPage: 1,
        totalPages: 1
      });
    }
  }

  if (chunks.length === 0) {
    throw new Error('לא נמצא תוכן או עמודים למיפוי בקובץ שהועלה.');
  }

  let mergedTitle = '';
  const chunkSummaries = [];
  const allConceptOutlines = [];
  const allQuestionOutlines = [];
  const seenConceptKeys = new Set();
  const seenQuestionKeys = new Set();
  let lastChunkError = '';
  let anyChunkSucceeded = false;

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const ch = chunks[cIdx];
    if (pageImages.length > 3 || chunks.length > 1) {
      showStudyHelpLoadingOverlay(
        `ממפה מושגים ושאלות בעמודים ${ch.startPage} עד ${ch.endPage} מתוך ${ch.totalPages}...`
      );
    } else {
      showStudyHelpLoadingOverlay(
        hasAnyVisuals
          ? `ממפה מושגים ושאלות בעמודים ${ch.startPage} עד ${ch.endPage} מתוך ${ch.totalPages}...`
          : 'ממפה את כל המושגים והשאלות מתוך החומר שהועלה...'
      );
    }

    const prompt = buildChunkBlueprintPrompt(ch);
    let parsedChunk = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (attempt === 2) {
          await new Promise(r => setTimeout(r, 650));
          showStudyHelpLoadingOverlay(
            `מבצע ניסיון שני למיפוי מדויק של עמודים ${ch.startPage} עד ${ch.endPage} מתוך ${ch.totalPages}...`
          );
        }

        const raw = await callMultiTierAI(prompt, {
          systemInstruction,
          jsonMode: true,
          maxTokens: 8192,
          inlineImages: ch.images,
          rawPdfPart: ch.rawPdf
        });

        const candidate = parseJsonFromAIResponse(raw);
        if (
          candidate &&
          typeof candidate === 'object' &&
          (Array.isArray(candidate.concept_outlines) ||
            Array.isArray(candidate.question_outlines) ||
            Array.isArray(candidate.concepts) ||
            Array.isArray(candidate.questions))
        ) {
          parsedChunk = candidate;
          break;
        } else {
          lastChunkError = `מבנה JSON חסר בעמודים ${ch.startPage}-${ch.endPage}`;
        }
      } catch (err) {
        lastChunkError = err && err.message ? err.message : String(err);
        console.warn(`[BeatGenerator] Blueprint chunk ${cIdx + 1}/${chunks.length} attempt ${attempt} failed:`, err);
      }
    }

    if (!parsedChunk) {
      if (isFileUpload || hasAnyVisuals) {
        throw new Error(
          `לא הצלחנו להשלים מיפוי מלא של עמודים ${ch.startPage}-${ch.endPage} (${lastChunkError || 'שגיאת תקשורת'}). נסה שוב כדי להבטיח 0% השמטת חומר.`
        );
      }
      continue;
    }

    anyChunkSucceeded = true;

    if (!mergedTitle && parsedChunk.lesson_title && String(parsedChunk.lesson_title).trim()) {
      mergedTitle = String(parsedChunk.lesson_title).trim();
    }
    if (parsedChunk.pages_summary && String(parsedChunk.pages_summary).trim()) {
      chunkSummaries.push(String(parsedChunk.pages_summary).trim());
    }

    const rawConcepts = Array.isArray(parsedChunk.concept_outlines)
      ? parsedChunk.concept_outlines
      : (Array.isArray(parsedChunk.concepts) ? parsedChunk.concepts : []);

    for (const c of rawConcepts) {
      if (!c) continue;
      const term = String(c.term_name || '').trim();
      const pageNum = Math.max(1, Number(c.page_number) || ch.startPage || 1);
      const excerpt = String(c.raw_book_excerpt || c.textbook_example || c.simple_explanation || '').trim();
      if (!term && !excerpt) continue;
      const dedupeKey = `${pageNum}::${term.toLowerCase()}::${excerpt.slice(0, 60).toLowerCase()}`;
      if (seenConceptKeys.has(dedupeKey)) continue;
      seenConceptKeys.add(dedupeKey);

      allConceptOutlines.push({
        term_name: term || `מושג מעמוד ${pageNum}`,
        page_number: pageNum,
        source_section_label: String(c.source_section_label || `עמוד ${pageNum} - ${term || 'מושג מהספר'}`).trim(),
        raw_book_excerpt: excerpt || term
      });
    }

    const rawQuestions = Array.isArray(parsedChunk.question_outlines)
      ? parsedChunk.question_outlines
      : (Array.isArray(parsedChunk.questions) ? parsedChunk.questions : []);

    for (const q of rawQuestions) {
      if (!q) continue;
      const pageNum = Math.max(1, Number(q.page_number) || ch.startPage || 1);
      const label = String(q.question_number_label || `שאלה ${allQuestionOutlines.length + 1}`).trim();
      const exactText = String(q.exact_book_text || q.original_question || q.question || '').trim();
      if (!exactText && !label) continue;
      const dedupeKey = `${pageNum}::${label.toLowerCase()}::${exactText.slice(0, 80).toLowerCase()}`;
      if (seenQuestionKeys.has(dedupeKey)) continue;
      seenQuestionKeys.add(dedupeKey);

      allQuestionOutlines.push({
        question_number_label: label,
        page_number: pageNum,
        question_type: String(q.question_type || 'open_question').trim(),
        exact_book_text: exactText || label
      });
    }
  }

  if (!anyChunkSucceeded || (allConceptOutlines.length === 0 && allQuestionOutlines.length === 0)) {
    if (!isFileUpload && !hasAnyVisuals && cleanText) {
      const offlineBlueprint = buildGroundedPastedTextBlueprint({ extractedText: cleanText, sourceLabel });
      if (offlineBlueprint) return offlineBlueprint;
    }
    throw new Error(lastChunkError || 'המודל לא החזיר מושגים או שאלות מתוך העמודים שהועלו.');
  }

  const dateLabel = getTodayHebrewDateLabel();
  return {
    lesson_title: mergedTitle || sourceLabel || `שיעור יומי (${dateLabel})`,
    pages_summary: chunkSummaries.length > 0
      ? chunkSummaries.join(' • ')
      : 'יחידת לימוד מלאה המבוססת ב-100% על כל העמודים, המושגים והשאלות שבקובץ השיעור.',
    concept_outlines: allConceptOutlines,
    question_outlines: allQuestionOutlines
  };
}

/**
 * Formats an adaptation guidance paragraph injected into Beat prompts based on Daniel's live interaction signals.
 * @param {object} profile
 * @returns {string}
 */
function buildAdaptationGuidanceBlock(profile) {
  const p = profile && typeof profile === 'object' ? profile : createDefaultLearnerAdaptationProfile();
  const lines = [];

  if (p.askedForSimplerAnalogyCount > 0 || p.wrongMcAttemptsCount >= 2 || p.pace === 'careful_step_by_step') {
    lines.push('- דניאל ביקש הסברים פשוטים ומוחשיים יותר בפעימה הקודמת: השתמש בדוגמאות יומיומיות קצרות (כמו ארנק, קופה בסופר או חשבון בנק אישי) ופרק כל חישוב לשלבים קטנים וממוספרים.');
  } else {
    lines.push('- שמור על טון חם, מעודד ובגובה העיניים: פסקה ראשונה אינטואיטיבית ויומיומית, ופסקה שנייה המציגה את הכלל החשבונאי המלא מהספר בדיוק מקצועי.');
  }

  if (Array.isArray(p.challengingTerms) && p.challengingTerms.length > 0) {
    lines.push(`- מושגים שדרשו חיזוק לאחרונה (קשר אליהם בעדינות אם רלוונטי): ${p.challengingTerms.slice(-4).join(', ')}.`);
  }
  if (Array.isArray(p.masteredTerms) && p.masteredTerms.length > 0) {
    lines.push(`- מושגים שדניאל כבר פיצח בהצלחה וניתן להישען עליהם בביטחון: ${p.masteredTerms.slice(-5).join(', ')}.`);
  }
  if (Array.isArray(p.recentLearnerNotes) && p.recentLearnerNotes.length > 0) {
    lines.push(`- סגנון הניסוח האישי של דניאל בתשובותיו הפתוחות: "${p.recentLearnerNotes.slice(-2).join(' | ')}".`);
  }

  return lines.join('\n');
}

/**
 * Stage B — `generateConceptBeatContent(unit, beatIndex, learnerAdaptationProfile)`:
 * Generates the rich Concept Slide objects for the 1–3 concepts in `unit.conceptBeats[beatIndex]`,
 * grounded 100% in `raw_book_excerpt` with explicit source citations, worked book examples,
 * `interactive_widget`, strictly 2 `bottom_questions` (`mc_question` + `open_question`),
 * and initializes the Beat's `tutorSlide` (`required_terms_checklist`).
 * @param {object} unit
 * @param {number} beatIndex
 * @param {object} [learnerAdaptationProfile]
 * @returns {Promise<object|null>}
 */
async function generateConceptBeatContent(unit, beatIndex, learnerAdaptationProfile = null) {
  if (!unit || !Array.isArray(unit.conceptBeats) || !unit.conceptBeats[beatIndex]) {
    return null;
  }

  const lockKey = `${unit.id}::concept::${beatIndex}`;
  if (_inFlightBeatPromises.has(lockKey)) {
    return _inFlightBeatPromises.get(lockKey);
  }

  const jobPromise = (async () => {
    const beat = unit.conceptBeats[beatIndex];
    beat.status = 'generating';

    const profile = learnerAdaptationProfile || unit.learnerAdaptationProfile || createDefaultLearnerAdaptationProfile();
    const sourceLabel = unit.sourceLabel || unit.lesson_title || unit.title || 'קובץ השיעור';
    const outlines = Array.isArray(beat.conceptOutlines) ? beat.conceptOutlines : [];
    const relevantPages = outlines.map(o => Number(o.page_number) || 1);
    const beatImages = getSnapshotInlineImagesForPages(unit, relevantPages);

    const outlinesPayloadText = outlines.map((c, idx) => {
      const citation = `📍 מקור: ${sourceLabel} • עמוד ${c.page_number || 1} • ${c.source_section_label || ('עמוד ' + (c.page_number || 1))}`;
      return `מושג ${idx + 1} בפעימה:
- term_name: "${c.term_name}"
- page_number: ${c.page_number || 1}
- source_section_label: "${c.source_section_label || ''}"
- source_citation: "${citation}"
- raw_book_excerpt: """${c.raw_book_excerpt || ''}"""`;
    }).join('\n\n');

    const systemInstruction = `אתה מורה פרטי ומאמן הוראה מתקנת להנהלת חשבונות הבונה את פעימת הלימוד ${beatIndex + 1} עבור דניאל (בן 28).
כל שקופית מושג חייבת להיות מעוגנת ב-100% ב-raw_book_excerpt ובעמוד המקור מהספר ללא השמטת פרטים או מספרים, ומותאמת אישית לפרופיל הקצב של דניאל.
החזר אך ורק אובייקט JSON תקני בעברית.`;

    const prompt = `בנה תוכן שקופיות עשיר ומדויק עבור פעימת המושגים ${beatIndex + 1} מתוך ${unit.conceptBeats.length} בשיעור "${unit.lesson_title || unit.title}".

התאמה דינמית לפרופיל הלמידה הנוכחי של דניאל:
${buildAdaptationGuidanceBlock(profile)}

המושגים בפעימה זו (מתוך הספר):
${outlinesPayloadText}

עבור **כל אחד** מ-${outlines.length} המושגים שבפעימה זו (באותו סדר בדיוק!), החזר אובייקט במערך "slides" הכולל:
1. "paragraphs": מערך של 1-2 פסקאות קצרות ובהירות כבדולח — פסקה ראשונה נותנת את האינטואיציה הפשוטה מחיי היומיום, ופסקה שנייה מציגה את הכלל המלא מהספר ללא ויתור על עומק.
2. "book_example": הדוגמה הפתורה מתוך העמוד שהועלה מפורקת לצעדים ברורים עם המספרים המדויקים מהספר:
   { "title": "דוגמה מתוך עמוד X בספר", "exact_excerpt": "הנתונים והמספרים המדויקים מהספר", "steps": ["צעד 1...", "צעד 2..."] }
3. "interactive_widget": מיני-בדיקה אינטראקטיבית מובנית על המסך (למשל בחירת כיוון חובה/זכות לחשבון או בדיקת איזון קצרה):
   { "widget_type": "direction_selector | mini_balance_check", "prompt": "שאלת התנסות קצרה...", "options": ["אפשרות א", "אפשרות ב"], "correct_index": 0, "explanation": "משוב קצר ומחזק" }
4. "bottom_questions": **בדיוק 2 שאלות בתחתית השקופית**:
   - "mc_question": { "question": "שאלה אמריקאית על המושג והדוגמה", "options": ["תשובה 1", "תשובה 2", "תשובה 3", "תשובה 4"], "correct_index": 0, "explanation": "הסבר ברור לתשובה הנכונה" }
   - "open_question": { "question": "שאלת הבנה פתוחה קצרה במילים של דניאל", "expected_core_idea": "הרעיון המרכזי המצופה", "hint": "רמז עדין ומכוון" }

החזר אך ורק JSON תקני במבנה:
{
  "slides": [
    {
      "term_name": "...",
      "page_number": 1,
      "source_section_label": "...",
      "paragraphs": ["...", "..."],
      "book_example": {
        "title": "...",
        "exact_excerpt": "...",
        "steps": ["...", "..."]
      },
      "interactive_widget": {
        "widget_type": "direction_selector",
        "prompt": "...",
        "options": ["...", "..."],
        "correct_index": 0,
        "explanation": "..."
      },
      "bottom_questions": {
        "mc_question": {
          "question": "...",
          "options": ["...", "...", "...", "..."],
          "correct_index": 0,
          "explanation": "..."
        },
        "open_question": {
          "question": "...",
          "expected_core_idea": "...",
          "hint": "..."
        }
      }
    }
  ]
}`;

    let parsed = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await callMultiTierAI(prompt, {
          systemInstruction,
          jsonMode: true,
          maxTokens: 8192,
          inlineImages: beatImages
        });
        const candidate = parseJsonFromAIResponse(raw);
        if (candidate && Array.isArray(candidate.slides) && candidate.slides.length > 0) {
          parsed = candidate;
          break;
        }
      } catch (err) {
        console.warn(`[BeatGenerator] Concept Beat ${beatIndex} attempt ${attempt} failed:`, err);
      }
    }

    const rawSlides = parsed && Array.isArray(parsed.slides) ? parsed.slides : [];

    const normalizedSlides = outlines.map((outline, localIdx) => {
      const s = rawSlides[localIdx] || {};
      const globalConceptIdx = Array.isArray(beat.conceptIndices) && typeof beat.conceptIndices[localIdx] === 'number'
        ? beat.conceptIndices[localIdx]
        : localIdx;
      const existingConcept = (Array.isArray(unit.concepts) ? unit.concepts[globalConceptIdx] : null) || {};

      const pageNumber = Math.max(1, Number(outline.page_number || s.page_number) || 1);
      const sectionLabel = String(outline.source_section_label || s.source_section_label || `עמוד ${pageNumber}`).trim();
      const sourceCitation = `📍 מקור: ${sourceLabel} • עמוד ${pageNumber} • ${sectionLabel}`;

      const paragraphs = (Array.isArray(s.paragraphs) ? s.paragraphs : [])
        .map(p => String(p || '').trim())
        .filter(Boolean)
        .slice(0, 2);
      if (paragraphs.length === 0) {
        paragraphs.push(
          `בוא נבין יחד את המושג "${outline.term_name}" בצורה פשוטה ובהירה ישירות מתוך עמוד ${pageNumber} בספר.`,
          outline.raw_book_excerpt || outline.term_name
        );
      }

      const rawBookEx = s.book_example && typeof s.book_example === 'object' ? s.book_example : {};
      const exSteps = (Array.isArray(rawBookEx.steps) ? rawBookEx.steps : [])
        .map(st => String(st || '').trim())
        .filter(Boolean);
      const bookExample = {
        title: String(rawBookEx.title || `דוגמה מתוך עמוד ${pageNumber} בספר`).trim(),
        exact_excerpt: String(rawBookEx.exact_excerpt || outline.raw_book_excerpt || '').trim(),
        steps: exSteps.length > 0
          ? exSteps
          : ['קריאת הנתונים והסכומים מתוך הדוגמה בעמוד', 'יישום הכלל החשבונאי צעד אחר צעד ובדיקת איזון']
      };

      const rawWidget = s.interactive_widget && typeof s.interactive_widget === 'object' ? s.interactive_widget : {};
      const widgetOpts = (Array.isArray(rawWidget.options) && rawWidget.options.length >= 2)
        ? rawWidget.options.map(o => String(o).trim())
        : ['פועלים לפי הכלל והנתונים מהדוגמה בעמוד', 'רושמים ללא בדיקת הנתונים מהספר'];
      const interactiveWidget = {
        widget_type: String(rawWidget.widget_type || 'direction_selector').trim(),
        prompt: String(rawWidget.prompt || `בדיקה מהירה על "${outline.term_name}": מה הכיוון הנכון לפי הדוגמה בעמוד ${pageNumber}?`).trim(),
        options: widgetOpts,
        correct_index: Math.min(Math.max(0, Number(rawWidget.correct_index) || 0), widgetOpts.length - 1),
        explanation: String(rawWidget.explanation || 'מדויק! כך בדיוק מיישמים את הכלל מהספר.').trim(),
        completed: Boolean(existingConcept?.interactive_widget?.completed)
      };

      const rawBottom = s.bottom_questions && typeof s.bottom_questions === 'object' ? s.bottom_questions : {};
      const rawMc = rawBottom.mc_question && typeof rawBottom.mc_question === 'object' ? rawBottom.mc_question : {};
      const mcOptions = (Array.isArray(rawMc.options) && rawMc.options.length >= 2)
        ? rawMc.options.map(o => String(o).trim()).slice(0, 4)
        : [
            `יישום הכלל של "${outline.term_name}" לפי הנתונים בעמוד ${pageNumber}`,
            'התעלמות מנתוני העמוד בספר',
            'רישום אקראי ללא בדיקת הצדדים'
          ];
      const mcCorrectIdx = Math.min(Math.max(0, Number(rawMc.correct_index) || 0), mcOptions.length - 1);

      const rawOpen = rawBottom.open_question && typeof rawBottom.open_question === 'object' ? rawBottom.open_question : {};
      const bottomQuestions = {
        mc_question: {
          question: String(rawMc.question || `מה אומר הכלל של "${outline.term_name}" שלמדנו בעמוד ${pageNumber}?`).trim(),
          options: mcOptions,
          correct_index: mcCorrectIdx,
          explanation: String(rawMc.explanation || 'כל הכבוד! זו בדיוק המשמעות של המושג לפי הדוגמה בספר.').trim(),
          answeredCorrectly: Boolean(existingConcept.check1Passed || existingConcept.mastered)
        },
        open_question: {
          question: String(rawOpen.question || `הסבר במשפט קצר במילים שלך: איך נזהה ונשתמש ב"${outline.term_name}" בתרגיל?`).trim(),
          expected_core_idea: String(rawOpen.expected_core_idea || paragraphs.join(' ')).trim(),
          hint: String(rawOpen.hint || `היעזר בדוגמה מעמוד ${pageNumber}: ${bookExample.exact_excerpt.slice(0, 110)}`).trim(),
          userAnswer: String(existingConcept?.bottom_questions?.open_question?.userAnswer || ''),
          verified: Boolean(existingConcept.mastered)
        }
      };

      const formattedTextbookExample = [
        bookExample.exact_excerpt,
        ...bookExample.steps.map((st, idx) => `${idx + 1}. ${st}`)
      ].filter(Boolean).join('\n');

      const slideConceptObj = {
        ...existingConcept,
        id: existingConcept.id || `${unit.id}_c${globalConceptIdx + 1}`,
        index: globalConceptIdx + 1,
        beatIndex,
        isBeatReady: true,
        term_name: outline.term_name,
        page_number: pageNumber,
        source_section_label: sectionLabel,
        source_citation: sourceCitation,
        raw_book_excerpt: outline.raw_book_excerpt,
        paragraphs,
        book_example: bookExample,
        interactive_widget: interactiveWidget,
        bottom_questions: bottomQuestions,
        // Backward-compatible Stage 1 fields:
        simple_explanation: paragraphs.join('\n\n'),
        textbook_example: formattedTextbookExample,
        mfa_step1_question: bottomQuestions.mc_question.question,
        mfa_step1_options: bottomQuestions.mc_question.options,
        mfa_step1_correct_index: bottomQuestions.mc_question.correct_index,
        mfa_step2_why_question: bottomQuestions.open_question.question,
        mfa_step2_options: [
          bottomQuestions.open_question.expected_core_idea || 'הסבר מבוסס על הכלל והדוגמה מהספר',
          'ניחוש ללא קשר לכלל שלמדנו'
        ],
        mfa_step2_correct_index: 0,
        extraSimplerAnalogy: existingConcept.extraSimplerAnalogy || '',
        check1Passed: Boolean(existingConcept.check1Passed || existingConcept.mastered),
        openQuestionPassed: Boolean(existingConcept.openQuestionPassed || existingConcept.mastered),
        slideQuestionsCompleted: Boolean((existingConcept.check1Passed && existingConcept.openQuestionPassed) || existingConcept.slideQuestionsCompleted || existingConcept.mastered),
        mastered: Boolean(existingConcept.mastered)
      };

      if (Array.isArray(unit.concepts)) {
        unit.concepts[globalConceptIdx] = slideConceptObj;
      }

      return slideConceptObj;
    });

    beat.slides = normalizedSlides;
    const prevChecklist = Array.isArray(beat.tutorSlide?.required_terms_checklist)
      ? beat.tutorSlide.required_terms_checklist
      : [];
    const builtChecklist = normalizedSlides.map((s, sIdx) => {
      const prevItem = prevChecklist[sIdx];
      return {
        term_id: s.id,
        term_name: s.term_name,
        page_number: s.page_number,
        verified: Boolean(prevItem?.verified || s.mastered)
      };
    });
    const allBeatVerified = builtChecklist.length > 0 && builtChecklist.every(item => Boolean(item.verified));

    beat.tutorSlide = {
      beatIndex,
      required_terms_checklist: builtChecklist,
      chatHistory: Array.isArray(beat.tutorSlide?.chatHistory) ? beat.tutorSlide.chatHistory : [],
      handoffCompleted: Boolean(beat.tutorSlide?.handoffCompleted),
      all_beat_terms_mastered: Boolean(beat.tutorSlide?.all_beat_terms_mastered || allBeatVerified),
      completed: Boolean(beat.tutorSlide?.completed || allBeatVerified)
    };
    beat.status = 'ready';
    beat.generatedAt = new Date().toISOString();

    if (unit.learnerAdaptationProfile) {
      unit.learnerAdaptationProfile.dirtyForNextBeat = false;
    }

    // Refresh golden rules from Beat 1 once ready
    if (beatIndex === 0 && Array.isArray(unit.concepts) && unit.concepts.length > 0) {
      const topRules = unit.concepts
        .slice(0, 3)
        .map(c => `${c.term_name}: ${(Array.isArray(c.paragraphs) && c.paragraphs[0]) ? c.paragraphs[0] : (c.simple_explanation || '')}`);
      unit.goldenRules = topRules;
      unit.golden_rules = topRules;
    }

    return beat;
  })();

  _inFlightBeatPromises.set(lockKey, jobPromise);
  try {
    return await jobPromise;
  } finally {
    _inFlightBeatPromises.delete(lockKey);
  }
}

/**
 * Generates the grounded Stage 2 interactive Homework Solver questions for `unit.homeworkBeats[hwBeatIndex]`
 * (2–3 questions per beat), preserving 100% of `exact_book_text` from Beat 0 Blueprint and adapting
 * explanations/steps to `learnerAdaptationProfile`.
 * @param {object} unit
 * @param {number} hwBeatIndex
 * @param {object} [learnerAdaptationProfile]
 * @returns {Promise<object|null>}
 */
async function generateHomeworkBeatContent(unit, hwBeatIndex, learnerAdaptationProfile = null) {
  if (!unit || !Array.isArray(unit.homeworkBeats) || !unit.homeworkBeats[hwBeatIndex]) {
    return null;
  }

  const lockKey = `${unit.id}::homework::${hwBeatIndex}`;
  if (_inFlightBeatPromises.has(lockKey)) {
    return _inFlightBeatPromises.get(lockKey);
  }

  const jobPromise = (async () => {
    const hwBeat = unit.homeworkBeats[hwBeatIndex];
    hwBeat.status = 'generating';

    const profile = learnerAdaptationProfile || unit.learnerAdaptationProfile || createDefaultLearnerAdaptationProfile();
    const sourceLabel = unit.sourceLabel || unit.lesson_title || unit.title || 'קובץ השיעור';
    const qOutlines = Array.isArray(hwBeat.questionOutlines) ? hwBeat.questionOutlines : [];
    const relevantPages = qOutlines.map(q => Number(q.page_number) || 1);
    const beatImages = getSnapshotInlineImagesForPages(unit, relevantPages);

    const questionsPayloadText = qOutlines.map((q, idx) => (
      `שאלה ${idx + 1} בפעימת התרגול:
- question_number_label: "${q.question_number_label}"
- page_number: ${q.page_number || 1}
- question_type: "${q.question_type || 'open_question'}"
- exact_book_text: """${q.exact_book_text}"""`
    )).join('\n\n');

    const systemInstruction = `אתה מאמן אישי להנהלת חשבונות הבונה סביבת פתרון מודרכת עבור פעימת שיעורי הבית ${hwBeatIndex + 1} של דניאל (בן 28).
שמור מילה במילה על הנוסח והמספרים מתוך exact_book_text, ובנה עבור כל שאלה תרגום ידידותי, סכמת טבלה (אם רלוונטי), אפשרויות מונחות, וידוא הבנה וסיכום להעתקה למחברת.
החזר אך ורק אובייקט JSON תקני בעברית.`;

    const prompt = `בנה את נתוני הפתרון המודרכים עבור ${qOutlines.length} השאלות בפעימת התרגול ${hwBeatIndex + 1} מתוך ${unit.homeworkBeats.length} בשיעור "${unit.lesson_title || unit.title}".

התאמה דינמית לפרופיל הלמידה של דניאל:
${buildAdaptationGuidanceBlock(profile)}

השאלות המדויקות מהספר בפעימה זו:
${questionsPayloadText}

עבור **כל אחת** מ-${qOutlines.length} השאלות (באותו סדר בדיוק, מבלי לאחד שאלות ומבלי לדלג!), החזר איבר במערך "questions":
{
  "questions": [
    {
      "question_number_label": "...",
      "page_number": 4,
      "question_type": "journal_table | general_table | calculation | multiple_choice | open_question",
      "exact_book_text": "הציטוט המדויק מהספר",
      "friendly_translation": "תרגום פשוט, חם ומונגש לדניאל: מה מבקשים בשאלה הזו ואיך ניגשים אליה ברוגע",
      "table_schema": {
        "has_table": true,
        "columns": ["חובה", "זכות", "פרטים / שם החשבון"],
        "account_choices": ["קופה", "עו\\"ש בנק", "הכנסות ממכירות", "קניות סחורה", "ספקים", "לקוחות"],
        "expected_rows": [
          { "debit": "5000", "credit": "", "details": "קניות סחורה" },
          { "debit": "", "credit": "5000", "details": "עו\\"ש בנק" }
        ]
      },
      "guided_options": [
        "הפתרון הנכון והמלא לבחירה נוחה",
        "מסיח 1",
        "מסיח 2"
      ],
      "correct_option_index": 0,
      "mfa_verification": {
        "question": "למה הפתרון שבחרנו/רשמנו נכון ומאוזן?",
        "options": ["הנימוק הנכון והפשוט", "נימוק שגוי"],
        "correct_index": 0
      },
      "notebook_copy_summary": "הניסוח המדויק והמסודר שדניאל יעתיק למחברת",
      "step_by_step_guide": ["שלב 1...", "שלב 2..."],
      "hint": "רמז עדין ומכוון",
      "expected_answer_summary": "הפתרון המלא והמדויק"
    }
  ]
}`;

    let parsed = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await callMultiTierAI(prompt, {
          systemInstruction,
          jsonMode: true,
          maxTokens: 8192,
          inlineImages: beatImages
        });
        const candidate = parseJsonFromAIResponse(raw);
        if (candidate && Array.isArray(candidate.questions) && candidate.questions.length > 0) {
          parsed = candidate;
          break;
        }
      } catch (err) {
        console.warn(`[BeatGenerator] Homework Beat ${hwBeatIndex} attempt ${attempt} failed:`, err);
      }
    }

    const aiQuestions = parsed && Array.isArray(parsed.questions) ? parsed.questions : [];

    const normalizedQuestions = qOutlines.map((outline, localIdx) => {
      const q = aiQuestions[localIdx] || {};
      const globalQIdx = Array.isArray(hwBeat.questionIndices) && typeof hwBeat.questionIndices[localIdx] === 'number'
        ? hwBeat.questionIndices[localIdx]
        : localIdx;
      const existingQ = (Array.isArray(unit.questions) ? unit.questions[globalQIdx] : null) || {};

      const pageNumber = Math.max(1, Number(outline.page_number || q.page_number) || 1);
      const exactText = String(outline.exact_book_text || q.exact_book_text || `שאלה ${globalQIdx + 1}`).trim();
      const friendlyTrans = String(
        q.friendly_translation ||
        'נקרא יחד את נתוני השאלה מהעמוד בספר, נזהה את הסכומים ואת החשבונות המשתתפים ונרשום את הפתרון צעד אחר צעד.'
      ).trim();
      const stepGuide = Array.isArray(q.step_by_step_guide) && q.step_by_step_guide.length > 0
        ? q.step_by_step_guide.map(s => String(s).trim()).filter(Boolean)
        : ['שלב 1: קריאת הנתונים והסכומים מהעמוד בספר', 'שלב 2: רישום צד החובה וצד הזכות ובדיקת איזון'];

      const builtQ = {
        ...existingQ,
        id: existingQ.id || `${unit.id}_q${globalQIdx + 1}`,
        index: globalQIdx + 1,
        beatIndex: hwBeatIndex,
        isBeatReady: true,
        page_number: pageNumber,
        source_citation: `📍 מקור: ${sourceLabel} • עמוד ${pageNumber} • ${outline.question_number_label}`,
        question_number_label: String(outline.question_number_label || q.question_number_label || `שאלה ${globalQIdx + 1}`).trim(),
        question_type: String(q.question_type || outline.question_type || 'open_question').trim(),
        exact_book_text: exactText,
        original_question: exactText,
        questionText: exactText,
        friendly_translation: friendlyTrans,
        topic_focus: friendlyTrans,
        topic: friendlyTrans,
        table_schema: q.table_schema && typeof q.table_schema === 'object'
          ? q.table_schema
          : {
              has_table: ['journal_table', 'general_table'].includes(outline.question_type),
              columns: ['חובה', 'זכות', 'פרטים / שם החשבון'],
              account_choices: [],
              expected_rows: []
            },
        guided_options: Array.isArray(q.guided_options) ? q.guided_options : [],
        correct_option_index: Number(q.correct_option_index) || 0,
        mfa_verification: q.mfa_verification && typeof q.mfa_verification === 'object' ? q.mfa_verification : null,
        notebook_copy_summary: String(q.notebook_copy_summary || q.expected_answer_summary || '').trim(),
        step_by_step_guide: stepGuide,
        hint: String(q.hint || 'בדוק אילו חשבונות וסכומים מופיעים בנוסח השאלה ויישם את הכלל שלמדנו בשלב המושגים.').trim(),
        expected_answer_summary: String(q.expected_answer_summary || q.notebook_copy_summary || '').trim(),
        coreConcept: String(q.expected_answer_summary || q.notebook_copy_summary || '').trim(),
        isCompleted: Boolean(existingQ.isCompleted),
        chatHistory: Array.isArray(existingQ.chatHistory) ? existingQ.chatHistory : []
      };

      // Reset auto-seeded placeholder chat message if Daniel hasn't typed anything yet so friendly_translation appears!
      if (Array.isArray(unit.chatHistory) && Array.isArray(unit.chatHistory[globalQIdx])) {
        const hasUserTurn = unit.chatHistory[globalQIdx].some(m => m && m.role === 'user');
        if (!hasUserTurn) {
          unit.chatHistory[globalQIdx] = [];
        }
      }

      if (Array.isArray(unit.questions)) {
        unit.questions[globalQIdx] = builtQ;
      }

      return builtQ;
    });

    hwBeat.questions = normalizedQuestions;
    hwBeat.status = 'ready';
    hwBeat.generatedAt = new Date().toISOString();
    return hwBeat;
  })();

  _inFlightBeatPromises.set(lockKey, jobPromise);
  try {
    return await jobPromise;
  } finally {
    _inFlightBeatPromises.delete(lockKey);
  }
}

/**
 * Checks whether a unit still has any Concept Beats or Homework Beats not yet in `'ready'` state.
 * @param {object} unit
 * @returns {boolean}
 */
function hasPendingBeats(unit) {
  if (!unit) return false;
  const cPending = Array.isArray(unit.conceptBeats) && unit.conceptBeats.some(b => b && b.status !== 'ready');
  const hwPending = Array.isArray(unit.homeworkBeats) && unit.homeworkBeats.some(b => b && b.status !== 'ready');
  return Boolean(cPending || hwPending);
}

/**
 * Ensures a specific Concept Beat or Homework Beat is generated (or re-adapted if `forceAdapt === true`),
 * displaying the calming adaptation overlay if generation is required.
 * @param {object} unit
 * @param {'concept'|'homework'} beatType
 * @param {number} beatIndex
 * @param {boolean} [forceAdapt]
 * @returns {Promise<void>}
 */
async function ensureBeatReadyForLearner(unit, beatType, beatIndex, forceAdapt = false) {
  if (!unit) return;
  const beatsList = beatType === 'homework' ? unit.homeworkBeats : unit.conceptBeats;
  if (!Array.isArray(beatsList) || !beatsList[beatIndex]) return;

  const targetBeat = beatsList[beatIndex];
  if (targetBeat.status === 'ready' && !forceAdapt) {
    return;
  }

  showStudyHelpLoadingOverlay('בונה עבורך את הפעימה הבאה בהתאמה אישית לקצב שלך...');
  try {
    if (beatType === 'homework') {
      await generateHomeworkBeatContent(unit, beatIndex, unit.learnerAdaptationProfile);
    } else {
      await generateConceptBeatContent(unit, beatIndex, unit.learnerAdaptationProfile);
    }
    saveAppState();
  } finally {
    hideStudyHelpLoadingOverlay();
  }
}

/**
 * Stage C — Asynchronous Background Beat Queue (`runAsyncBeatsWorker(unitId)`):
 * Iteratively generates remaining `Concept Beats 2..K` and all `Homework Beats 1..M`
 * in the background, saving state after each beat completes without interrupting Daniel's active screen.
 * @param {string} unitId
 * @returns {Promise<void>}
 */
function runAsyncBeatsWorker(unitId) {
  if (!unitId) return Promise.resolve();
  if (_activeBeatWorkerPromises.has(unitId)) {
    return _activeBeatWorkerPromises.get(unitId);
  }

  const workerPromise = (async () => {
    try {
      const findLiveUnit = () => (Array.isArray(appState.studyHelpUnits) ? appState.studyHelpUnits : []).find(u => u && u.id === unitId);

      let unit = findLiveUnit();
      if (!unit) return;

      unit.beatsWorkerActive = true;

      // 1. Iteratively generate Concept Beats 1..K-1 (Beat 0 is already generated at launch, or resume if pending)
      const cBeatsCount = Array.isArray(unit.conceptBeats) ? unit.conceptBeats.length : 0;
      for (let bIdx = 0; bIdx < cBeatsCount; bIdx++) {
        unit = findLiveUnit();
        if (!unit) return;
        const cBeat = unit.conceptBeats[bIdx];
        if (!cBeat || cBeat.status === 'ready') continue;

        await generateConceptBeatContent(unit, bIdx, unit.learnerAdaptationProfile);

        unit = findLiveUnit();
        if (!unit) return;
        saveAppState();
        updateBackgroundBeatsBadgeInDom(unit);
      }

      // 2. Iteratively generate all Homework Beats 0..M-1
      const hwBeatsCount = Array.isArray(unit.homeworkBeats) ? unit.homeworkBeats.length : 0;
      for (let hwIdx = 0; hwIdx < hwBeatsCount; hwIdx++) {
        unit = findLiveUnit();
        if (!unit) return;
        const hwBeat = unit.homeworkBeats[hwIdx];
        if (!hwBeat || hwBeat.status === 'ready') continue;

        await generateHomeworkBeatContent(unit, hwIdx, unit.learnerAdaptationProfile);

        unit = findLiveUnit();
        if (!unit) return;
        saveAppState();
        updateBackgroundBeatsBadgeInDom(unit);
      }

      unit = findLiveUnit();
      if (unit) {
        unit.beatsWorkerActive = false;
        unit.allBeatsGenerated = true;
        saveAppState();
        updateBackgroundBeatsBadgeInDom(unit);
      }
    } catch (err) {
      console.warn('[BeatGenerator] Background beats worker encountered an error:', err);
    } finally {
      _activeBeatWorkerPromises.delete(unitId);
    }
  })();

  _activeBeatWorkerPromises.set(unitId, workerPromise);
  return workerPromise;
}

/**
 * Quietly updates the background Beat status pill in the DOM (if visible) without re-rendering inputs.
 * @param {object} unit
 */
function updateBackgroundBeatsBadgeInDom(unit) {
  if (typeof document === 'undefined' || !unit) return;
  const badgeEl = document.getElementById('study-beats-bg-status-pill');
  if (!badgeEl || appState.activeUnitId !== unit.id) return;

  const totalBeats = (unit.conceptBeats?.length || 0) + (unit.homeworkBeats?.length || 0);
  const readyBeats =
    (unit.conceptBeats || []).filter(b => b && b.status === 'ready').length +
    (unit.homeworkBeats || []).filter(b => b && b.status === 'ready').length;

  if (readyBeats >= totalBeats) {
    badgeEl.textContent = `✅ כל ${totalBeats} הפעימות מוכנות ומותאמות אישית`;
    badgeEl.style.background = '#dcfce7';
    badgeEl.style.color = '#166534';
  } else {
    badgeEl.textContent = `⚡ פעימות מוכנות ברקע: ${readyBeats}/${totalBeats}`;
  }
}

/**
 * Refactored Multi-Stage "Beats" Pipeline (`generateDailyStudyUnitFromMaterial`):
 * - Stage A: Runs `extractLessonBeatBlueprint` (3-page chunked Beat 0 Blueprint for 100% source retention)
 * - Stage B: Immediately generates `Concept Beat 1` (`beatIndex = 0`) grounded in `raw_book_excerpt`
 * - Stage C: Saves unit to `appState.studyHelpUnits` & `DatabaseManager`, hides initial upload overlay,
 *            immediately launches/opens the new unit, and starts `runAsyncBeatsWorker(unit.id)` in background!
 * Never injects fake hardcoded questions on file upload!
 * @param {object} params
 * @returns {Promise<object|null>}
 */
async function generateDailyStudyUnitFromMaterial({
  extractedText = '',
  inlineImages = [],
  pageSnapshots = [],
  rawPdfPart = null,
  sourceLabel = '',
  isFileUpload = false
} = {}) {
  _lastUploadRetryContext = {
    extractedText,
    inlineImages,
    pageSnapshots,
    rawPdfPart,
    sourceLabel,
    isFileUpload
  };

  let blueprint = null;
  try {
    blueprint = await extractLessonBeatBlueprint({
      extractedText,
      inlineImages,
      rawPdfPart,
      sourceLabel,
      isFileUpload
    });
  } catch (blueprintErr) {
    const diag = blueprintErr && blueprintErr.message ? blueprintErr.message : String(blueprintErr);
    showStudyHelpRetryModal(diag, async () => {
      if (_lastUploadRetryContext) {
        await generateDailyStudyUnitFromMaterial(_lastUploadRetryContext);
      }
    });
    return null;
  }

  const unitId = `sh_unit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const dateLabel = getTodayHebrewDateLabel();
  const cleanSourceLabel = String(sourceLabel || blueprint.lesson_title || `שיעור יומי (${dateLabel})`).trim();
  const lessonTitle = String(blueprint.lesson_title || cleanSourceLabel).trim();
  const pagesSummary = String(
    blueprint.pages_summary ||
    'ביחידה זו נעבור פעימה אחר פעימה על כל המושגים והדוגמאות מהעמודים שהעלית, ומיד לאחר מכן נפתור יחד את כל השאלות והטבלאות!'
  ).trim();

  // Store compact pageSnapshots ({ pageNumber, dataUrl }) on the unit object
  const storedSnapshots = Array.isArray(pageSnapshots) && pageSnapshots.length > 0
    ? pageSnapshots.map(s => ({
        pageNumber: Number(s.pageNumber) || 1,
        dataUrl: s.dataUrl || (s.data ? `data:${s.mimeType || 'image/jpeg'};base64,${s.data}` : '')
      }))
    : (Array.isArray(inlineImages)
      ? inlineImages
          .filter(img => img && !img.isNativePdf && img.mimeType !== 'application/pdf')
          .map((img, i) => ({
            pageNumber: Number(img.pageNumber) || i + 1,
            dataUrl: img.dataUrl || (img.data ? `data:${img.mimeType || 'image/jpeg'};base64,${img.data}` : '')
          }))
      : []);

  // Group outlines into Concept Beats (1-3 concepts/beat) and Homework Beats (2-3 questions/beat)
  const { normalizedOutlines, conceptBeats } = groupConceptOutlinesIntoBeats(
    blueprint.concept_outlines,
    unitId,
    {
      lessonTitle,
      pagesSummary,
      questionOutlines: blueprint.question_outlines
    }
  );
  const { normalizedQuestionOutlines, homeworkBeats } = groupQuestionOutlinesIntoBeats(
    blueprint.question_outlines,
    unitId
  );

  // Pre-seed placeholder entries for 100% accurate total counts across Roadmap & Timeline immediately
  const initialConcepts = normalizedOutlines.map((c, idx) => {
    const ownerBeatIdx = conceptBeats.findIndex(b => Array.isArray(b.conceptIndices) && b.conceptIndices.includes(idx));
    const citation = `📍 מקור: ${cleanSourceLabel} • עמוד ${c.page_number} • ${c.source_section_label}`;
    return {
      id: `${unitId}_c${idx + 1}`,
      index: idx + 1,
      beatIndex: ownerBeatIdx >= 0 ? ownerBeatIdx : 0,
      isBeatReady: false,
      term_name: c.term_name,
      page_number: c.page_number,
      source_section_label: c.source_section_label,
      source_citation: citation,
      raw_book_excerpt: c.raw_book_excerpt,
      paragraphs: [c.raw_book_excerpt],
      simple_explanation: c.raw_book_excerpt,
      textbook_example: c.raw_book_excerpt,
      mfa_step1_question: `מה אומר המושג "${c.term_name}"?`,
      mfa_step1_options: ['יישום הכלל מהספר', 'ניחוש ללא בדיקה'],
      mfa_step1_correct_index: 0,
      mfa_step2_why_question: 'הסבר במילים שלך את הרעיון המרכזי:',
      mfa_step2_options: ['בהתאם לדוגמה בעמוד הספר', 'ללא קשר לדוגמה'],
      mfa_step2_correct_index: 0,
      extraSimplerAnalogy: '',
      check1Passed: false,
      mastered: false
    };
  });

  const initialQuestions = normalizedQuestionOutlines.map((q, idx) => {
    const ownerHwBeatIdx = homeworkBeats.findIndex(b => Array.isArray(b.questionIndices) && b.questionIndices.includes(idx));
    return {
      id: `${unitId}_q${idx + 1}`,
      index: idx + 1,
      beatIndex: ownerHwBeatIdx >= 0 ? ownerHwBeatIdx : 0,
      isBeatReady: false,
      page_number: q.page_number,
      source_citation: `📍 מקור: ${cleanSourceLabel} • עמוד ${q.page_number} • ${q.question_number_label}`,
      question_number_label: q.question_number_label,
      question_type: q.question_type,
      exact_book_text: q.exact_book_text,
      original_question: q.exact_book_text,
      questionText: q.exact_book_text,
      friendly_translation: 'המאמן מכין את פירוק השלבים המותאם אישית לשאלה זו...',
      topic_focus: q.question_number_label,
      topic: q.question_number_label,
      table_schema: {
        has_table: ['journal_table', 'general_table'].includes(q.question_type),
        columns: ['חובה', 'זכות', 'פרטים / שם החשבון'],
        account_choices: [],
        expected_rows: []
      },
      guided_options: [],
      correct_option_index: 0,
      mfa_verification: null,
      notebook_copy_summary: '',
      step_by_step_guide: [],
      hint: '',
      expected_answer_summary: '',
      coreConcept: '',
      isCompleted: false,
      chatHistory: []
    };
  });

  const learnerAdaptationProfile = createDefaultLearnerAdaptationProfile();

  const newUnit = {
    id: unitId,
    createdAt: new Date().toISOString(),
    createdAtLabel: dateLabel,
    dateLabel,
    sourceLabel: cleanSourceLabel,
    title: lessonTitle,
    lesson_title: lessonTitle,
    pages_summary: pagesSummary,
    introText: pagesSummary,
    topic_summary: pagesSummary,
    goldenRules: [],
    golden_rules: [],
    introAndRules: [pagesSummary],
    blueprint: {
      lesson_title: lessonTitle,
      pages_summary: pagesSummary,
      total_concepts: normalizedOutlines.length,
      total_questions: normalizedQuestionOutlines.length
    },
    learnerAdaptationProfile,
    slideInteractionLog: [],
    currentSlideIdx: 0,
    promoCompleted: false,
    conceptBeats,
    homeworkBeats,
    beatsWorkerActive: false,
    allBeatsGenerated: false,
    concepts: initialConcepts,
    currentConceptIdx: 0,
    activeStage: 'stage1',
    pageSnapshots: storedSnapshots,
    questions: initialQuestions,
    chatHistory: initialQuestions.map(() => []),
    solvedQuestions: initialQuestions.map(() => false),
    currentQuestionIdx: 0,
    isNew: true,
    completed: false,
    isCompleted: false,
    summaryExamId: null
  };

  // Stage B + C: Immediately generate Concept Beat 1 (`beatIndex = 0`) so Daniel starts right away!
  showStudyHelpLoadingOverlay(
    `בונה את פעימת הלימוד הראשונה (1 מתוך ${conceptBeats.length}) מתוך עמודי השיעור...`
  );
  await generateConceptBeatContent(newUnit, 0, newUnit.learnerAdaptationProfile);
  newUnit.introAndRules = [pagesSummary, ...(newUnit.goldenRules || [])];

  if (!Array.isArray(appState.studyHelpUnits)) {
    appState.studyHelpUnits = [];
  }
  appState.studyHelpUnits.push(newUnit);

  if (!appState.studyHelp || typeof appState.studyHelp !== 'object') {
    appState.studyHelp = { dailyCards: [], activeCardId: null, sessions: [], activeSessionId: null, savedNotes: [], totalQuestionsAsked: 0 };
  }
  if (!Array.isArray(appState.studyHelp.dailyCards)) {
    appState.studyHelp.dailyCards = [];
  }
  appState.studyHelp.dailyCards.push(newUnit);
  appState.studyHelp.activeCardId = newUnit.id;

  saveAppState();
  if (typeof window !== 'undefined' && window.DatabaseManager && typeof window.DatabaseManager.add === 'function') {
    window.DatabaseManager.add('study_help', newUnit).catch(err => {
      console.warn('[BeatGenerator] DatabaseManager.add background warning:', err);
    });
  }

  hideStudyHelpLoadingOverlay();

  if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
    SoundService.playSuccessSound();
  }
  if (typeof showToast === 'function') {
    showToast('פעימה 1 מוכנה ללמידה! שאר הפעימות נבנות עבורך ברקע 🌟', 'success');
  }

  if (typeof renderRoadmap === 'function') {
    renderRoadmap();
  }

  // Immediately open Beat 1 for Daniel!
  openStudyHelpUnit(newUnit.id);

  // Launch background worker for Concept Beats 2..K and Homework Beats 1..M
  if (hasPendingBeats(newUnit)) {
    runAsyncBeatsWorker(newUnit.id);
  }

  return newUnit;
}

/**
 * Invokes `callGroqPreferredAI` (fast Groq channel for open checks & WhatsApp Private Tutor)
 * with seamless fallback to `callMultiTierAI` when running in environments without `callGroqPreferredAI`.
 * @param {string} prompt
 * @param {object} [options]
 * @returns {Promise<string>}
 */
async function invokeGroqPreferred(prompt, options = {}) {
  if (typeof callGroqPreferredAI === 'function') {
    return callGroqPreferredAI(prompt, options);
  }
  if (typeof window !== 'undefined' && typeof window.callGroqPreferredAI === 'function') {
    return window.callGroqPreferredAI(prompt, options);
  }
  return callMultiTierAI(prompt, options);
}

/**
 * Formats current time as HH:MM for WhatsApp chat bubbles.
 * @param {Date} [d]
 * @returns {string}
 */
function formatWhatsAppClockTime(d = new Date()) {
  const dt = d instanceof Date && !isNaN(d) ? d : new Date();
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

/**
 * Logs a slide interaction event into `unit.slideInteractionLog` for Private Tutor handoff & dynamic adaptation.
 * @param {object} unit
 * @param {object} entry
 */
function appendSlideInteractionLog(unit, entry) {
  if (!unit) return;
  if (!Array.isArray(unit.slideInteractionLog)) {
    unit.slideInteractionLog = [];
  }
  unit.slideInteractionLog.push({
    timestamp: new Date().toISOString(),
    ...entry
  });
  if (unit.slideInteractionLog.length > 120) {
    unit.slideInteractionLog = unit.slideInteractionLog.slice(-120);
  }
}

/**
 * Ensures `unit.concepts`, `unit.conceptBeats`, `unit.homeworkBeats`, and `unit.slideInteractionLog`
 * exist and are normalized (seamless upgrade for both new Beats units and previously saved legacy units).
 * @param {object} unit
 */
function ensureUnitConceptsState(unit) {
  if (!unit) return;
  if (!Array.isArray(unit.slideInteractionLog)) {
    unit.slideInteractionLog = [];
  }
  if (!unit.learnerAdaptationProfile || typeof unit.learnerAdaptationProfile !== 'object') {
    unit.learnerAdaptationProfile = createDefaultLearnerAdaptationProfile();
  }

  const unitAlreadyCompleted = Boolean(unit.completed || unit.isCompleted);

  if (!Array.isArray(unit.concepts) || unit.concepts.length === 0) {
    const rules = Array.isArray(unit.goldenRules) && unit.goldenRules.length > 0
      ? unit.goldenRules
      : [unit.introText || unit.topic_summary || 'זיהוי הנתונים בשאלה ורישום מאוזן של חובה וזכות'];

    unit.concepts = rules.map((rText, idx) => ({
      id: `${unit.id}_c${idx + 1}`,
      index: idx + 1,
      term_name: `כלל מפתח ${idx + 1} בשיעור`,
      page_number: 1,
      paragraphs: [String(rText)],
      simple_explanation: String(rText),
      textbook_example: (unit.questions && unit.questions[0] && (unit.questions[0].exact_book_text || unit.questions[0].original_question)) || String(rText),
      mfa_step1_question: 'איך ניישם את הכלל הזה בתרגול של היום?',
      mfa_step1_options: [
        'נבדוק את הנתונים בשאלה ונפעל בדיוק לפי הכלל צעד אחר צעד',
        'נדלג על בדיקת הנתונים'
      ],
      mfa_step1_correct_index: 0,
      mfa_step2_why_question: 'הסבר במילים שלך מדוע חשוב לפעול לפי הכלל הזה:',
      mfa_step2_options: [
        'כדי להבטיח פתרון מדויק ומאוזן ב-100% ללא ניחושים',
        'כי אין חשיבות לדיוק בנתונים'
      ],
      mfa_step2_correct_index: 0,
      extraSimplerAnalogy: '',
      check1Passed: unitAlreadyCompleted,
      openQuestionPassed: unitAlreadyCompleted,
      slideQuestionsCompleted: unitAlreadyCompleted,
      mastered: unitAlreadyCompleted
    }));
  }

  // Upgrade every concept so it always has `paragraphs`, `book_example`, `interactive_widget`, and `bottom_questions`
  const sourceLabel = unit.sourceLabel || 'קובץ השיעור';
  unit.concepts.forEach((c, idx) => {
    if (!c.id) c.id = `${unit.id}_c${idx + 1}`;
    c.page_number = Math.max(1, Number(c.page_number) || 1);
    if (!c.source_citation) {
      c.source_citation = `📍 מקור: ${sourceLabel} • עמוד ${c.page_number}`;
    }
    if (!Array.isArray(c.paragraphs) || c.paragraphs.length === 0) {
      c.paragraphs = String(c.simple_explanation || c.term_name || '')
        .split(/\n{2,}/)
        .map(s => s.trim())
        .filter(Boolean);
      if (c.paragraphs.length === 0) c.paragraphs = [c.term_name || `מושג ${idx + 1}`];
    }
    if (!c.book_example || typeof c.book_example !== 'object') {
      c.book_example = {
        title: `דוגמה מתוך עמוד ${c.page_number} בספר`,
        exact_excerpt: String(c.textbook_example || c.raw_book_excerpt || c.simple_explanation || '').trim(),
        steps: ['קריאת הנתונים והסכומים מתוך העמוד בספר', 'זיהוי הצדדים ויישום הכלל החשבונאי']
      };
    }
    if (!c.interactive_widget || typeof c.interactive_widget !== 'object' || !Array.isArray(c.interactive_widget.options)) {
      c.interactive_widget = {
        widget_type: 'direction_selector',
        prompt: `בדיקה מהירה על "${c.term_name}": מה הצעד הנכון לפי הדוגמה בספר?`,
        options: ['יישום הכלל לפי נתוני העמוד בספר', 'ניחוש ללא בדיקת הנתונים'],
        correct_index: 0,
        explanation: 'מדויק! תמיד נשענים על הנתונים מהעמוד בספר.',
        completed: Boolean(c.mastered)
      };
    }
    if (!c.bottom_questions || !c.bottom_questions.mc_question || !c.bottom_questions.open_question) {
      const legacyOpts = Array.isArray(c.mfa_step1_options) && c.mfa_step1_options.length >= 2
        ? c.mfa_step1_options
        : ['יישום הכלל לפי הדוגמה בעמוד הספר', 'ניחוש אקראי ללא בדיקה', 'התעלמות מנתוני השאלה'];
      c.bottom_questions = {
        mc_question: {
          question: String(c.mfa_step1_question || `מה אומר הכלל של "${c.term_name}"?`).trim(),
          options: legacyOpts,
          correct_index: Math.min(Math.max(0, Number(c.mfa_step1_correct_index) || 0), legacyOpts.length - 1),
          explanation: 'תשובה מדויקת! זה בדיוק הרעיון המרכזי.',
          answeredCorrectly: Boolean(c.check1Passed || c.mastered)
        },
        open_question: {
          question: `הסבר במשפט קצר במילים שלך: מה חשוב לזכור לגבי "${c.term_name}"?`,
          expected_core_idea: String(c.simple_explanation || c.paragraphs.join(' ')).trim(),
          hint: `היעזר בהסבר או בדוגמה מעמוד ${c.page_number} למעלה.`,
          userAnswer: '',
          verified: Boolean(c.openQuestionPassed || c.mastered)
        }
      };
    }
    if (c.mastered) {
      c.check1Passed = true;
      c.openQuestionPassed = true;
      c.slideQuestionsCompleted = true;
    } else if (c.check1Passed && c.openQuestionPassed) {
      c.slideQuestionsCompleted = true;
    }
  });

  // Upgrade legacy units lacking `conceptBeats` into ready 1-3 concept beats
  if (!Array.isArray(unit.conceptBeats) || unit.conceptBeats.length === 0) {
    const groups = [];
    for (let i = 0; i < unit.concepts.length; i += 3) {
      groups.push(unit.concepts.slice(i, i + 3));
    }
    let runningIdx = 0;
    unit.conceptBeats = groups.map((grp, bIdx) => {
      const cIndices = grp.map(() => {
        const cur = runningIdx++;
        unit.concepts[cur].beatIndex = bIdx;
        unit.concepts[cur].isBeatReady = true;
        return cur;
      });
      const allGrpMastered = grp.every(c => Boolean(c.mastered));
      return {
        beatIndex: bIdx,
        id: `${unit.id}_cbeat_${bIdx}`,
        status: 'ready',
        conceptOutlines: grp.map(c => ({
          term_name: c.term_name,
          page_number: c.page_number,
          source_section_label: `עמוד ${c.page_number}`,
          raw_book_excerpt: c.textbook_example || c.simple_explanation || ''
        })),
        conceptIndices: cIndices,
        slides: grp,
        tutorSlide: {
          beatIndex: bIdx,
          required_terms_checklist: grp.map(c => ({
            term_id: c.id,
            term_name: c.term_name,
            page_number: c.page_number,
            verified: Boolean(c.mastered)
          })),
          chatHistory: [],
          handoffCompleted: allGrpMastered,
          all_beat_terms_mastered: allGrpMastered,
          completed: allGrpMastered
        },
        completed: allGrpMastered
      };
    });
  } else {
    // Normalize existing `tutorSlide` structures on all `conceptBeats`
    unit.conceptBeats.forEach((beat, bIdx) => {
      if (!beat) return;
      const cIndices = Array.isArray(beat.conceptIndices) ? beat.conceptIndices : [];
      if (!beat.tutorSlide || typeof beat.tutorSlide !== 'object') {
        beat.tutorSlide = {
          beatIndex: bIdx,
          required_terms_checklist: [],
          chatHistory: [],
          handoffCompleted: false,
          all_beat_terms_mastered: false,
          completed: false
        };
      }
      if (!Array.isArray(beat.tutorSlide.required_terms_checklist) || beat.tutorSlide.required_terms_checklist.length === 0) {
        beat.tutorSlide.required_terms_checklist = cIndices.map(cIdx => {
          const cObj = unit.concepts[cIdx] || {};
          return {
            term_id: cObj.id || `${unit.id}_c${cIdx + 1}`,
            term_name: cObj.term_name || `מושג ${cIdx + 1}`,
            page_number: Number(cObj.page_number) || 1,
            verified: Boolean(cObj.mastered)
          };
        });
      } else {
        beat.tutorSlide.required_terms_checklist.forEach((chk, localIdx) => {
          const gIdx = cIndices[localIdx];
          const cObj = typeof gIdx === 'number' ? unit.concepts[gIdx] : null;
          if (!chk.term_id) {
            chk.term_id = (cObj && cObj.id) ? cObj.id : `${unit.id}_b${bIdx}_t${localIdx + 1}`;
          }
          if (cObj && cObj.term_name) {
            chk.term_name = cObj.term_name;
          }
          if (unitAlreadyCompleted) {
            chk.verified = true;
          }
        });
      }
      if (!Array.isArray(beat.tutorSlide.chatHistory)) {
        beat.tutorSlide.chatHistory = [];
      }
      if (unitAlreadyCompleted || beat.tutorSlide.completed || beat.tutorSlide.required_terms_checklist.every(t => Boolean(t.verified))) {
        if (beat.tutorSlide.required_terms_checklist.length > 0 && beat.tutorSlide.required_terms_checklist.every(t => Boolean(t.verified))) {
          beat.tutorSlide.all_beat_terms_mastered = true;
          beat.tutorSlide.completed = true;
          beat.completed = true;
        }
      }
    });
  }

  // Upgrade legacy units lacking `homeworkBeats`
  if ((!Array.isArray(unit.homeworkBeats) || unit.homeworkBeats.length === 0) && Array.isArray(unit.questions) && unit.questions.length > 0) {
    const qGroups = [];
    for (let i = 0; i < unit.questions.length; i += 3) {
      qGroups.push(unit.questions.slice(i, i + 3));
    }
    let runningQ = 0;
    unit.homeworkBeats = qGroups.map((qGrp, hwIdx) => {
      const qIndices = qGrp.map(() => {
        const cur = runningQ++;
        unit.questions[cur].beatIndex = hwIdx;
        unit.questions[cur].isBeatReady = true;
        return cur;
      });
      return {
        beatIndex: hwIdx,
        id: `${unit.id}_hwbeat_${hwIdx}`,
        status: 'ready',
        questionOutlines: qGrp.map((q, j) => ({
          question_number_label: q.question_number_label || `שאלה ${qIndices[j] + 1}`,
          page_number: Number(q.page_number) || 1,
          question_type: q.question_type || 'open_question',
          exact_book_text: q.exact_book_text || q.original_question || ''
        })),
        questionIndices: qIndices,
        questions: qGrp,
        completed: false
      };
    });
  }

  if (typeof unit.currentConceptIdx !== 'number' || unit.currentConceptIdx < 0 || unit.currentConceptIdx >= unit.concepts.length) {
    unit.currentConceptIdx = 0;
  }

  const allBeatsMastered = (unit.conceptBeats || []).every(b => Boolean(b?.tutorSlide?.all_beat_terms_mastered));
  if (typeof unit.currentSlideIdx !== 'number' || unit.currentSlideIdx < 0) {
    unit.currentSlideIdx = 0;
  }
  if (!unit.activeStage) {
    unit.activeStage = allBeatsMastered ? 'stage2' : 'stage1';
  }
  if (!allBeatsMastered) {
    unit.activeStage = 'stage1';
  }
}

// ============================================================================
// `UnitBeatCursor` — Ordered Phased Slide Deck & Mastery Gate Controller
// Sequence:
//   Slide 0: `PROMO_OVERVIEW_SLIDE`
//   For each `beatIndex` in `0 .. K-1`:
//     1-3 x `CONCEPT_SLIDE` -> 1 x `PRIVATE_TUTOR_SLIDE` (Groq WhatsApp Gate)
//   Only after ALL `conceptBeats` & `PRIVATE_TUTOR_SLIDE` gates pass:
//     `HOMEWORK_SLIDE` (0 .. M-1)
// ============================================================================

const UnitBeatCursor = {
  /**
   * Returns true iff ALL `conceptBeats` (and their `PRIVATE_TUTOR_SLIDE` WhatsApp gates) are 100% mastered.
   * @param {object} unit
   * @returns {boolean}
   */
  areAllConceptBeatsMastered(unit) {
    if (!unit) return false;
    ensureUnitConceptsState(unit);
    const beats = Array.isArray(unit.conceptBeats) ? unit.conceptBeats : [];
    if (beats.length === 0) return true;
    return beats.every(b => Boolean(b?.tutorSlide?.all_beat_terms_mastered || b?.tutorSlide?.completed));
  },

  /**
   * Builds the complete flat ordered slide deck for `unit` with live `isUnlocked` and `isCompleted` flags.
   * @param {object} unit
   * @returns {Array<object>}
   */
  getFlatSlideDeck(unit) {
    if (!unit) return [];
    ensureUnitConceptsState(unit);

    const deck = [];
    const concepts = Array.isArray(unit.concepts) ? unit.concepts : [];
    const conceptBeats = Array.isArray(unit.conceptBeats) ? unit.conceptBeats : [];
    const questions = Array.isArray(unit.questions) ? unit.questions : [];
    const solvedArr = Array.isArray(unit.solvedQuestions) ? unit.solvedQuestions : [];

    // Slide 0: PROMO_OVERVIEW_SLIDE
    deck.push({
      slideIndex: 0,
      type: 'PROMO_OVERVIEW_SLIDE',
      shortLabel: 'פתיחה',
      fullTitle: `פתיחת השיעור: ${unit.lesson_title || unit.title || ''}`,
      isUnlocked: true,
      isCompleted: Boolean(unit.promoCompleted || (unit.currentSlideIdx || 0) > 0 || unit.completed)
    });

    // Concept Beats (1-3 CONCEPT_SLIDE + 1 PRIVATE_TUTOR_SLIDE per beat)
    for (let bIdx = 0; bIdx < conceptBeats.length; bIdx++) {
      const beat = conceptBeats[bIdx];
      const prevBeatTutorMastered = bIdx === 0
        ? true
        : Boolean(conceptBeats[bIdx - 1]?.tutorSlide?.all_beat_terms_mastered || conceptBeats[bIdx - 1]?.tutorSlide?.completed);

      const cIndices = Array.isArray(beat?.conceptIndices) ? beat.conceptIndices : [];
      let allSlidesInBeatDone = true;
      let prevConceptSlideDone = true;

      for (let localIdx = 0; localIdx < cIndices.length; localIdx++) {
        const cIdx = cIndices[localIdx];
        const cObj = concepts[cIdx] || {};
        const slideQuestionsDone = Boolean(
          (cObj.check1Passed && cObj.openQuestionPassed) ||
          cObj.slideQuestionsCompleted ||
          cObj.mastered
        );
        const isUnlocked = Boolean(prevBeatTutorMastered && (localIdx === 0 ? true : prevConceptSlideDone));

        deck.push({
          slideIndex: deck.length,
          type: 'CONCEPT_SLIDE',
          beatIndex: bIdx,
          conceptIdx: cIdx,
          localIdxInBeat: localIdx,
          beatSize: cIndices.length,
          shortLabel: `מושג ${cIdx + 1}`,
          fullTitle: `מושג ${cIdx + 1}: ${cObj.term_name || ''}`,
          isUnlocked,
          isCompleted: slideQuestionsDone
        });

        if (!slideQuestionsDone) {
          allSlidesInBeatDone = false;
        }
        prevConceptSlideDone = slideQuestionsDone;
      }

      const tutorMastered = Boolean(beat?.tutorSlide?.all_beat_terms_mastered || beat?.tutorSlide?.completed);
      deck.push({
        slideIndex: deck.length,
        type: 'PRIVATE_TUTOR_SLIDE',
        beatIndex: bIdx,
        shortLabel: `מורה פרטי ${bIdx + 1}`,
        fullTitle: `שיחת מורה פרטי בוואטסאפ — קבוצה ${bIdx + 1} מתוך ${conceptBeats.length}`,
        isUnlocked: Boolean(prevBeatTutorMastered && allSlidesInBeatDone),
        isCompleted: tutorMastered
      });
    }

    // Homework Slides (Strictly locked until ALL Concept Beats + Private Tutor Slides are 100% mastered!)
    const allTutorGatesPassed = this.areAllConceptBeatsMastered(unit);
    for (let qIdx = 0; qIdx < questions.length; qIdx++) {
      const qObj = questions[qIdx] || {};
      const hwBeatIdx = typeof qObj.beatIndex === 'number' ? qObj.beatIndex : 0;
      const qSolved = Boolean(solvedArr[qIdx] || qObj.isCompleted);

      deck.push({
        slideIndex: deck.length,
        type: 'HOMEWORK_SLIDE',
        qIdx,
        hwBeatIndex: hwBeatIdx,
        shortLabel: qObj.question_number_label || `שאלה ${qIdx + 1}`,
        fullTitle: `${qObj.question_number_label || `שאלה ${qIdx + 1}`} (עמוד ${qObj.page_number || 1})`,
        isUnlocked: allTutorGatesPassed,
        isCompleted: qSolved
      });
    }

    return deck;
  },

  /**
   * Returns the current valid unlocked slide descriptor for `unit` (clamping `unit.currentSlideIdx` if needed).
   * @param {object} unit
   * @returns {object|null}
   */
  getCurrentSlide(unit) {
    const deck = this.getFlatSlideDeck(unit);
    if (deck.length === 0) return null;

    let idx = typeof unit.currentSlideIdx === 'number' ? unit.currentSlideIdx : 0;
    if (idx < 0 || idx >= deck.length) idx = 0;

    if (!deck[idx].isUnlocked) {
      // Snap back to the furthest unlocked slide in the deck
      let furthestUnlocked = 0;
      for (let i = 0; i < deck.length; i++) {
        if (deck[i].isUnlocked) furthestUnlocked = i;
      }
      idx = furthestUnlocked;
    }

    unit.currentSlideIdx = idx;
    return deck[idx];
  },

  /**
   * Navigates `unit` to `targetSlideIdx`, running Beat readiness checks or `performAsyncTutorContextHandoff`
   * when entering a `PRIVATE_TUTOR_SLIDE`, then re-renders `openStudyHelpUnit(unit.id)`.
   * @param {object} unit
   * @param {number} targetSlideIdx
   * @returns {Promise<boolean>}
   */
  async goToSlide(unit, targetSlideIdx) {
    if (!unit) return false;
    const deck = this.getFlatSlideDeck(unit);
    if (targetSlideIdx < 0 || targetSlideIdx >= deck.length) return false;

    const prevSlide = this.getCurrentSlide(unit);
    const targetSlide = deck[targetSlideIdx];

    if (!targetSlide.isUnlocked) {
      if (targetSlide.type === 'HOMEWORK_SLIDE') {
        if (typeof showToast === 'function') {
          showToast('שקופיות שיעורי הבית ייפתחו מיד לאחר שכל קבוצות המושגים יהיו ברורות ב-100% מול המורה הפרטי! ☀️🔒', 'warning');
        }
      } else if (targetSlide.type === 'PRIVATE_TUTOR_SLIDE') {
        if (typeof showToast === 'function') {
          showToast('השלם תחילה את 2 השאלות בתחתית שקופיות המושגים בקבוצה זו כדי להיכנס לשיחת המורה הפרטי! 📝', 'warning');
        }
      } else {
        if (typeof showToast === 'function') {
          showToast('השלם את השקופית הנוכחית כדי לפתוח את השקופית הבאה צעד אחר צעד 🌟', 'warning');
        }
      }
      return false;
    }

    if (prevSlide && prevSlide.type === 'PROMO_OVERVIEW_SLIDE' && targetSlideIdx > 0) {
      unit.promoCompleted = true;
    }

    if (targetSlide.type === 'CONCEPT_SLIDE') {
      const targetBeat = unit.conceptBeats?.[targetSlide.beatIndex];
      if (targetBeat) {
        const enteringNewBeat = prevSlide && prevSlide.beatIndex !== targetSlide.beatIndex;
        const targetUntouched = (targetBeat.conceptIndices || []).every(
          cIdx => !unit.concepts?.[cIdx]?.check1Passed && !unit.concepts?.[cIdx]?.openQuestionPassed && !unit.concepts?.[cIdx]?.mastered
        );
        const shouldAdapt = Boolean(enteringNewBeat && unit.learnerAdaptationProfile?.dirtyForNextBeat && targetUntouched);
        if (targetBeat.status !== 'ready' || shouldAdapt) {
          await ensureBeatReadyForLearner(unit, 'concept', targetSlide.beatIndex, shouldAdapt);
        }
      }
      unit.currentConceptIdx = targetSlide.conceptIdx;
      unit.activeStage = 'stage1';
    } else if (targetSlide.type === 'PRIVATE_TUTOR_SLIDE') {
      unit.activeStage = 'stage1';
      const beat = unit.conceptBeats?.[targetSlide.beatIndex];
      if (
        beat &&
        (!beat.tutorSlide?.handoffCompleted ||
          !Array.isArray(beat.tutorSlide?.chatHistory) ||
          beat.tutorSlide.chatHistory.length === 0)
      ) {
        await performAsyncTutorContextHandoff(unit, targetSlide.beatIndex);
      }
    } else if (targetSlide.type === 'HOMEWORK_SLIDE') {
      const hwBeat = unit.homeworkBeats?.[targetSlide.hwBeatIndex];
      if (hwBeat && hwBeat.status !== 'ready') {
        await ensureBeatReadyForLearner(unit, 'homework', targetSlide.hwBeatIndex, false);
      }
      unit.currentQuestionIdx = targetSlide.qIdx;
      unit.activeStage = 'stage2';
    } else {
      unit.activeStage = 'stage1';
    }

    unit.currentSlideIdx = targetSlideIdx;
    saveAppState();
    openStudyHelpUnit(unit.id);
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return true;
  },

  /**
   * Advances to the next slide in the flat deck (`unit.currentSlideIdx + 1`).
   * @param {object} unit
   * @returns {Promise<boolean>}
   */
  async advanceNext(unit) {
    const cur = this.getCurrentSlide(unit);
    if (!cur) return false;
    return this.goToSlide(unit, cur.slideIndex + 1);
  },

  /**
   * Navigates to the previous slide in the flat deck (`unit.currentSlideIdx - 1`).
   * @param {object} unit
   * @returns {Promise<boolean>}
   */
  async goPrev(unit) {
    const cur = this.getCurrentSlide(unit);
    if (!cur || cur.slideIndex <= 0) return false;
    return this.goToSlide(unit, cur.slideIndex - 1);
  },

  /**
   * Jumps directly to the `HOMEWORK_SLIDE` corresponding to `qIdx` (if unlocked).
   * @param {object} unit
   * @param {number} qIdx
   * @returns {Promise<boolean>}
   */
  async goToHomeworkQuestion(unit, qIdx) {
    const deck = this.getFlatSlideDeck(unit);
    const found = deck.find(s => s.type === 'HOMEWORK_SLIDE' && s.qIdx === qIdx);
    if (!found) return false;
    return this.goToSlide(unit, found.slideIndex);
  }
};

/**
 * Async Context Handoff (`performAsyncTutorContextHandoff(unit, beatIndex)`):
 * Displays `showStudyHelpLoadingOverlay("🔄 מעביר את התשובות והנקודות שלך למורה הפרטי ומכין את השיחה...")`
 * while `callGroqPreferredAI` synthesizes Daniel's answers/mistakes on the 1–3 Concept Slides of `beatIndex`
 * and generates the Private Tutor's personalized WhatsApp opening message!
 * @param {object} unit
 * @param {number} beatIndex
 * @returns {Promise<void>}
 */
async function performAsyncTutorContextHandoff(unit, beatIndex) {
  if (!unit || !Array.isArray(unit.conceptBeats) || !unit.conceptBeats[beatIndex]) return;
  const beat = unit.conceptBeats[beatIndex];
  ensureUnitConceptsState(unit);

  showStudyHelpLoadingOverlay('🔄 מעביר את התשובות והנקודות שלך למורה הפרטי ומכין את השיחה...');

  try {
    const checklist = beat.tutorSlide.required_terms_checklist || [];
    const cIndices = Array.isArray(beat.conceptIndices) ? beat.conceptIndices : [];
    const beatConceptsSummary = cIndices.map((gIdx, idx) => {
      const c = unit.concepts[gIdx] || {};
      return `${idx + 1}. מושג "${c.term_name}" (עמוד ${c.page_number || 1}): ${(c.paragraphs || [c.simple_explanation]).join(' ')}`;
    }).join('\n');

    const beatLogs = (Array.isArray(unit.slideInteractionLog) ? unit.slideInteractionLog : [])
      .filter(entry => Number(entry?.beatIndex) === Number(beatIndex))
      .slice(-12);

    const logsSummary = beatLogs.length > 0
      ? beatLogs.map(l => {
          if (l.questionType === 'open_question') {
            return `- בשאלה הפתוחה על "${l.term_name}" דניאל כתב: "${l.userAnswer}" (${l.passed ? 'עבר בהצלחה' : 'התקשה מעט'})`;
          }
          if (l.questionType === 'mc_question') {
            return `- בשאלה האמריקאית על "${l.term_name}": ${l.passed ? 'ענה נכון' : 'טעה בניסיון ראשון ותיקן'}`;
          }
          if (l.questionType === 'simpler_analogy') {
            return `- דניאל ביקש הסבר פשוט נוסף על "${l.term_name}"`;
          }
          return '';
        }).filter(Boolean).join('\n')
      : '- דניאל השלים את השקופיות בקבוצה זו בהצלחה.';

    const firstUnverifiedTerm = checklist.find(t => !t.verified) || checklist[0] || { term_name: 'המושג הראשון' };

    const systemInstruction = `אתה המורה הפרטי האישי של דניאל (בחור בן 28) בהנהלת חשבונות, המשוחח איתו בצ'אט בסגנון וואטסאפ טבעי, חם, קצר ובגובה העיניים.
כל הודעה שלך חייבת להיות קצרה וטבעית (1 עד 3 משפטים קצרים בלבד!). החזר אך ורק JSON תקני בעברית.`;

    const prompt = `דניאל סיים עכשיו את שקופיות קבוצת המושגים ${beatIndex + 1} מתוך ${unit.conceptBeats.length} בשיעור "${unit.lesson_title || unit.title}".

המושגים שחייבים להיות ברורים לו כמו שמש בבוקר בקבוצה זו:
${beatConceptsSummary}

מה דניאל ענה בשקופיות של קבוצה זו עכשיו:
${logsSummary}

כתוב הודעת פתיחה אישית קצרה בוואטסאפ לדניאל (1-3 משפטים קצרים בלבד!):
1. פרגן לו במשפט קצר על משהו ספציפי שהוא ענה/כתב בשקופיות עכשיו.
2. בקש ממנו להסביר לך במילים שלו מהראש ובפשטות את המושג הראשון ברשימה: "${firstUnverifiedTerm.term_name}" (למשל מה זה אומר או דוגמה קטנה), כדי שנסמן יחד שהכל ברור ב-100%.

החזר JSON תקני בלבד:
{
  "opening_whatsapp_message": "..."
}`;

    let openingText = '';
    try {
      const raw = await invokeGroqPreferred(prompt, {
        systemInstruction,
        jsonMode: true,
        maxTokens: 700
      });
      const parsed = parseJsonFromAIResponse(raw);
      if (parsed && typeof parsed.opening_whatsapp_message === 'string' && parsed.opening_whatsapp_message.trim()) {
        openingText = parsed.opening_whatsapp_message.trim();
      }
    } catch (err) {
      console.warn('[PrivateTutor Handoff] Fallback opening message used:', err);
    }

    if (!openingText) {
      const lastOpenEntry = [...beatLogs].reverse().find(l => l.questionType === 'open_question' && l.userAnswer);
      const personalNote = lastOpenEntry
        ? `אהבתי מאוד את מה שכתבת בשקופית ("${lastOpenEntry.userAnswer}")! 👏 `
        : 'כל הכבוד על השלמת השקופיות בקבוצה הזו! 👏 ';
      openingText = `${personalNote}בוא נוודא שהכל יושב בראש ברור כמו שמש בבוקר ☀️ — איך היית מסביר לי במשפט פשוט מהראש מה זה **${firstUnverifiedTerm.term_name}**?`;
    }

    beat.tutorSlide.chatHistory = [
      {
        role: 'tutor',
        text: openingText,
        timeLabel: formatWhatsAppClockTime(),
        timestamp: new Date().toISOString()
      }
    ];
    beat.tutorSlide.handoffCompleted = true;
    saveAppState();
  } finally {
    hideStudyHelpLoadingOverlay();
  }
}

/**
 * Evaluates Daniel's WhatsApp reply inside `PRIVATE_TUTOR_SLIDE` via `callGroqPreferredAI` (`jsonMode: true`),
 * returning `{ verified_term_ids, all_beat_terms_mastered, tutor_whatsapp_reply }` and updating the Sunlight Checklist!
 * @param {object} unit
 * @param {number} beatIndex
 * @param {string} userMessage
 * @returns {Promise<{ verified_term_ids: string[], all_beat_terms_mastered: boolean, tutor_whatsapp_reply: string }>}
 */
async function evaluatePrivateTutorTurnWithGroq(unit, beatIndex, userMessage) {
  const beat = unit.conceptBeats?.[beatIndex];
  const checklist = beat?.tutorSlide?.required_terms_checklist || [];
  const cIndices = Array.isArray(beat?.conceptIndices) ? beat.conceptIndices : [];

  const termsSpecText = checklist.map((item, idx) => {
    const gIdx = cIndices[idx];
    const cObj = typeof gIdx === 'number' ? (unit.concepts?.[gIdx] || {}) : {};
    const coreRule = Array.isArray(cObj.paragraphs) ? cObj.paragraphs.join(' ') : (cObj.simple_explanation || '');
    return `- term_id: "${item.term_id}" | term_name: "${item.term_name}" (עמוד ${item.page_number}) | סטטוס נוכחי: ${item.verified ? 'כבר אומת ✅' : 'ממתין לבדיקה ⏳'} | הסבר מהספר: ${coreRule}`;
  }).join('\n');

  const recentChatText = (beat?.tutorSlide?.chatHistory || [])
    .slice(-10)
    .map(m => `${m.role === 'user' ? 'דניאל' : 'המורה הפרטי'}: ${m.text}`)
    .join('\n');

  const alreadyVerifiedIds = checklist.filter(t => Boolean(t.verified)).map(t => t.term_id);

  const systemInstruction = `אתה המורה הפרטי האישי של דניאל (בן 28) בהנהלת חשבונות בצ'אט וואטסאפ.
סגנון השיחה שלך: חם, מעודד, ישראלי וטבעי, קצר וממוקד — בין 1 ל-3 משפטים קצרים בלבד בכל הודעה!
תפקידך לוודא שכל אחד מ-${checklist.length} המושגים ברשימת הקבוצה ברור לדניאל כמו שמש בבוקר במילים הפשוטות שלו (בלי העתק-הדבק ובלי לדרוש ניסוח אקדמי נוקשה — העיקר שהרעיון והכיוון נכונים!).
חוקים חשובים:
1. החזר ב-"verified_term_ids" את כל ה-term_id של המושגים שדניאל כבר הוכיח שהוא מבין (כולל אלו שכבר אומתו קודם + כל מושג שהוא הסביר נכון עכשיו).
2. אם עדיין נשארו מושגים ברשימה שטרם אומתו, פרגן על מה שהסביר נכון ושאל שאלה קצרה ופשוטה על המושג הבא ברשימה שטרם אומת ("all_beat_terms_mastered": false).
3. אם דניאל התבלבל או ביקש עזרה, תן לו דוגמה יומיומית קטנטנה ב-1-2 משפטים ובקש ממנו לנסות שוב במילים שלו ("all_beat_terms_mastered": false).
4. אך ורק כאשר **כל** ${checklist.length} המושגים שברשימה אומתו במלואם, החזר את כל ה-term_id שלהם ב-"verified_term_ids", קבע "all_beat_terms_mastered": true, וכתוב הודעת סיום נלהבת וקצרה שפותחת לו את ההמשך!
החזר אך ורק אובייקט JSON תקני בעברית.`;

  const prompt = `שיעור: "${unit.lesson_title || unit.title}" (קבוצת מושגים ${beatIndex + 1} מתוך ${unit.conceptBeats.length})

רשימת המושגים של הקבוצה לאימות:
${termsSpecText}

מושגים שכבר אומתו קודם: ${JSON.stringify(alreadyVerifiedIds)}

היסטוריית שיחת הוואטסאפ בקבוצה זו:
${recentChatText}

הודעה חדשה מדניאל עכשיו:
"${userMessage}"

החזר JSON תקני בלבד במבנה המדויק:
{
  "verified_term_ids": ["..."],
  "all_beat_terms_mastered": false,
  "tutor_whatsapp_reply": "הודעת וואטסאפ קצרה (1-3 משפטים) לדניאל"
}`;

  let verifiedSet = new Set(alreadyVerifiedIds);
  let replyText = '';
  let aiDeclaredAllMastered = false;

  try {
    const raw = await invokeGroqPreferred(prompt, {
      systemInstruction,
      jsonMode: true,
      maxTokens: 900
    });
    const parsed = parseJsonFromAIResponse(raw);
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.verified_term_ids)) {
        parsed.verified_term_ids.forEach(val => {
          const cleanVal = String(val || '').trim();
          if (!cleanVal) return;
          // Match by exact term_id or by term_name
          const matched = checklist.find(
            item => item.term_id === cleanVal || item.term_name.trim() === cleanVal
          );
          if (matched) {
            verifiedSet.add(matched.term_id);
          }
        });
      }
      aiDeclaredAllMastered = Boolean(parsed.all_beat_terms_mastered);
      if (typeof parsed.tutor_whatsapp_reply === 'string' && parsed.tutor_whatsapp_reply.trim()) {
        replyText = parsed.tutor_whatsapp_reply.trim();
      }
    }
  } catch (err) {
    console.warn('[PrivateTutor Groq] Fallback heuristic evaluation used:', err);
  }

  // Offline / fallback safety if AI returned empty reply
  if (!replyText) {
    const cleanUser = String(userMessage || '').trim();
    const wordCount = cleanUser.split(/\s+/).filter(Boolean).length;
    const nextUnverified = checklist.find(t => !verifiedSet.has(t.term_id));

    if (wordCount >= 3 && cleanUser.length >= 8 && nextUnverified) {
      verifiedSet.add(nextUnverified.term_id);
      const stillRemaining = checklist.find(t => !verifiedSet.has(t.term_id));
      if (stillRemaining) {
        replyText = `בול דניאל, הסברת מעולה את **${nextUnverified.term_name}**! 🙌 עכשיו בוא נבדוק את המושג הבא שלנו: איך היית מסביר במילים שלך מה זה **${stillRemaining.term_name}**?`;
      } else {
        replyText = `אלוף דניאל! 🌟 הסברת במילים שלך את כל המושגים בקבוצה הזו בצורה הכי ברורה שיש — הכל ברור כמו שמש בבוקר! אפשר להתקדם בשמחה הלאה.`;
      }
    } else if (nextUnverified) {
      replyText = `אתה בכיוון טוב דניאל! 💬 נסה לכתוב במשפט קצר ופשוט מהראש מה אומר המושג **${nextUnverified.term_name}** (או לתת דוגמה קטנה מחיי היומיום).`;
    } else {
      replyText = `מעולה דניאל! 🌟 כל המושגים בקבוצה הזו ברורים ב-100%!`;
    }
  }

  // Sync checklist verification flags
  checklist.forEach(item => {
    if (verifiedSet.has(item.term_id)) {
      item.verified = true;
    }
  });

  // Strict mastery check: if single concept and AI declared all mastered, mark verified;
  // for multi-concept beats, require every checklist term to be verified (or AI explicitly verified all).
  if (aiDeclaredAllMastered && (checklist.length <= 1 || verifiedSet.size >= checklist.length)) {
    checklist.forEach(item => { item.verified = true; });
  }
  const allMasteredNow = checklist.length > 0 && checklist.every(item => Boolean(item.verified));

  beat.tutorSlide.all_beat_terms_mastered = allMasteredNow;
  beat.tutorSlide.completed = allMasteredNow;
  beat.completed = allMasteredNow;

  // Update concept `mastered` flags for verified terms & award stars if newly mastered
  cIndices.forEach((gIdx, localIdx) => {
    const chk = checklist[localIdx];
    const cObj = unit.concepts?.[gIdx];
    if (chk && chk.verified && cObj) {
      cObj.mastered = true;
      if (!cObj.starAwarded) {
        cObj.starAwarded = true;
        awardStudyHelpStars(1, `אימות מושג מול המורה הפרטי: ${cObj.term_name}`);
      }
    }
  });

  appendSlideInteractionLog(unit, {
    slideType: 'PRIVATE_TUTOR_SLIDE',
    beatIndex,
    questionType: 'whatsapp_tutor_turn',
    userAnswer: userMessage,
    passed: allMasteredNow,
    verified_term_ids: Array.from(verifiedSet),
    aiFeedback: replyText
  });

  if (unit.learnerAdaptationProfile) {
    unit.learnerAdaptationProfile.recentLearnerNotes.push(userMessage);
    if (unit.learnerAdaptationProfile.recentLearnerNotes.length > 5) {
      unit.learnerAdaptationProfile.recentLearnerNotes.shift();
    }
  }

  return {
    verified_term_ids: checklist.filter(t => t.verified).map(t => t.term_id),
    all_beat_terms_mastered: allMasteredNow,
    tutor_whatsapp_reply: replyText
  };
}

/**
 * Ensures `unit.chatHistory` and `unit.solvedQuestions` arrays match `unit.questions` length
 * and seeds the opening coach message for `qIdx` if empty.
 * @param {object} unit
 * @param {number} qIdx
 */
function ensureUnitQuestionChatState(unit, qIdx) {
  const questions = Array.isArray(unit.questions) ? unit.questions : [];
  if (!Array.isArray(unit.chatHistory)) {
    unit.chatHistory = [];
  }
  if (!Array.isArray(unit.solvedQuestions)) {
    unit.solvedQuestions = questions.map(q => Boolean(q && q.isCompleted));
  }
  while (unit.chatHistory.length < questions.length) {
    unit.chatHistory.push([]);
  }
  while (unit.solvedQuestions.length < questions.length) {
    const idx = unit.solvedQuestions.length;
    unit.solvedQuestions.push(Boolean(questions[idx] && questions[idx].isCompleted));
  }

  if (!Array.isArray(unit.chatHistory[qIdx])) {
    const qObj = questions[qIdx];
    unit.chatHistory[qIdx] = (qObj && Array.isArray(qObj.chatHistory)) ? [...qObj.chatHistory] : [];
  }

  if (unit.chatHistory[qIdx].length === 0 && questions[qIdx]) {
    const qObj = questions[qIdx];
    const qText = qObj.exact_book_text || qObj.original_question || qObj.questionText || '';
    const friendly = qObj.friendly_translation || '';
    const openingText =
      `שלום דניאל! 👋 אנחנו ב**${qObj.question_number_label || `שאלה ${qIdx + 1}`}** מתוך ${questions.length}:\n` +
      `"**${qText}**"\n\n` +
      (friendly ? `💡 **במילים פשוטות:** ${friendly}\n\n` : '') +
      `בוא נסתכל יחד על השאלה הזו. מה לדעתך הפעולה הראשונה שקורה כאן, או איזה צד מקבל ואיזה צד נותן?`;

    unit.chatHistory[qIdx].push({
      role: 'coach',
      text: openingText,
      timestamp: new Date().toISOString()
    });
    saveAppState();
  }
}

/**
 * Calls `callMultiTierAI` (with `jsonMode: true`) to evaluate Daniel's reply or quick-assist request
 * for the active question in Socratic style.
 * @param {object} params
 * @returns {Promise<{ is_question_solved: boolean, coach_reply: string }>}
 */
async function evaluateStudyHelpTurnWithAI({ unit, qIdx, userText, assistMode = null }) {
  const qObj = (unit.questions || [])[qIdx] || {};
  const questionText = qObj.exact_book_text || qObj.original_question || qObj.questionText || '';
  const expectedAnswer = qObj.expected_answer_summary || qObj.notebook_copy_summary || qObj.coreConcept || '';
  const stepGuide = Array.isArray(qObj.step_by_step_guide) ? qObj.step_by_step_guide : [];
  const hintText = qObj.hint || 'זהה קודם מה נכנס לעסק (חובה) ומה יצא (זכות).';
  const history = Array.isArray(unit.chatHistory?.[qIdx]) ? unit.chatHistory[qIdx] : [];

  const recentTurnsText = history
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'דניאל' : 'המאמן'}: ${m.text}`)
    .join('\n');

  const systemInstruction = `אתה המאמן האישי של דניאל (בחור בן 28) בלימודי הנהלת חשבונות.
סגנון ההנחיה שלך: חם, סבלני, מעודד, בגובה העיניים ובשיטה סוקרטית (צעד אחר צעד).
החזר אך ורק אובייקט JSON תקני במבנה:
{
  "is_question_solved": true או false,
  "coach_reply": "התשובה שלך לדניאל בעברית ברורה ונעימה"
}`;

  let modeDirective = '';
  if (assistMode === 'hint') {
    modeDirective = `דניאל לחץ על כפתור העזרה "💡 תן לי רמז כיוון".
תן לו רמז חם ומכוון מבלי לגלות את התשובה הסופית, ושאל אותו שאלה מנחה פשוטה להמשך. חובה להחזיר "is_question_solved": false.`;
  } else if (assistMode === 'steps') {
    modeDirective = `דניאל לחץ על כפתור העזרה "🔍 פרק לי לשלבים קטנים".
פרק עבורו את השאלה הנוכחית ל-2 עד 3 שלבים קטנים וברורים, ובקש ממנו להתחיל בשלב 1 בלבד. חובה להחזיר "is_question_solved": false.`;
  } else if (assistMode === 'explain') {
    modeDirective = `דניאל לחץ על כפתור העזרה "📖 הסבר לי שוב בפשטות".
הסבר את הכלל החשבונאי שמאחורי השאלה במילים פשוטות עם דוגמה יומיומית קצרה, ושאל אותו איך ניישם זאת בשאלה שלנו. חובה להחזיר "is_question_solved": false.`;
  } else {
    modeDirective = `דניאל כתב תשובה או ניסיון פתרון: "${userText}".
בדוק את תשובתו מול הפתרון המצופה:
- אם התשובה חלקית או לא מדויקת ("is_question_solved": false): צטט בחום את דבריו של דניאל, חזק אותו על הכיוון, הסבר בפשטות מה כדאי לדייק מבלי לגלות את כל הפתרון הסופי, ושאל את השאלה המנחה הבאה.
- אם דניאל פתר נכון והבין את העיקרון והסכומים ("is_question_solved": true): שבח אותו בחום על החשיבה המדויקת שלו, וסכם במשפט אחד ברור את הפתרון המלא של השאלה!`;
  }

  const prompt = `נושא היחידה: ${unit.title}
שאלה נוכחית (${qIdx + 1}): "${questionText}"
תרגום מונגש: ${qObj.friendly_translation || qObj.topic_focus || ''}
שלבי פתרון מומלצים: ${stepGuide.join(' | ')}
רמז מוכן: ${hintText}
פתרון מצופה לבדיקת המאמן: ${expectedAnswer}

היסטוריית השיחה בשאלה זו:
${recentTurnsText}

${modeDirective}

החזר אך ורק JSON תקני:
{
  "is_question_solved": false,
  "coach_reply": "..."
}`;

  try {
    const raw = await callMultiTierAI(prompt, {
      systemInstruction,
      jsonMode: true
    });

    let parsed = null;
    if (typeof AIService !== 'undefined' && typeof AIService.cleanAndParseJSON === 'function') {
      parsed = AIService.cleanAndParseJSON(raw);
    } else {
      const m = String(raw || '').match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : raw);
    }

    if (parsed && typeof parsed.coach_reply === 'string' && parsed.coach_reply.trim()) {
      const solved = assistMode ? false : Boolean(parsed.is_question_solved);
      return {
        is_question_solved: solved,
        coach_reply: parsed.coach_reply.trim()
      };
    }
  } catch (err) {
    console.warn('[StudyHelp] Coach AI fallback triggered:', err);
  }

  if (assistMode === 'hint') {
    return {
      is_question_solved: false,
      coach_reply: `בשמחה דניאל! 💡 הנה רמז כיוון:\n${hintText}\n\nאיזה חשבון לדעתך מקבל כאן ערך (חובה)?`
    };
  }
  if (assistMode === 'steps') {
    const stepsFormatted = (stepGuide.length > 0 ? stepGuide : [
      'שלב 1: נזהה את הסכומים המופיעים בשאלה.',
      'שלב 2: נקבע איזה חשבון בחובה ואיזה חשבון בזכות.',
      'שלב 3: נוודא שסך החובה שווה לסך הזכות.'
    ]).map((s, i) => `${i + 1}. ${s}`).join('\n');
    return {
      is_question_solved: false,
      coach_reply: `בטח דניאל, בוא נפרק את זה לשלבים קטנים ונוחים 🔍:\n${stepsFormatted}\n\nבוא נתחיל רק משלב 1 — מהם הנתונים והסכומים שאתה מזהה בשאלה?`
    };
  }
  if (assistMode === 'explain') {
    return {
      is_question_solved: false,
      coach_reply: `בוא נסביר את זה הכי פשוט שיש 📖:\n${qObj.friendly_translation || 'כל מה שנכנס לעסק או מהווה הוצאה נרשם בצד חובה, וכל מה שיוצא מהעסק או מהווה הכנסה נרשם בצד זכות.'}\n\nלפי הכלל הזה, מה נכנס לעסק בשאלה שלנו ומה יצא?`
    };
  }

  const cleanUser = String(userText || '').trim();
  const hasAccountingTerms = /(חובה|זכות|מע"מ|מעמ|בנק|קופה|לקוח|ספק|קניות|מכירות|הוצאות|הכנסות|נכס|התחייבות|\d{2,})/.test(cleanUser);
  if (hasAccountingTerms && cleanUser.length >= 6) {
    return {
      is_question_solved: true,
      coach_reply: `כל הכבוד דניאל! 🌟 כתבת: "${cleanUser}" — זיהית נכון את כיוון הפעולה החשבונאית ואת שיוך החשבונות.\n📌 **סיכום הפתרון:** ${expectedAnswer}`
    };
  }

  return {
    is_question_solved: false,
    coach_reply: `תודה על התשובה דניאל ("${cleanUser}")! 👍 אתה בכיוון טוב. כדי שנשלים את הפתרון המדויק: ציין איזה חשבון נרשם ב**חובה**, איזה חשבון נרשם ב**זכות**, ומה הסכום של כל צד.`
  };
}

/**
 * Interactive Daily Study Unit View (`openStudyHelpUnit(unitId)`):
 * Driven by `UnitBeatCursor` (`getFlatSlideDeck(unit)`):
 * - Slide 0: `PROMO_OVERVIEW_SLIDE`
 * - Per Concept Beat (`beatIndex = 0 .. K-1`):
 *   - 1–3 x `CONCEPT_SLIDE` (paragraphs + book_example + interactive_widget + dual bottom questions)
 *   - Async Context Handoff -> `PRIVATE_TUTOR_SLIDE` (WhatsApp UI powered by Groq + Sunlight Mastery Checklist + Anti-ChatGPT Shield + Strict Phased Gate)
 * - Only after ALL `conceptBeats` & `PRIVATE_TUTOR_SLIDE` gates are 100% mastered:
 *   - `HOMEWORK_SLIDE`s (Grounded Stage 2 Homework & Table Solver)
 * @param {string} unitId
 */
function openStudyHelpUnit(unitId) {
  if (!Array.isArray(appState.studyHelpUnits)) {
    appState.studyHelpUnits = [];
  }

  let unit = appState.studyHelpUnits.find(u => u.id === unitId);
  if (!unit && Array.isArray(appState.studyHelp?.dailyCards)) {
    unit = appState.studyHelp.dailyCards.find(c => c.id === unitId);
    if (unit && !appState.studyHelpUnits.some(u => u.id === unit.id)) {
      appState.studyHelpUnits.push(unit);
    }
  }
  if (!unit) {
    if (typeof showToast === 'function') {
      showToast('יחידת התרגול לא נמצאה.', 'warning');
    }
    return;
  }

  unit.isNew = false;
  appState.activeUnitId = unit.id;

  if (!unit.learnerAdaptationProfile || typeof unit.learnerAdaptationProfile !== 'object') {
    unit.learnerAdaptationProfile = createDefaultLearnerAdaptationProfile();
  }

  ensureUnitConceptsState(unit);

  // Resume background worker if any Concept Beat or Homework Beat is still pending
  if (hasPendingBeats(unit)) {
    runAsyncBeatsWorker(unit.id);
  }

  const concepts = Array.isArray(unit.concepts) ? unit.concepts : [];
  const conceptBeats = Array.isArray(unit.conceptBeats) ? unit.conceptBeats : [];
  const questions = Array.isArray(unit.questions) ? unit.questions : [];
  const deck = UnitBeatCursor.getFlatSlideDeck(unit);
  const activeSlide = UnitBeatCursor.getCurrentSlide(unit) || {
    slideIndex: 0,
    type: 'PROMO_OVERVIEW_SLIDE',
    shortLabel: 'פתיחה',
    fullTitle: unit.lesson_title || unit.title || '',
    isUnlocked: true,
    isCompleted: false
  };

  // Sync Stage & Question/Concept indices from `activeSlide`
  if (activeSlide.type === 'CONCEPT_SLIDE') {
    unit.currentConceptIdx = activeSlide.conceptIdx;
    unit.activeStage = 'stage1';
  } else if (activeSlide.type === 'PRIVATE_TUTOR_SLIDE') {
    unit.activeStage = 'stage1';
  } else if (activeSlide.type === 'HOMEWORK_SLIDE') {
    unit.currentQuestionIdx = activeSlide.qIdx;
    unit.activeStage = 'stage2';
  } else {
    unit.activeStage = 'stage1';
  }

  if (typeof unit.currentQuestionIdx !== 'number' || unit.currentQuestionIdx < 0 || unit.currentQuestionIdx >= Math.max(1, questions.length)) {
    unit.currentQuestionIdx = 0;
  }
  const qIdx = unit.currentQuestionIdx;

  // Stage C Gate & Async Tutor Context Handoff Gate before rendering active slide
  if (activeSlide.type === 'CONCEPT_SLIDE') {
    const targetCBeatIdx = activeSlide.beatIndex;
    if (
      typeof targetCBeatIdx === 'number' &&
      targetCBeatIdx >= 0 &&
      conceptBeats[targetCBeatIdx] &&
      conceptBeats[targetCBeatIdx].status !== 'ready'
    ) {
      ensureBeatReadyForLearner(unit, 'concept', targetCBeatIdx).then(() => {
        openStudyHelpUnit(unit.id);
      });
      return;
    }
  } else if (activeSlide.type === 'PRIVATE_TUTOR_SLIDE') {
    const targetCBeatIdx = activeSlide.beatIndex;
    const beatObj = conceptBeats[targetCBeatIdx];
    if (beatObj && beatObj.status !== 'ready') {
      ensureBeatReadyForLearner(unit, 'concept', targetCBeatIdx)
        .then(() => performAsyncTutorContextHandoff(unit, targetCBeatIdx))
        .then(() => openStudyHelpUnit(unit.id));
      return;
    }
    if (
      beatObj &&
      (!beatObj.tutorSlide?.handoffCompleted ||
        !Array.isArray(beatObj.tutorSlide?.chatHistory) ||
        beatObj.tutorSlide.chatHistory.length === 0)
    ) {
      performAsyncTutorContextHandoff(unit, targetCBeatIdx).then(() => {
        openStudyHelpUnit(unit.id);
      });
      return;
    }
  } else if (activeSlide.type === 'HOMEWORK_SLIDE') {
    const targetHwBeatIdx = activeSlide.hwBeatIndex;
    if (
      typeof targetHwBeatIdx === 'number' &&
      targetHwBeatIdx >= 0 &&
      Array.isArray(unit.homeworkBeats) &&
      unit.homeworkBeats[targetHwBeatIdx] &&
      unit.homeworkBeats[targetHwBeatIdx].status !== 'ready'
    ) {
      ensureBeatReadyForLearner(unit, 'homework', targetHwBeatIdx).then(() => {
        openStudyHelpUnit(unit.id);
      });
      return;
    }
  }

  if (questions.length > 0) {
    ensureUnitQuestionChatState(unit, qIdx);
  } else if (!Array.isArray(unit.solvedQuestions)) {
    unit.solvedQuestions = [];
  }
  saveAppState();

  // Switch to #view-unit
  if (typeof showView === 'function') {
    showView('unit');
  } else {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const viewUnit = document.getElementById('view-unit');
    if (viewUnit) viewUnit.classList.add('active');
  }

  // Hide legacy #unit-steps-wrapper and show #unit-blocks-wrapper
  const stepsWrapper = document.getElementById('unit-steps-wrapper');
  const blocksWrapper = document.getElementById('unit-blocks-wrapper');
  if (stepsWrapper) stepsWrapper.style.display = 'none';
  if (!blocksWrapper) return;
  blocksWrapper.style.display = 'block';

  // Update top banner of #view-unit
  const viewTitleEl = document.getElementById('unit-view-title');
  const badgeEl = document.getElementById('unit-topic-badge');
  const mainTitleEl = document.getElementById('unit-main-title');
  const goalDescEl = document.getElementById('unit-goal-desc');

  const dateLabel = unit.createdAtLabel || unit.dateLabel || getTodayHebrewDateLabel();
  const displayTitle = unit.lesson_title || unit.title;
  const sourceLabel = unit.sourceLabel || 'קובץ השיעור';
  if (viewTitleEl) viewTitleEl.textContent = `📚 עזרה בלימודים • ${displayTitle}`;
  if (badgeEl) badgeEl.textContent = `📅 ${dateLabel}`;
  if (mainTitleEl) mainTitleEl.textContent = displayTitle;
  if (goalDescEl) goalDescEl.textContent = unit.pages_summary || unit.topic_summary || 'לימוד מונחה שקופית אחר שקופית מתוך עמודי השיעור שלך';

  const masteredBeatsCount = conceptBeats.filter(b => Boolean(b?.tutorSlide?.all_beat_terms_mastered || b?.tutorSlide?.completed)).length;
  const allConceptsMastered = UnitBeatCursor.areAllConceptBeatsMastered(unit);
  const isStage1Active = activeSlide.type !== 'HOMEWORK_SLIDE';
  const solvedQuestionsCount = Array.isArray(unit.solvedQuestions) ? unit.solvedQuestions.filter(Boolean).length : 0;
  const hasPageSnapshots = Array.isArray(unit.pageSnapshots) && unit.pageSnapshots.length > 0;
  const totalBeatsCount = conceptBeats.length + (unit.homeworkBeats?.length || 0);
  const readyBeatsCount =
    conceptBeats.filter(b => b && b.status === 'ready').length +
    (unit.homeworkBeats || []).filter(b => b && b.status === 'ready').length;

  const slideDeckHeaderHtml = `
    <div class="study-slide-deck-header" role="region" aria-label="סרגל שקופיות היחידה">
      <div class="study-slide-deck-header-right">
        <button
          type="button"
          id="btn-prev-slide-deck"
          class="secondary-btn study-slide-prev-btn"
          ${activeSlide.slideIndex <= 0 ? 'disabled' : ''}
        >
          <span>◀ השקופית הקודמת</span>
        </button>
        <span class="study-slide-counter-pill">
          שקופית ${activeSlide.slideIndex + 1} מתוך ${deck.length} • ${escapeHtmlAttr(activeSlide.shortLabel)}
        </span>
      </div>
      <div class="study-slide-deck-header-left">
        ${totalBeatsCount > 0 ? `
          <span
            id="study-beats-bg-status-pill"
            class="badge-tag"
            style="background:${readyBeatsCount >= totalBeatsCount ? '#dcfce7' : '#e0f2fe'};color:${readyBeatsCount >= totalBeatsCount ? '#166534' : '#0369a1'};font-weight:700;"
          >
            ${readyBeatsCount >= totalBeatsCount ? `✅ כל ${totalBeatsCount} קבוצות התוכן מוכנות` : `⚡ קבוצות מוכנות ברקע: ${readyBeatsCount}/${totalBeatsCount}`}
          </span>
        ` : ''}
        ${hasPageSnapshots ? `
          <button type="button" id="btn-open-all-pages-viewer" class="secondary-btn study-view-page-btn">
            <span>👁️ קובץ השיעור (${unit.pageSnapshots.length} עמודים)</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;

  // Build Habit & Momentum Bar + Visual Guiding Stones Timeline + 2-Stage Journey Bar + Slide Deck Header HTML
  const journeyBarHtml = `
    ${buildHabitMomentumBarHtml()}
    ${buildGuidingStonesTimelineHtml(unit)}
    <nav class="study-journey-bar" aria-label="שלבי הלמידה ביחידה">
      <button
        type="button"
        id="btn-journey-stage1"
        class="study-journey-stage-tab ${isStage1Active ? 'active' : ''} ${allConceptsMastered ? 'completed' : ''}"
      >
        <span class="journey-stage-icon">${allConceptsMastered ? '✅' : '1️⃣'}</span>
        <div class="journey-stage-info">
          <strong>שלב 1: שקופיות המושגים ושיחת המורה הפרטי (${masteredBeatsCount}/${conceptBeats.length} קבוצות)</strong>
          <small>1–3 שקופיות מושגים בכל קבוצה + אימות במילים שלך מול המורה הפרטי בוואטסאפ ☀️</small>
        </div>
      </button>

      <button
        type="button"
        id="btn-journey-stage2"
        class="study-journey-stage-tab ${!isStage1Active ? 'active' : ''} ${(!allConceptsMastered || questions.length === 0) ? 'locked' : ''}"
        ${(!allConceptsMastered || questions.length === 0) ? 'aria-disabled="true"' : ''}
      >
        <span class="journey-stage-icon">${!allConceptsMastered ? '🔒' : (solvedQuestionsCount === questions.length && questions.length > 0 ? '🏆' : '2️⃣')}</span>
        <div class="journey-stage-info">
          <strong>שלב 2: שקופיות שיעורי הבית מהספר (${solvedQuestionsCount}/${questions.length})</strong>
          <small>${questions.length === 0 ? 'קובץ זה מכיל מושגים ודוגמאות בלבד' : (!allConceptsMastered ? 'נפתח מיד לאחר שכל קבוצות המושגים מאומתות ב-100% מול המורה הפרטי!' : 'פתרון מודרך של כל שאלות שיעורי הבית מהספר (+2 ⭐ לשאלה)')}</small>
        </div>
      </button>
    </nav>
    ${slideDeckHeaderHtml}
  `;

  // ==========================================================================
  // SLIDE TYPE 0: `PROMO_OVERVIEW_SLIDE`
  // ==========================================================================
  if (activeSlide.type === 'PROMO_OVERVIEW_SLIDE') {
    blocksWrapper.innerHTML = `
      <div class="study-unit-player-container" dir="rtl">
        ${journeyBarHtml}

        <section class="card study-promo-overview-card" aria-label="פתיחת השיעור ומפת הדרך">
          <div class="study-promo-top-badges">
            <span class="study-today-date-badge">📅 ${dateLabel}</span>
            <span class="study-source-ref-badge">📍 מקור: ${escapeHtmlAttr(sourceLabel)}</span>
            <span class="badge-tag" style="background:#fef3c7;color:#92400e;font-weight:800;">🎬 שקופית פתיחה לשיעור</span>
          </div>

          <h2 class="study-promo-main-title">${displayTitle}</h2>
          <p class="study-promo-summary-text">
            ${formatCoachChatHtml(unit.pages_summary || unit.topic_summary || 'ביחידה זו נלמד צעד אחר צעד את כל המושגים והדוגמאות מהספר, נאמת אותם בשיחה קצרה עם המורה הפרטי, ונפתור יחד את שיעורי הבית.')}
          </p>

          <div class="study-promo-stats-grid">
            <div class="study-promo-stat-box">
              <span class="promo-stat-icon">💎</span>
              <div class="promo-stat-number">${conceptBeats.length}</div>
              <div class="promo-stat-label">קבוצות מושגים (${concepts.length} שקופיות מושגים)</div>
            </div>
            <div class="study-promo-stat-box">
              <span class="promo-stat-icon">☀️</span>
              <div class="promo-stat-number">${conceptBeats.length}</div>
              <div class="promo-stat-label">שיחות וואטסאפ קצרות עם המורה הפרטי</div>
            </div>
            <div class="study-promo-stat-box">
              <span class="promo-stat-icon">📝</span>
              <div class="promo-stat-number">${questions.length}</div>
              <div class="promo-stat-label">שאלות שיעורי בית מתוך הספר</div>
            </div>
          </div>

          <div class="study-promo-how-it-works">
            <div class="promo-how-title">🧭 איך עובדת הלמידה החכמה שלנו היום?</div>
            <ol class="promo-how-list">
              <li>בכל <strong>שקופית מושג</strong> קוראים הסבר קצר + דוגמה מהספר ועונים על <strong>2 שאלות קצרות</strong> בתחתית השקופית.</li>
              <li>אחרי כל <strong>1 עד 3 שקופיות מושגים</strong> עוברים ל<strong>שיחת וואטסאפ עם המורה הפרטי</strong> — מוודאים במילים שלך שהכל ברור כמו שמש בבוקר ☀️.</li>
              <li>רק כשכל המושגים ברורים ב-100%, נפתחות <strong>שקופיות שיעורי הבית</strong> מתוך הספר!</li>
            </ol>
          </div>

          <div class="study-promo-actions-row">
            ${deck.length > 1 ? `
              <button type="button" id="btn-start-first-beat-slide" class="primary-btn study-promo-start-btn">
                <span>🚀 התחל בקבוצת המושגים הראשונה ▶</span>
              </button>
            ` : `
              <button type="button" id="btn-finish-concepts-only-exam" class="primary-btn study-promo-start-btn">
                <span>🎉 צור לי מבחן מסכם 🏆</span>
              </button>
            `}
          </div>
        </section>
      </div>
    `;

    bindJourneyBarEvents(blocksWrapper, unit, allConceptsMastered);

    const startFirstSlideBtn = blocksWrapper.querySelector('#btn-start-first-beat-slide');
    if (startFirstSlideBtn) {
      startFirstSlideBtn.onclick = async () => {
        unit.promoCompleted = true;
        saveAppState();
        await UnitBeatCursor.advanceNext(unit);
      };
    }

    const finishEmptyBtn = blocksWrapper.querySelector('#btn-finish-concepts-only-exam');
    if (finishEmptyBtn) {
      finishEmptyBtn.onclick = async () => {
        await completeStudyHelpUnitAndGenerateExam(unit);
      };
    }
    return;
  }

  // ==========================================================================
  // SLIDE TYPE 1: `CONCEPT_SLIDE` (1-3 slides per Concept Beat)
  // ==========================================================================
  if (activeSlide.type === 'CONCEPT_SLIDE') {
    const cIdx = activeSlide.conceptIdx;
    const bIdx = activeSlide.beatIndex;
    const localIdx = activeSlide.localIdxInBeat;
    const beatSize = activeSlide.beatSize;
    const activeConcept = concepts[cIdx] || concepts[0];
    const pageNum = Number(activeConcept?.page_number) || 1;
    const q1Done = Boolean(activeConcept?.check1Passed || activeConcept?.mastered);
    const q2Done = Boolean(activeConcept?.openQuestionPassed || activeConcept?.mastered);
    const bothSlideQuestionsDone = Boolean(q1Done && q2Done);

    const sourceBadgeText = `📍 מקור: ${sourceLabel} • עמוד ${pageNum}`;

    const paragraphsHtml = Array.isArray(activeConcept?.paragraphs) && activeConcept.paragraphs.length > 0
      ? activeConcept.paragraphs
          .map(p => `<p class="study-panel-body-text" style="margin-bottom:0.65rem;">${formatCoachChatHtml(p)}</p>`)
          .join('')
      : `<p class="study-panel-body-text">${formatCoachChatHtml(activeConcept?.simple_explanation || '')}</p>`;

    const bookExObj = activeConcept?.book_example && typeof activeConcept.book_example === 'object'
      ? activeConcept.book_example
      : null;
    const bookExampleHtml = bookExObj
      ? `
        ${bookExObj.exact_excerpt ? `<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:0.75rem 0.9rem;margin-bottom:0.7rem;font-weight:600;color:#0f172a;">${formatCoachChatHtml(bookExObj.exact_excerpt)}</div>` : ''}
        ${Array.isArray(bookExObj.steps) && bookExObj.steps.length > 0 ? `
          <ol class="study-guiding-stones-list" style="margin:0;">
            ${bookExObj.steps.map((st, sIdx) => `
              <li class="study-guiding-stone-item">
                <span class="stone-num">${sIdx + 1}</span>
                <span class="stone-text">${formatCoachChatHtml(st)}</span>
              </li>
            `).join('')}
          </ol>
        ` : ''}
      `
      : `<p class="study-panel-body-text">${formatCoachChatHtml(activeConcept?.textbook_example || '')}</p>`;

    const widgetObj = activeConcept?.interactive_widget && Array.isArray(activeConcept.interactive_widget.options)
      ? activeConcept.interactive_widget
      : null;

    const mcQ = activeConcept?.bottom_questions?.mc_question || {
      question: activeConcept?.mfa_step1_question || `מה הרעיון המרכזי במושג "${activeConcept?.term_name || ''}"?`,
      options: activeConcept?.mfa_step1_options || ['יישום הכלל לפי הדוגמה בספר', 'ניחוש אקראי'],
      correct_index: Number(activeConcept?.mfa_step1_correct_index) || 0,
      explanation: 'תשובה מדויקת!'
    };
    const openQ = activeConcept?.bottom_questions?.open_question || {
      question: `הסבר במשפט קצר במילים שלך את "${activeConcept?.term_name || ''}":`,
      expected_core_idea: activeConcept?.simple_explanation || '',
      hint: `היעזר בהסבר או בדוגמה מעמוד ${pageNum} למעלה.`,
      userAnswer: ''
    };

    const isLastConceptSlideInBeat = localIdx >= beatSize - 1;

    blocksWrapper.innerHTML = `
      <div class="study-unit-player-container" dir="rtl">
        ${journeyBarHtml}

        <section class="card study-concept-mastery-card" aria-label="שקופית מושג ודוגמה מהספר">
          <!-- פס מיקום קבוצת המושגים הנוכחית -->
          <div class="study-q-progress-top">
            <div class="study-q-progress-headline">
              <span class="study-q-counter-badge">
                💎 קבוצת מושגים ${bIdx + 1} מתוך ${conceptBeats.length} • שקופית מושג ${localIdx + 1} מתוך ${beatSize} בקבוצה
              </span>
              <span class="study-q-solved-counter">
                ${bothSlideQuestionsDone ? '✅ 2/2 שאלות בשקופית הושלמו' : `${(q1Done ? 1 : 0) + (q2Done ? 1 : 0)} מתוך 2 שאלות בשקופית הושלמו`}
              </span>
            </div>
            <div class="study-q-progress-bar-track">
              <div class="study-q-progress-bar-fill" style="width:${bothSlideQuestionsDone ? 100 : ((q1Done || q2Done) ? 50 : 12)}%;"></div>
            </div>
          </div>

          <!-- תוכן שקופית המושג הפעילה -->
          <div class="study-concept-detail-box">
            <div class="study-concept-top-bar">
              <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                <span class="study-source-ref-badge">
                  ${escapeHtmlAttr(sourceBadgeText)}
                </span>
                ${bothSlideQuestionsDone ? `<span class="badge-completed-card">✅ מוכן להמשך!</span>` : ''}
              </div>
              <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                <button type="button" id="btn-simpler-analogy" class="study-quick-assist-chip">
                  <span>🤔 תסביר לי בעוד דרך פשוטה יותר</span>
                </button>
                <button type="button" id="btn-view-concept-page" class="secondary-btn study-view-page-btn" data-page-num="${pageNum}">
                  <span>👁️ הצג עמוד ${pageNum} מהספר</span>
                </button>
              </div>
            </div>

            <h3 class="study-concept-term-title">💡 מושג ${cIdx + 1}: ${activeConcept.term_name}</h3>

            <div class="study-concept-columns">
              <!-- בלוק 1: 1-2 פסקאות קצרות ובהירות -->
              <div class="study-concept-explain-panel simple-panel">
                <div class="study-panel-badge">🌱 הסבר קצר וברור (אינטואיציה + הכלל המלא מהספר)</div>
                ${paragraphsHtml}
                ${activeConcept.extraSimplerAnalogy ? `
                  <div class="study-extra-analogy-box">
                    <strong>✨ דוגמה פשוטה נוספת מחיי היומיום:</strong>
                    <p style="margin:0.3rem 0 0 0;">${formatCoachChatHtml(activeConcept.extraSimplerAnalogy)}</p>
                  </div>
                ` : ''}
              </div>

              <!-- בלוק 2: דוגמה פתורה מהעמוד בספר -->
              <div class="study-concept-explain-panel textbook-panel">
                <div class="study-panel-badge">📖 ${escapeHtmlAttr(bookExObj?.title || `דוגמה מתוך עמוד ${pageNum} בספר`)}</div>
                ${bookExampleHtml}
              </div>
            </div>

            <!-- מיקרו-ווידג'ט אינטראקטיבי של המושג -->
            ${widgetObj ? `
              <div class="study-mfa-step-box ${widgetObj.completed ? 'step-passed' : ''}" id="concept-interactive-widget-box" style="margin-top:1rem; background:#f8fafc;">
                <div class="study-mfa-step-badge">🧩 מיקרו-תרגול אינטראקטיבי על המושג</div>
                <p class="study-mfa-question-text">${formatCoachChatHtml(widgetObj.prompt)}</p>
                <div class="study-mfa-options-list">
                  ${widgetObj.options.map((wOpt, wIdx) => `
                    <button
                      type="button"
                      class="study-mfa-option-btn widget-opt-btn ${widgetObj.completed && wIdx === widgetObj.correct_index ? 'correct-selected' : ''}"
                      data-widget-opt-idx="${wIdx}"
                    >
                      <span class="opt-letter">${idxToHebrewLetter(wIdx)}.</span>
                      <span>${formatCoachChatHtml(wOpt)}</span>
                    </button>
                  `).join('')}
                </div>
                <div id="concept-widget-feedback" class="study-mfa-feedback ${widgetObj.completed ? 'success' : ''}" style="display:${widgetObj.completed ? 'block' : 'none'};">
                  ${widgetObj.completed ? `✅ ${formatCoachChatHtml(widgetObj.explanation)}` : ''}
                </div>
              </div>
            ` : ''}

            <!-- בתחתית השקופית: אך ורק 2 השאלות של שקופית זו (1 אמריקאית + 1 פתוחה במילים שלך) -->
            <div class="study-mfa-gate-container">
              <div class="study-mfa-header-row">
                <h4 class="study-mfa-gate-title">🎯 2 שאלות קצרות לסיכום השקופית (השלם את שתיהן כדי להמשיך)</h4>
              </div>

              <div class="study-dual-bottom-questions-grid">
                <!-- שאלה 1: אמריקאית -->
                <div class="study-bottom-q-card ${q1Done ? 'q-passed' : ''}" id="concept-q1-mc-card">
                  <div class="study-bottom-q-badge" id="concept-q1-status-badge">
                    ${q1Done ? '✅ שאלה 1 מתוך 2 (אמריקאית) — הושלם!' : '1️⃣ שאלה 1 מתוך 2 — שאלה אמריקאית'}
                  </div>
                  <p class="study-mfa-question-text">${formatCoachChatHtml(mcQ.question)}</p>
                  <div class="study-mfa-options-list">
                    ${(mcQ.options || []).map((opt, oIdx) => {
                      const isCorrectOpt = oIdx === Number(mcQ.correct_index || 0);
                      return `
                        <button
                          type="button"
                          class="study-mfa-option-btn step1-opt-btn ${q1Done && isCorrectOpt ? 'correct-selected' : ''}"
                          data-opt-idx="${oIdx}"
                        >
                          <span class="opt-letter">${idxToHebrewLetter(oIdx)}.</span>
                          <span>${formatCoachChatHtml(opt)}</span>
                        </button>
                      `;
                    }).join('')}
                  </div>
                  <div id="concept-mfa-step1-feedback" class="study-mfa-feedback ${q1Done ? 'success' : ''}" style="display:${q1Done ? 'block' : 'none'};">
                    ${q1Done ? `✅ ${formatCoachChatHtml(mcQ.explanation || 'תשובה נכונה ומדויקת!')}` : ''}
                  </div>
                </div>

                <!-- שאלה 2: פתוחה במילים שלך (נבדקת מול Groq AI) -->
                <div class="study-bottom-q-card ${q2Done ? 'q-passed' : ''}" id="concept-q2-open-card">
                  <div class="study-bottom-q-badge" id="concept-q2-status-badge">
                    ${q2Done ? '✅ שאלה 2 מתוך 2 (במילים שלך) — הושלם!' : '2️⃣ שאלה 2 מתוך 2 — הסבר קצר במילים שלך'}
                  </div>
                  <p class="study-mfa-question-text">${formatCoachChatHtml(openQ.question)}</p>
                  <div style="margin-bottom:0.55rem;">
                    <button type="button" id="btn-toggle-open-q-hint" class="study-quick-assist-chip" style="font-size:0.85rem;">
                      <span>💡 הצג רמז מכוון</span>
                    </button>
                    <div id="concept-open-q-hint-box" style="display:none; margin-top:0.45rem; padding:0.55rem 0.8rem; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; color:#92400e; font-size:0.92rem;">
                      💡 <strong>רמז:</strong> ${formatCoachChatHtml(openQ.hint || '')}
                    </div>
                  </div>
                  <div class="study-mfa-own-words-row">
                    <input
                      type="text"
                      id="concept-open-q-input"
                      class="styled-input study-own-words-input"
                      placeholder="כתוב כאן משפט קצר במילים שלך..."
                      value="${escapeHtmlAttr(openQ.userAnswer || '')}"
                    />
                    <button type="button" id="btn-submit-open-q" class="primary-btn" style="padding:0.6rem 1.1rem;">
                      <span>בדוק תשובה ✨</span>
                    </button>
                  </div>
                  <div id="concept-mfa-step2-feedback" class="study-mfa-feedback ${q2Done ? 'success' : ''}" style="display:${q2Done ? 'block' : 'none'};">
                    ${q2Done ? `✅ ${formatCoachChatHtml(openQ.lastAiFeedback || 'הסבר מצוין במילים שלך דניאל!')}` : ''}
                  </div>
                </div>
              </div>

              <!-- סרגל המשך לשקופית הבאה (נפתח אך ורק כששאלה 1 ושאלה 2 הושלמו!) -->
              <div class="study-slide-next-bar ${bothSlideQuestionsDone ? 'unlocked' : 'locked'}" id="concept-slide-next-bar">
                <div class="study-slide-next-caption" id="concept-slide-next-caption">
                  ${bothSlideQuestionsDone
                    ? (isLastConceptSlideInBeat
                        ? '✅ שתי השאלות בשקופית הושלמו! בשקופית הבאה נעביר את התשובות שלך למורה הפרטי בוואטסאפ ☀️'
                        : '✅ כל הכבוד דניאל! שתי השאלות בשקופית הזו הושלמו — אפשר להמשיך לשקופית הבאה!')
                    : '🔒 השלם את שאלה 1 ושאלה 2 למעלה כדי לפתוח את המעבר לשקופית הבאה'}
                </div>
                <button
                  type="button"
                  id="btn-advance-next-slide"
                  class="primary-btn study-advance-slide-btn"
                  ${!bothSlideQuestionsDone ? 'disabled' : ''}
                >
                  <span>המשך לשקופית הבאה ▶</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    `;

    bindJourneyBarEvents(blocksWrapper, unit, allConceptsMastered);

    // Bind Page Viewer Button ("👁️ הצג עמוד X מהספר")
    const viewConceptPageBtn = blocksWrapper.querySelector('#btn-view-concept-page');
    if (viewConceptPageBtn) {
      viewConceptPageBtn.onclick = () => {
        if (hasPageSnapshots) {
          openLessonPageViewerModal(unit, pageNum);
        } else if (typeof showToast === 'function') {
          showToast(`מקור המושג: ${sourceLabel} • עמוד ${pageNum} (ביחידה מטקסט מודבק אין צילום סרוק של העמוד)`, 'info');
        }
      };
    }

    // Helper to refresh unlock state of `#btn-advance-next-slide` live when Q1 and Q2 finish
    const syncSlideQuestionsGateUI = () => {
      const nowBothDone = Boolean(activeConcept.check1Passed && activeConcept.openQuestionPassed);
      if (nowBothDone) {
        activeConcept.slideQuestionsCompleted = true;
      }
      saveAppState();

      const nextBar = blocksWrapper.querySelector('#concept-slide-next-bar');
      const nextCaption = blocksWrapper.querySelector('#concept-slide-next-caption');
      const nextBtn = blocksWrapper.querySelector('#btn-advance-next-slide');

      if (nowBothDone) {
        if (nextBar) {
          nextBar.classList.remove('locked');
          nextBar.classList.add('unlocked');
        }
        if (nextCaption) {
          nextCaption.textContent = isLastConceptSlideInBeat
            ? '✅ שתי השאלות בשקופית הושלמו! בשקופית הבאה נעביר את התשובות שלך למורה הפרטי בוואטסאפ ☀️'
            : '✅ כל הכבוד דניאל! שתי השאלות בשקופית הזו הושלמו — אפשר להמשיך לשקופית הבאה!';
        }
        if (nextBtn) {
          nextBtn.disabled = false;
        }
      }
    };

    // Bind Interactive Concept Micro-Widget
    if (widgetObj) {
      const widgetFeedbackEl = blocksWrapper.querySelector('#concept-widget-feedback');
      blocksWrapper.querySelectorAll('.widget-opt-btn').forEach(wBtn => {
        wBtn.onclick = () => {
          const picked = Number(wBtn.getAttribute('data-widget-opt-idx'));
          if (picked === Number(widgetObj.correct_index || 0)) {
            widgetObj.completed = true;
            saveAppState();
            blocksWrapper.querySelectorAll('.widget-opt-btn').forEach(b => b.classList.remove('correct-selected', 'wrong-selected'));
            wBtn.classList.add('correct-selected');
            if (widgetFeedbackEl) {
              widgetFeedbackEl.style.display = 'block';
              widgetFeedbackEl.className = 'study-mfa-feedback success';
              widgetFeedbackEl.innerHTML = `✅ ${formatCoachChatHtml(widgetObj.explanation)}`;
            }
          } else {
            wBtn.classList.add('wrong-selected');
            if (widgetFeedbackEl) {
              widgetFeedbackEl.style.display = 'block';
              widgetFeedbackEl.className = 'study-mfa-feedback warning';
              widgetFeedbackEl.innerHTML = '💡 נסה שוב — הסתכל על הכיוון בדוגמה מהספר למעלה.';
            }
          }
        };
      });
    }

    // Bind "🤔 תסביר לי בעוד דרך פשוטה יותר" button (and log to slideInteractionLog!)
    const simplerBtn = blocksWrapper.querySelector('#btn-simpler-analogy');
    if (simplerBtn) {
      simplerBtn.onclick = async () => {
        simplerBtn.disabled = true;
        simplerBtn.innerHTML = '<span>⏳ מכין הסבר עוד יותר פשוט...</span>';
        unit.learnerAdaptationProfile.askedForSimplerAnalogyCount =
          (Number(unit.learnerAdaptationProfile.askedForSimplerAnalogyCount) || 0) + 1;
        unit.learnerAdaptationProfile.pace = 'careful_step_by_step';
        if (!unit.learnerAdaptationProfile.challengingTerms.includes(activeConcept.term_name)) {
          unit.learnerAdaptationProfile.challengingTerms.push(activeConcept.term_name);
        }
        unit.learnerAdaptationProfile.dirtyForNextBeat = true;
        appendSlideInteractionLog(unit, {
          slideType: 'CONCEPT_SLIDE',
          beatIndex: bIdx,
          conceptIdx: cIdx,
          term_name: activeConcept.term_name,
          questionType: 'simpler_analogy',
          passed: true
        });

        try {
          const prompt = `הסבר לדניאל (בן 28) את המושג "${activeConcept.term_name}" (מתוך השיעור "${displayTitle}") בדרך פשוטה עוד יותר, עם דוגמה מוחשית מחיי היומיום (כמו קניות בסופר, ארנק או חשבון בנק אישי) ב-2 משפטים קצרים וברורים.
הסבר נוכחי: ${(activeConcept.paragraphs || [activeConcept.simple_explanation]).join(' ')}`;
          const reply = await invokeGroqPreferred(prompt, { maxTokens: 700 });
          activeConcept.extraSimplerAnalogy = String(reply || '').trim();
        } catch (e) {
          activeConcept.extraSimplerAnalogy = `תחשוב על "${activeConcept.term_name}" כמו בדיקה פשוטה ביומיום: קודם מסתכלים מה קיבלנו ומה נתנו, ורושמים כל צד במקום הקבוע שלו כדי שלא נתבלבל.`;
        }
        saveAppState();
        openStudyHelpUnit(unit.id);
      };
    }

    // Bind Question 1 (Multiple-Choice)
    const step1Feedback = blocksWrapper.querySelector('#concept-mfa-step1-feedback');
    const q1Card = blocksWrapper.querySelector('#concept-q1-mc-card');
    const q1Badge = blocksWrapper.querySelector('#concept-q1-status-badge');
    const expectedMcIdx = Number(mcQ.correct_index || 0);

    blocksWrapper.querySelectorAll('.step1-opt-btn').forEach(btn => {
      btn.onclick = () => {
        const chosenIdx = Number(btn.getAttribute('data-opt-idx'));
        if (chosenIdx === expectedMcIdx) {
          activeConcept.check1Passed = true;
          mcQ.answeredCorrectly = true;
          appendSlideInteractionLog(unit, {
            slideType: 'CONCEPT_SLIDE',
            beatIndex: bIdx,
            conceptIdx: cIdx,
            term_name: activeConcept.term_name,
            questionType: 'mc_question',
            userAnswer: mcQ.options?.[chosenIdx] || '',
            passed: true
          });
          blocksWrapper.querySelectorAll('.step1-opt-btn').forEach(b => b.classList.remove('correct-selected', 'wrong-selected'));
          btn.classList.add('correct-selected');
          if (q1Card) q1Card.classList.add('q-passed');
          if (q1Badge) q1Badge.textContent = '✅ שאלה 1 מתוך 2 (אמריקאית) — הושלם!';
          if (step1Feedback) {
            step1Feedback.style.display = 'block';
            step1Feedback.className = 'study-mfa-feedback success';
            step1Feedback.innerHTML = `✅ ${formatCoachChatHtml(mcQ.explanation || 'תשובה נכונה ומדויקת!')}`;
          }
          if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
            SoundService.playSuccessSound();
          }
          syncSlideQuestionsGateUI();
        } else {
          btn.classList.add('wrong-selected');
          unit.learnerAdaptationProfile.wrongMcAttemptsCount =
            (Number(unit.learnerAdaptationProfile.wrongMcAttemptsCount) || 0) + 1;
          if (!unit.learnerAdaptationProfile.challengingTerms.includes(activeConcept.term_name)) {
            unit.learnerAdaptationProfile.challengingTerms.push(activeConcept.term_name);
          }
          if (unit.learnerAdaptationProfile.wrongMcAttemptsCount >= 2) {
            unit.learnerAdaptationProfile.pace = 'careful_step_by_step';
            unit.learnerAdaptationProfile.dirtyForNextBeat = true;
          }
          appendSlideInteractionLog(unit, {
            slideType: 'CONCEPT_SLIDE',
            beatIndex: bIdx,
            conceptIdx: cIdx,
            term_name: activeConcept.term_name,
            questionType: 'mc_question',
            userAnswer: mcQ.options?.[chosenIdx] || '',
            passed: false
          });
          saveAppState();

          if (step1Feedback) {
            step1Feedback.style.display = 'block';
            step1Feedback.className = 'study-mfa-feedback warning';
            step1Feedback.innerHTML = '💡 כמעט! קרא שוב את ההסבר והדוגמה מהספר למעלה ונסה לבחור את המשפט המדויק.';
          }
        }
      };
    });

    // Bind Question 2 (Open-Ended checked via `callGroqPreferredAI` / `invokeGroqPreferred`)
    const toggleHintBtn = blocksWrapper.querySelector('#btn-toggle-open-q-hint');
    const hintBox = blocksWrapper.querySelector('#concept-open-q-hint-box');
    if (toggleHintBtn && hintBox) {
      toggleHintBtn.onclick = () => {
        hintBox.style.display = hintBox.style.display === 'none' ? 'block' : 'none';
      };
    }

    const openQInput = blocksWrapper.querySelector('#concept-open-q-input');
    const submitOpenQBtn = blocksWrapper.querySelector('#btn-submit-open-q');
    const openQFeedback = blocksWrapper.querySelector('#concept-mfa-step2-feedback');
    const q2Card = blocksWrapper.querySelector('#concept-q2-open-card');
    const q2Badge = blocksWrapper.querySelector('#concept-q2-status-badge');

    if (submitOpenQBtn && openQInput) {
      submitOpenQBtn.onclick = async () => {
        const userWords = openQInput.value.trim();
        if (userWords.length < 3) {
          if (typeof showToast === 'function') {
            showToast('כתוב משפט קצר במילים שלך ונבדוק יחד 💡', 'warning');
          }
          openQInput.focus();
          return;
        }

        submitOpenQBtn.disabled = true;
        submitOpenQBtn.innerHTML = '<span>בודק...</span>';
        let passed = true;
        let feedbackMsg = 'ניסוח מצוין במילים שלך דניאל!';

        try {
          const evalPrompt = `דניאל לומד את המושג "${activeConcept.term_name}" (עמוד ${pageNum}).
השאלה הפתוחה בתחתית השקופית: "${openQ.question}"
הרעיון המרכזי המצופה: "${openQ.expected_core_idea || (activeConcept.paragraphs || []).join(' ')}"
תשובתו של דניאל במילים שלו: "${userWords}"
בדוק בעדינות ובהעצמה האם דניאל הבין את הכיוון המרכזי (אין צורך בניסוח אקדמי, העיקר שהרעיון נכון!). החזר JSON תקני בלבד בעברית:
{ "passed": true או false, "feedback": "משוב חם וקצר בעברית (1-2 משפטים)" }`;
          const raw = await invokeGroqPreferred(evalPrompt, { jsonMode: true, maxTokens: 512 });
          const parsed = parseJsonFromAIResponse(raw);
          if (parsed && typeof parsed.passed === 'boolean') {
            passed = parsed.passed;
            feedbackMsg = parsed.feedback || feedbackMsg;
          }
        } catch (err) {
          passed = userWords.length >= 4;
        }

        submitOpenQBtn.disabled = false;
        submitOpenQBtn.innerHTML = '<span>בדוק תשובה ✨</span>';
        openQ.userAnswer = userWords;
        openQ.lastAiFeedback = feedbackMsg;

        appendSlideInteractionLog(unit, {
          slideType: 'CONCEPT_SLIDE',
          beatIndex: bIdx,
          conceptIdx: cIdx,
          term_name: activeConcept.term_name,
          questionType: 'open_question',
          userAnswer: userWords,
          passed,
          aiFeedback: feedbackMsg
        });

        if (passed) {
          openQ.verified = true;
          activeConcept.openQuestionPassed = true;
          if (!unit.learnerAdaptationProfile.masteredTerms.includes(activeConcept.term_name)) {
            unit.learnerAdaptationProfile.masteredTerms.push(activeConcept.term_name);
          }
          unit.learnerAdaptationProfile.recentLearnerNotes.push(userWords);
          if (unit.learnerAdaptationProfile.recentLearnerNotes.length > 5) {
            unit.learnerAdaptationProfile.recentLearnerNotes.shift();
          }

          if (q2Card) q2Card.classList.add('q-passed');
          if (q2Badge) q2Badge.textContent = '✅ שאלה 2 מתוך 2 (במילים שלך) — הושלם!';
          if (openQFeedback) {
            openQFeedback.style.display = 'block';
            openQFeedback.className = 'study-mfa-feedback success';
            openQFeedback.innerHTML = `✅ ${formatCoachChatHtml(feedbackMsg)}`;
          }
          if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
            SoundService.playSuccessSound();
          }
          syncSlideQuestionsGateUI();
        } else {
          if (!unit.learnerAdaptationProfile.challengingTerms.includes(activeConcept.term_name)) {
            unit.learnerAdaptationProfile.challengingTerms.push(activeConcept.term_name);
          }
          unit.learnerAdaptationProfile.dirtyForNextBeat = true;
          saveAppState();
          if (openQFeedback) {
            openQFeedback.style.display = 'block';
            openQFeedback.className = 'study-mfa-feedback warning';
            openQFeedback.innerHTML = `💡 ${formatCoachChatHtml(feedbackMsg)}`;
          }
        }
      };

      openQInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitOpenQBtn.click();
        }
      };
    }

    // Bind "המשך לשקופית הבאה ▶"
    const advanceSlideBtn = blocksWrapper.querySelector('#btn-advance-next-slide');
    if (advanceSlideBtn) {
      advanceSlideBtn.onclick = async () => {
        if (!activeConcept.check1Passed || !activeConcept.openQuestionPassed) return;
        await UnitBeatCursor.advanceNext(unit);
      };
    }

    return;
  }

  // ==========================================================================
  // SLIDE TYPE 2: `PRIVATE_TUTOR_SLIDE` (Groq WhatsApp UI + Sunlight Checklist + Anti-ChatGPT Shield)
  // ==========================================================================
  if (activeSlide.type === 'PRIVATE_TUTOR_SLIDE') {
    const bIdx = activeSlide.beatIndex;
    const beat = conceptBeats[bIdx];
    const tutorSlide = beat?.tutorSlide || { required_terms_checklist: [], chatHistory: [], all_beat_terms_mastered: false };
    const checklist = Array.isArray(tutorSlide.required_terms_checklist) ? tutorSlide.required_terms_checklist : [];
    const allBeatTermsMastered = Boolean(
      tutorSlide.all_beat_terms_mastered &&
      checklist.length > 0 &&
      checklist.every(item => Boolean(item.verified))
    );
    const isLastConceptBeat = bIdx >= conceptBeats.length - 1;
    const gateBtnLabel = !isLastConceptBeat
      ? '🎉 הבנתי ב-100%! המשך לקבוצת המושגים הבאה ▶'
      : (questions.length > 0
          ? '🔓 כל המושגים ביחידה ברורים ב-100%! פתח את שקופיות שיעורי הבית ▶'
          : '🎉 כל המושגים ביחידה ברורים ב-100%! צור לי מבחן מסכם 🏆');

    const chatMessages = Array.isArray(tutorSlide.chatHistory) ? tutorSlide.chatHistory : [];

    blocksWrapper.innerHTML = `
      <div class="study-unit-player-container" dir="rtl">
        ${journeyBarHtml}

        <!-- באנר עליון: רשימת המושגים שחייבים להיות ברורים כמו שמש בבוקר -->
        <section class="sunlight-mastery-banner" aria-label="רשימת מושגי השמש לקבוצה זו">
          <div class="sunlight-banner-title">
            ☀️ רשימת המושגים שחייבים להיות ברורים כמו שמש בבוקר (קבוצה ${bIdx + 1} מתוך ${conceptBeats.length})
          </div>
          <div class="sunlight-checklist-pills" id="sunlight-checklist-pills">
            ${checklist.map(chk => `
              <div
                class="sunlight-term-pill ${chk.verified ? 'verified' : 'pending'}"
                data-term-id="${escapeHtmlAttr(chk.term_id)}"
              >
                <span class="sunlight-pill-term">${escapeHtmlAttr(chk.term_name)} (עמ' ${chk.page_number})</span>
                <span class="sunlight-pill-status">${chk.verified ? '✅ מובן ב-100%!' : '⏳ ממתין לבדיקה'}</span>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- ממשק שיחת וואטסאפ עם המורה הפרטי (Groq AI) -->
        <section class="whatsapp-tutor-card" aria-label="שיחת וואטסאפ עם המורה הפרטי">
          <header class="whatsapp-tutor-header">
            <div class="whatsapp-tutor-avatar" aria-hidden="true">👨‍🏫</div>
            <div class="whatsapp-tutor-header-info">
              <div class="whatsapp-tutor-name">המורה הפרטי של דניאל</div>
              <div class="whatsapp-tutor-status">מחובר כעת • שיחה מהירה ואישית במילים שלך 💬</div>
            </div>
            <span class="whatsapp-shield-badge" title="מגן למידה עצמאית פעיל">🛡️ במילים שלך מהראש</span>
          </header>

          <div class="whatsapp-tutor-feed" id="whatsapp-tutor-feed">
            ${chatMessages.map(msg => {
              const isUser = msg.role === 'user';
              return isUser ? `
                <div class="whatsapp-bubble-row outgoing-row">
                  <div class="whatsapp-bubble outgoing">
                    <div class="whatsapp-bubble-text">${formatCoachChatHtml(msg.text)}</div>
                    <div class="whatsapp-meta">
                      <span>${escapeHtmlAttr(msg.timeLabel || '')}</span>
                      <span class="whatsapp-ticks" aria-label="נקרא">✓✓</span>
                    </div>
                  </div>
                </div>
              ` : `
                <div class="whatsapp-bubble-row incoming-row">
                  <div class="whatsapp-bubble incoming" data-no-copy="true">
                    <div class="whatsapp-bubble-text">${formatCoachChatHtml(msg.text)}</div>
                    <div class="whatsapp-meta">
                      <span>${escapeHtmlAttr(msg.timeLabel || '')}</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}

            <div class="whatsapp-typing-indicator" id="whatsapp-typing-indicator" style="display:none;">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span>המורה הפרטי מקליד...</span>
            </div>
          </div>

          <div class="whatsapp-input-bar">
            <input
              type="text"
              id="whatsapp-tutor-input"
              class="whatsapp-tutor-input"
              autocomplete="off"
              placeholder="כתוב כאן במילים שלך מהראש (משפט קצר ופשוט)..."
            />
            <button type="button" id="btn-send-whatsapp-tutor" class="whatsapp-send-btn" aria-label="שלח הודעה למורה הפרטי">
              <span>שלח ➤</span>
            </button>
          </div>
        </section>

        <!-- שער התקדמות קשיח בתחתית שיחת המורה הפרטי -->
        <div class="tutor-phased-gate-bar ${allBeatTermsMastered ? 'unlocked' : 'locked'}" id="tutor-phased-gate-bar">
          <div class="tutor-phased-gate-caption" id="tutor-phased-gate-caption">
            ${allBeatTermsMastered
              ? '☀️ מדהים דניאל! כל המושגים בקבוצה הזו ברורים כמו שמש בבוקר — השער פתוח!'
              : '🔒 השער נעול עד שכל המושגים ברשימה למעלה יסומנו ב-"✅ מובן ב-100%!" בשיחה עם המורה הפרטי'}
          </div>
          <button
            type="button"
            id="btn-tutor-phased-gate"
            class="primary-btn tutor-phased-gate-btn"
            ${!allBeatTermsMastered ? 'disabled' : ''}
          >
            <span>${gateBtnLabel}</span>
          </button>
        </div>
      </div>
    `;

    bindJourneyBarEvents(blocksWrapper, unit, allConceptsMastered);

    const waFeed = blocksWrapper.querySelector('#whatsapp-tutor-feed');
    const waInput = blocksWrapper.querySelector('#whatsapp-tutor-input');
    const waSendBtn = blocksWrapper.querySelector('#btn-send-whatsapp-tutor');
    const waTyping = blocksWrapper.querySelector('#whatsapp-typing-indicator');
    const gateBar = blocksWrapper.querySelector('#tutor-phased-gate-bar');
    const gateCaption = blocksWrapper.querySelector('#tutor-phased-gate-caption');
    const gateBtn = blocksWrapper.querySelector('#btn-tutor-phased-gate');

    const scrollWaToBottom = () => {
      if (waFeed) {
        waFeed.scrollTop = waFeed.scrollHeight;
      }
    };
    scrollWaToBottom();

    // Anti-ChatGPT Shield 1: Block `copy` / `cut` on tutor messages
    if (waFeed) {
      const blockTutorCopy = (e) => {
        e.preventDefault();
        if (typeof showToast === 'function') {
          showToast('כאן לא מעתיקים את שאלות המורה — עונים במילים שלך מהראש! 😊💬', 'warning');
        }
      };
      waFeed.addEventListener('copy', blockTutorCopy);
      waFeed.addEventListener('cut', blockTutorCopy);
    }

    // Anti-ChatGPT Shield 2: Block `paste` / `drop` on tutor input box with exact friendly toast!
    if (waInput) {
      const blockInputPaste = (e) => {
        e.preventDefault();
        if (typeof showToast === 'function') {
          showToast('דניאל אלוף, כאן כותבים במילים שלך מהראש – משפט קצר ופשוט מספיק! 💬', 'warning');
        }
      };
      waInput.onpaste = blockInputPaste;
      waInput.ondrop = blockInputPaste;
    }

    let isWaitingForTutor = false;
    const handleSendWhatsAppReply = async () => {
      if (isWaitingForTutor || !waInput) return;
      const val = waInput.value.trim();
      if (!val) return;

      isWaitingForTutor = true;
      waInput.value = '';
      if (waSendBtn) waSendBtn.disabled = true;

      const nowTime = formatWhatsAppClockTime();
      tutorSlide.chatHistory.push({
        role: 'user',
        text: val,
        timeLabel: nowTime,
        timestamp: new Date().toISOString()
      });
      saveAppState();

      if (waFeed) {
        const userRow = document.createElement('div');
        userRow.className = 'whatsapp-bubble-row outgoing-row';
        userRow.innerHTML = `
          <div class="whatsapp-bubble outgoing">
            <div class="whatsapp-bubble-text">${formatCoachChatHtml(val)}</div>
            <div class="whatsapp-meta">
              <span>${escapeHtmlAttr(nowTime)}</span>
              <span class="whatsapp-ticks" aria-label="נקרא">✓✓</span>
            </div>
          </div>
        `;
        if (waTyping && waTyping.parentNode === waFeed) {
          waFeed.insertBefore(userRow, waTyping);
        } else {
          waFeed.appendChild(userRow);
        }
      }

      if (waTyping) {
        waTyping.style.display = 'inline-flex';
      }
      scrollWaToBottom();

      const evalRes = await evaluatePrivateTutorTurnWithGroq(unit, bIdx, val);

      if (waTyping) {
        waTyping.style.display = 'none';
      }

      const replyTime = formatWhatsAppClockTime();
      tutorSlide.chatHistory.push({
        role: 'tutor',
        text: evalRes.tutor_whatsapp_reply,
        timeLabel: replyTime,
        timestamp: new Date().toISOString()
      });
      saveAppState();

      if (waFeed) {
        const tutorRow = document.createElement('div');
        tutorRow.className = 'whatsapp-bubble-row incoming-row';
        tutorRow.innerHTML = `
          <div class="whatsapp-bubble incoming" data-no-copy="true">
            <div class="whatsapp-bubble-text">${formatCoachChatHtml(evalRes.tutor_whatsapp_reply)}</div>
            <div class="whatsapp-meta">
              <span>${escapeHtmlAttr(replyTime)}</span>
            </div>
          </div>
        `;
        if (waTyping && waTyping.parentNode === waFeed) {
          waFeed.insertBefore(tutorRow, waTyping);
        } else {
          waFeed.appendChild(tutorRow);
        }
      }
      scrollWaToBottom();

      // Update Sunlight Mastery Checklist pills live
      checklist.forEach(chk => {
        const pillEl = blocksWrapper.querySelector(`.sunlight-term-pill[data-term-id="${CSS && CSS.escape ? CSS.escape(chk.term_id) : chk.term_id}"]`)
          || Array.from(blocksWrapper.querySelectorAll('.sunlight-term-pill')).find(el => el.getAttribute('data-term-id') === chk.term_id);
        if (pillEl && chk.verified) {
          pillEl.classList.remove('pending');
          pillEl.classList.add('verified');
          const stEl = pillEl.querySelector('.sunlight-pill-status');
          if (stEl) stEl.textContent = '✅ מובן ב-100%!';
        }
      });

      if (evalRes.all_beat_terms_mastered) {
        if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
          SoundService.playSuccessSound();
        }
        if (gateBar) {
          gateBar.classList.remove('locked');
          gateBar.classList.add('unlocked');
        }
        if (gateCaption) {
          gateCaption.textContent = '☀️ מדהים דניאל! כל המושגים בקבוצה הזו ברורים כמו שמש בבוקר — השער פתוח!';
        }
        if (gateBtn) {
          gateBtn.disabled = false;
        }
      }

      isWaitingForTutor = false;
      if (waSendBtn) waSendBtn.disabled = false;
      if (waInput) waInput.focus();
    };

    if (waSendBtn && waInput) {
      waSendBtn.onclick = handleSendWhatsAppReply;
      waInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendWhatsAppReply();
        }
      };
    }

    if (gateBtn) {
      gateBtn.onclick = async () => {
        if (!tutorSlide.all_beat_terms_mastered) return;
        if (!isLastConceptBeat || questions.length > 0) {
          await UnitBeatCursor.advanceNext(unit);
        } else {
          await completeStudyHelpUnitAndGenerateExam(unit);
        }
      };
    }

    return;
  }

  // ==========================================================================
  // STAGE 2: GROUNDED HOMEWORK & TABLE SOLVER (ON-SCREEN + NOTEBOOK SUPPORT,
  //          SELECT OR FREE WRITE, 2-STEP MFA, & INLINE PAGE SNAPSHOT VIEWER)
  // ==========================================================================
  const currentQ = questions[qIdx] || {
    exact_book_text: 'שאלה לתרגול',
    original_question: 'שאלה לתרגול',
    friendly_translation: 'הנהלת חשבונות',
    page_number: 1
  };
  ensureQuestionStage2Schema(currentQ, qIdx, unit);

  const solvedCount = unit.solvedQuestions.filter(Boolean).length;
  const totalQ = Math.max(1, questions.length);
  const progressPct = Math.round((solvedCount / totalQ) * 100);
  const isCurrentSolved = Boolean(unit.solvedQuestions[qIdx]);
  const allSolved = questions.length > 0 && solvedCount === questions.length;
  const activeMessages = unit.chatHistory[qIdx] || [];
  const qPageNumber = Number(currentQ.page_number) || 1;

  // Find matching page snapshot (or fallback to first snapshot)
  const matchingSnapshot = hasPageSnapshots
    ? (unit.pageSnapshots.find(p => Number(p.pageNumber) === qPageNumber) || unit.pageSnapshots[0])
    : null;
  const isInlinePageOpen = Boolean(currentQ.showInlinePageSnapshot);

  // Table schema & rows state
  const hasTableMode = Boolean(
    (currentQ.table_schema && currentQ.table_schema.has_table) ||
    currentQ.question_type === 'journal_table' ||
    currentQ.question_type === 'general_table' ||
    currentQ.forceShowTable
  );
  const tableColumns = (currentQ.table_schema && Array.isArray(currentQ.table_schema.columns) && currentQ.table_schema.columns.length >= 3)
    ? currentQ.table_schema.columns
    : ['חובה (סכום)', 'זכות (סכום)', 'פרטים / שם החשבון'];
  const accountChoices = currentQ.table_schema && Array.isArray(currentQ.table_schema.account_choices)
    ? currentQ.table_schema.account_choices
    : [];
  const userTableRows = Array.isArray(currentQ.userTableRows) ? currentQ.userTableRows : [];
  const expectedRows = (currentQ.table_schema && Array.isArray(currentQ.table_schema.expected_rows))
    ? currentQ.table_schema.expected_rows
    : [];

  const step1Done = Boolean(currentQ.step1Solved || isCurrentSolved);
  const mfaConfirmed = Boolean(currentQ.mfaConfirmed || isCurrentSolved);
  const hasMfaVerification = Boolean(
    currentQ.mfa_verification &&
    currentQ.mfa_verification.question &&
    Array.isArray(currentQ.mfa_verification.options) &&
    currentQ.mfa_verification.options.length >= 2
  );

  blocksWrapper.innerHTML = `
    <div class="study-unit-player-container" dir="rtl">
      ${journeyBarHtml}

      <!-- סרגל התקדמות שאלות וכפתורי בחירת שאלה (שאלה אחת בכל פעם) -->
      <section class="card study-question-progress-card" aria-label="התקדמות בשאלות התרגול">
        <div class="study-q-progress-top">
          <div class="study-q-progress-headline">
            <span class="study-q-counter-badge">שאלה ${qIdx + 1} מתוך ${questions.length} בשיעור</span>
            <span class="study-q-solved-counter">${solvedCount} מתוך ${questions.length} שאלות הושלמו ✅</span>
          </div>
          <div class="study-q-progress-bar-track">
            <div class="study-q-progress-bar-fill" style="width:${progressPct}%;"></div>
          </div>
        </div>

        <!-- כפתורי ניווט בין שאלות -->
        <div class="study-q-nav-pills" role="tablist" aria-label="בחירת שאלה בשיעור">
          ${questions.map((qItem, idx) => {
            const solved = Boolean(unit.solvedQuestions[idx]);
            const isActive = idx === qIdx;
            return `
              <button
                type="button"
                class="study-q-nav-pill ${isActive ? 'active' : ''} ${solved ? 'solved' : ''}"
                data-q-idx="${idx}"
                role="tab"
                aria-selected="${isActive ? 'true' : 'false'}"
              >
                <span>${qItem.question_number_label || `שאלה ${idx + 1}`}</span>
                <span>${solved ? '✅' : (isActive ? '🔵' : '⚪')}</span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- 1. כותרת מיקום מעוגנת בספר + כפתור הצגה/הסתרה של צילום העמוד -->
        <div class="study-grounded-location-banner">
          <div class="study-grounded-location-text">
            <span class="study-location-pin-badge">📍 דניאל, תסתכל בעמוד ${qPageNumber} בקובץ השיעור • ${currentQ.question_number_label || ('שאלה ' + (qIdx + 1))}</span>
            ${isCurrentSolved ? `<span class="badge-completed-card">הושלם ב-100% ✅</span>` : ''}
          </div>
          <div class="study-grounded-location-actions">
            ${hasPageSnapshots ? `
              <button
                type="button"
                id="btn-toggle-inline-page-snapshot"
                class="secondary-btn study-view-page-btn ${isInlinePageOpen ? 'active-toggle' : ''}"
              >
                <span>👁️ הצג / הסתר את צילום עמוד ${qPageNumber} מהספר</span>
              </button>
              <button
                type="button"
                id="btn-zoom-page-modal"
                class="secondary-btn study-view-page-btn"
                title="פתח בהגדלה מלאה"
              >
                <span>🔍 הגדל עמוד</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- חלונית צילום העמוד מתוך הספר (Inline Page Snapshot Viewer) -->
        ${hasPageSnapshots && matchingSnapshot ? `
          <div
            id="study-inline-page-snapshot-drawer"
            class="study-inline-page-snapshot-drawer"
            style="display:${isInlinePageOpen ? 'block' : 'none'};"
          >
            <div class="study-inline-snapshot-toolbar">
              <span>📄 צילום עמוד ${matchingSnapshot.pageNumber} מתוך קובץ השיעור (לחץ על התמונה להגדלה מלאה)</span>
              ${unit.pageSnapshots.length > 1 ? `
                <div class="study-inline-snapshot-page-pills">
                  ${unit.pageSnapshots.map(snap => `
                    <button
                      type="button"
                      class="study-inline-page-pill ${Number(snap.pageNumber) === Number(matchingSnapshot.pageNumber) ? 'active' : ''}"
                      data-inline-page="${snap.pageNumber}"
                    >
                      עמוד ${snap.pageNumber}
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>
            <div class="study-inline-snapshot-img-wrap" id="study-inline-snapshot-zoom-trigger">
              <img
                id="study-inline-snapshot-img"
                src="${matchingSnapshot.dataUrl}"
                alt="צילום עמוד ${matchingSnapshot.pageNumber} מתוך קובץ השיעור"
                class="study-inline-snapshot-img"
              />
            </div>
          </div>
        ` : ''}

        <!-- 2. תצוגה כפולה של השאלה: קופסה 1 (מה כתוב בספר) + קופסה 2 (תרגום פשוט וצעדים לדניאל) -->
        <div class="study-dual-question-grid">
          <!-- Box 1: מה כתוב בספר -->
          <div class="study-book-quote-box">
            <div class="study-dual-box-header book-header">
              <span>📖 מה כתוב בספר (בעמוד ${qPageNumber}):</span>
            </div>
            <div class="study-book-exact-text">
              ${formatCoachChatHtml(currentQ.exact_book_text || currentQ.original_question || currentQ.questionText || '')}
            </div>
          </div>

          <!-- Box 2: תרגום פשוט לדניאל – מה עושים כאן צעד אחר צעד? -->
          <div class="study-daniel-translation-box">
            <div class="study-dual-box-header translation-header">
              <span>🎯 תרגום פשוט לדניאל – מה עושים כאן צעד אחר צעד?</span>
            </div>
            <p class="study-daniel-friendly-text">
              ${formatCoachChatHtml(currentQ.friendly_translation || '')}
            </p>
            ${Array.isArray(currentQ.step_by_step_guide) && currentQ.step_by_step_guide.length > 0 ? `
              <ol class="study-guiding-stones-list">
                ${currentQ.step_by_step_guide.map((stepStr, sIdx) => `
                  <li class="study-guiding-stone-item">
                    <span class="stone-num">${sIdx + 1}</span>
                    <span class="stone-text">${formatCoachChatHtml(stepStr)}</span>
                  </li>
                `).join('')}
              </ol>
            ` : ''}
          </div>
        </div>
      </section>

      <!-- 3. סביבת פתרון רב-ערוצית גמישה (על המסך + תמיכה במחברת) -->
      <section class="card study-multi-solver-workspace" aria-label="סביבת פתרון השאלה">
        <div class="study-workspace-header">
          <div>
            <h3 class="study-workspace-title">🛠️ איך נוח לך לפתור את ${currentQ.question_number_label || `שאלה ${qIdx + 1}`}?</h3>
            <p class="study-workspace-subtitle">אפשר למלא את הטבלה על המסך, לבחור מתוך האפשרויות המוכנות, או לכתוב חופשי למאמן בצ'אט — הכל נשמר ומתורגם בסוף לסיכום מסודר להעתקה למחברת!</p>
          </div>
          ${!hasTableMode ? `
            <button type="button" id="btn-enable-table-mode" class="secondary-btn study-view-page-btn">
              <span>📊 פתח טבלת חובה/זכות על המסך</span>
            </button>
          ` : ''}
        </div>

        <!-- Mode A: Interactive On-Screen Table (journal_table / general_table) -->
        ${hasTableMode ? `
          <div class="study-interactive-table-card" id="study-interactive-table-section">
            <div class="study-solver-mode-badge mode-a-badge">
              <span>📊 אפשרות א׳: מילוי טבלה אינטראקטיבית על המסך (בחירה מרשימה או הקלדה חופשית)</span>
            </div>
            <p class="study-solver-helper-note">
              בחר את שם החשבון מהרשימה הנפתחת (או הקלד חופשי בתיבה) והזן את הסכומים בעמודת חובה או זכות:
            </p>

            <div class="study-table-responsive-wrap">
              <table class="study-interactive-journal-table" aria-label="טבלת פתרון אינטראקטיבית">
                <thead>
                  <tr>
                    <th style="width:48px;">#</th>
                    <th>${tableColumns[0] || 'חובה (סכום)'}</th>
                    <th>${tableColumns[1] || 'זכות (סכום)'}</th>
                    <th>${tableColumns[2] || 'פרטים / שם החשבון'}</th>
                  </tr>
                </thead>
                <tbody id="study-interactive-table-tbody">
                  ${userTableRows.map((row, rIdx) => `
                    <tr data-row-idx="${rIdx}">
                      <td class="row-index-cell">${rIdx + 1}</td>
                      <td>
                        <input
                          type="text"
                          inputmode="decimal"
                          class="styled-input study-table-amount-input debit-input"
                          data-row="${rIdx}"
                          data-field="debit"
                          placeholder="סכום חובה..."
                          value="${escapeHtmlAttr(row.debit || '')}"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          inputmode="decimal"
                          class="styled-input study-table-amount-input credit-input"
                          data-row="${rIdx}"
                          data-field="credit"
                          placeholder="סכום זכות..."
                          value="${escapeHtmlAttr(row.credit || '')}"
                        />
                      </td>
                      <td>
                        <div class="study-table-details-combo">
                          <select
                            class="styled-input study-table-account-select"
                            data-row="${rIdx}"
                            aria-label="בחירת חשבון מרשימה לשורה ${rIdx + 1}"
                          >
                            <option value="">-- בחר חשבון מהרשימה או הקלד משמאל --</option>
                            ${accountChoices.map(acc => `
                              <option value="${escapeHtmlAttr(acc)}" ${row.details === acc ? 'selected' : ''}>${acc}</option>
                            `).join('')}
                          </select>
                          <input
                            type="text"
                            class="styled-input study-table-details-input"
                            data-row="${rIdx}"
                            data-field="details"
                            placeholder="או הקלד שם חשבון / פרטים..."
                            value="${escapeHtmlAttr(row.details || '')}"
                          />
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr class="study-table-totals-row">
                    <td>סה"כ</td>
                    <td id="study-table-total-debit">0</td>
                    <td id="study-table-total-credit">0</td>
                    <td id="study-table-balance-status">⚖️ הזן סכומים לבדיקת איזון</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="study-table-actions-bar">
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button type="button" id="btn-add-table-row" class="secondary-btn">
                  <span>➕ הוסף שורה לטבלה</span>
                </button>
                <button type="button" id="btn-clear-table-rows" class="secondary-btn">
                  <span>🔄 נקה טבלה</span>
                </button>
              </div>
              <button type="button" id="btn-check-interactive-table" class="primary-btn study-check-table-btn">
                <span>✅ בדוק את הטבלה שמילאתי</span>
              </button>
            </div>

            <div id="study-table-feedback-box" class="study-mfa-feedback" style="display:none;"></div>
          </div>
        ` : ''}

        <!-- Mode B: Guided Option Selection (בחירה מתוך אפשרויות ברורות) -->
        ${Array.isArray(currentQ.guided_options) && currentQ.guided_options.length >= 2 ? `
          <div class="study-guided-options-card" id="study-guided-options-section">
            <div class="study-solver-mode-badge mode-b-badge">
              <span>🎯 ${hasTableMode ? 'אפשרות ב׳: קשה לנסח לבד? בחר את הפתרון הנכון מתוך האפשרויות' : 'אפשרות א׳: בחירה נוחה מתוך אפשרויות ברורות'}</span>
            </div>
            <div class="study-guided-options-grid">
              ${currentQ.guided_options.map((optText, oIdx) => {
                const isCorrectOpt = oIdx === Number(currentQ.correct_option_index || 0);
                return `
                  <button
                    type="button"
                    class="study-guided-option-card-btn ${step1Done && isCorrectOpt ? 'correct-selected' : ''}"
                    data-guided-opt-idx="${oIdx}"
                  >
                    <span class="guided-opt-letter">${idxToHebrewLetter(oIdx)}</span>
                    <span class="guided-opt-text">${formatCoachChatHtml(optText)}</span>
                  </button>
                `;
              }).join('')}
            </div>
            <div id="study-guided-options-feedback" class="study-mfa-feedback" style="display:${step1Done ? 'block' : 'none'};">
              ${step1Done ? '✅ בחירה מדויקת דניאל! זיהית את הפתרון הנכון.' : ''}
            </div>
          </div>
        ` : ''}

        <!-- 4. Step 2: Gentle Two-Step Verification ("MFA for Understanding") -->
        ${hasMfaVerification ? `
          <div
            id="study-q-mfa-verification-card"
            class="study-q-mfa-verification-card ${mfaConfirmed ? 'mfa-confirmed' : ''}"
            style="display:${step1Done ? 'block' : 'none'};"
          >
            <div class="study-q-mfa-header">
              <span class="study-q-mfa-icon">🌟</span>
              <div>
                <h4 class="study-q-mfa-title">
                  מצוין דניאל! הצעד הראשון נכון! רק וידוא קטן של 10 שניות כדי שנהיה בטוחים ב-100%:
                </h4>
                <p class="study-q-mfa-question">${formatCoachChatHtml(currentQ.mfa_verification.question)}</p>
              </div>
            </div>
            <div class="study-mfa-options-list">
              ${currentQ.mfa_verification.options.map((mfaOpt, mIdx) => {
                const isCorrectMfa = mIdx === Number(currentQ.mfa_verification.correct_index || 0);
                return `
                  <button
                    type="button"
                    class="study-mfa-option-btn q-mfa-opt-btn ${mfaConfirmed && isCorrectMfa ? 'correct-selected' : ''}"
                    data-q-mfa-idx="${mIdx}"
                  >
                    <span class="opt-letter">${idxToHebrewLetter(mIdx)}.</span>
                    <span>${formatCoachChatHtml(mfaOpt)}</span>
                  </button>
                `;
              }).join('')}
            </div>
            <div id="study-q-mfa-feedback" class="study-mfa-feedback ${mfaConfirmed ? 'success' : ''}" style="display:${mfaConfirmed ? 'block' : 'none'};">
              ${mfaConfirmed ? '🎯 אלוף! הוכחת הבנה מלאה של השאלה ב-100%. הפתרון המלא מוכן עבורך למטה להעתקה למחברת!' : ''}
            </div>
          </div>
        ` : ''}

        <!-- 5. "✍️ מוכן להעתקה למחברת / לדף העבודה שלך" Card (נפתח מיד עם אישור ה-MFA) -->
        <div
          id="study-notebook-copy-card"
          class="study-notebook-copy-card"
          style="display:${isCurrentSolved ? 'block' : 'none'};"
        >
          <div class="study-notebook-copy-header">
            <div>
              <span class="study-notebook-badge">✍️ מוכן להעתקה למחברת / לדף העבודה שלך</span>
              <h4 class="study-notebook-title">
                הפתרון המלא והמסודר עבור עמוד ${qPageNumber} • ${currentQ.question_number_label || `שאלה ${qIdx + 1}`}
              </h4>
            </div>
            <button type="button" id="btn-copy-notebook-text" class="secondary-btn study-copy-btn">
              <span>📋 העתק טקסט</span>
            </button>
          </div>

          <div class="study-notebook-solution-body" id="study-notebook-solution-text">
            <p class="study-notebook-summary-paragraph">
              ${formatCoachChatHtml(currentQ.notebook_copy_summary || currentQ.expected_answer_summary || '')}
            </p>
            ${expectedRows.length > 0 ? `
              <div class="study-notebook-clean-table-wrap">
                <table class="study-notebook-clean-table">
                  <thead>
                    <tr>
                      <th>${tableColumns[0] || 'חובה (סכום)'}</th>
                      <th>${tableColumns[1] || 'זכות (סכום)'}</th>
                      <th>${tableColumns[2] || 'פרטים / שם החשבון'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${expectedRows.map(r => `
                      <tr>
                        <td class="num-cell">${r.debit || '—'}</td>
                        <td class="num-cell">${r.credit || '—'}</td>
                        <td class="details-cell"><strong>${r.details || ''}</strong></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
          </div>

          <div class="study-notebook-footer-bar">
            <label class="study-notebook-checkbox-label">
              <input
                type="checkbox"
                id="chk-copied-to-notebook"
                ${currentQ.copiedToNotebook ? 'checked' : ''}
              />
              <span>☑️ העתקתי למחברת שלי בעמוד ${qPageNumber} שאלה ${qIdx + 1}</span>
            </label>

            <div class="study-notebook-next-actions">
              ${allSolved ? `
                <button type="button" id="btn-finish-daily-unit-exam" class="primary-btn study-finish-all-btn">
                  <span>🎉 סיימתי את כל יחידת הלימוד של היום! צור לי מבחן מסכם</span>
                </button>
              ` : `
                <button type="button" id="btn-next-study-question" class="primary-btn study-next-question-btn">
                  <span>המשך לשאלה הבאה בשיעור ▶</span>
                </button>
              `}
            </div>
          </div>
        </div>
      </section>

      <!-- Mode C: כתיבה חופשית ועזרה בצ'אט עם המאמן האישי (Socratic AI Coach Chat) -->
      <section class="card study-socratic-coach-card" aria-label="כתיבה חופשית ועזרה בצ'אט">
        <div class="study-coach-header">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span class="study-coach-avatar" aria-hidden="true">🤖</span>
            <div>
              <h3 class="study-coach-title">💬 כתיבה חופשית ועזרה בצ'אט — ${currentQ.question_number_label || `שאלה ${qIdx + 1}`}</h3>
              <p class="study-coach-subtitle">מעדיף לכתוב את התשובה במילים שלך או להתייעץ עם המאמן? כתוב כאן למטה או לחץ על אחד מכפתורי העזרה המהירים:</p>
            </div>
          </div>
        </div>

        <!-- אזור הודעות הצ'אט -->
        <div id="study-help-chat-messages" class="study-coach-messages-box" aria-live="polite">
          ${activeMessages.map(msg => `
            <div class="study-chat-bubble-row ${msg.role === 'user' ? 'user-row' : 'coach-row'}">
              <div class="study-chat-avatar-badge">${msg.role === 'user' ? '🧑' : '🤖'}</div>
              <div class="study-chat-bubble ${msg.role === 'user' ? 'user-bubble' : 'coach-bubble'}">
                <div class="study-chat-sender-name">${msg.role === 'user' ? 'דניאל' : 'המאמן האישי'}</div>
                <div class="study-chat-text">${formatCoachChatHtml(msg.text)}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- אינדיקטור הקלדה רגוע -->
        <div id="study-help-typing-indicator" class="study-coach-typing-indicator" style="display:none;">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span>המאמן בודק ומנסח תשובה...</span>
        </div>

        <!-- 3 כפתורי עזרה מהירה (Quick-Assist Chips) מעל תיבת ההקלדה -->
        <div class="study-quick-assist-bar" aria-label="כפתורי עזרה מהירה מהמאמן">
          <button type="button" class="study-quick-assist-chip" data-assist="hint">
            <span>💡 תן לי רמז כיוון</span>
          </button>
          <button type="button" class="study-quick-assist-chip" data-assist="steps">
            <span>🔍 פרק לי לשלבים קטנים</span>
          </button>
          <button type="button" class="study-quick-assist-chip" data-assist="explain">
            <span>📖 הסבר לי שוב בפשטות</span>
          </button>
        </div>

        <!-- תיבת הקלדת תשובה או שאלה למאמן -->
        <div class="study-chat-input-row">
          <textarea
            id="study-help-chat-input"
            class="study-chat-input"
            rows="2"
            placeholder="כתוב כאן חופשי את התשובה שלך לשאלה ${qIdx + 1}, או שאל את המאמן כל דבר..."
          ></textarea>
          <button type="button" id="btn-send-study-chat" class="primary-btn study-chat-send-btn">
            <span>שלח תשובה 🚀</span>
          </button>
        </div>
      </section>

    </div>
  `;

  bindJourneyBarEvents(blocksWrapper, unit, allConceptsMastered);

  // Bind Inline Page Snapshot Toggle & Zoom Modal
  const toggleInlineSnapBtn = blocksWrapper.querySelector('#btn-toggle-inline-page-snapshot');
  const inlineSnapDrawer = blocksWrapper.querySelector('#study-inline-page-snapshot-drawer');
  if (toggleInlineSnapBtn && inlineSnapDrawer) {
    toggleInlineSnapBtn.onclick = () => {
      currentQ.showInlinePageSnapshot = !currentQ.showInlinePageSnapshot;
      saveAppState();
      inlineSnapDrawer.style.display = currentQ.showInlinePageSnapshot ? 'block' : 'none';
      toggleInlineSnapBtn.classList.toggle('active-toggle', currentQ.showInlinePageSnapshot);
    };
  }
  const zoomModalBtn = blocksWrapper.querySelector('#btn-zoom-page-modal');
  if (zoomModalBtn) {
    zoomModalBtn.onclick = () => openLessonPageViewerModal(unit, qPageNumber);
  }
  const inlineZoomTrigger = blocksWrapper.querySelector('#study-inline-snapshot-zoom-trigger');
  if (inlineZoomTrigger) {
    inlineZoomTrigger.onclick = () => openLessonPageViewerModal(unit, qPageNumber);
  }
  blocksWrapper.querySelectorAll('.study-inline-page-pill').forEach(pill => {
    pill.onclick = () => {
      const targetPage = Number(pill.getAttribute('data-inline-page'));
      const snap = unit.pageSnapshots.find(p => Number(p.pageNumber) === targetPage);
      const imgEl = blocksWrapper.querySelector('#study-inline-snapshot-img');
      if (snap && imgEl) {
        imgEl.src = snap.dataUrl;
        blocksWrapper.querySelectorAll('.study-inline-page-pill').forEach(b => b.classList.remove('active'));
        pill.classList.add('active');
      }
    };
  });

  // Allow enabling Interactive Table mode on any question
  const enableTableBtn = blocksWrapper.querySelector('#btn-enable-table-mode');
  if (enableTableBtn) {
    enableTableBtn.onclick = () => {
      currentQ.forceShowTable = true;
      ensureQuestionStage2Schema(currentQ, qIdx, unit);
      saveAppState();
      openStudyHelpUnit(unit.id);
    };
  }

  // Scroll chat box to bottom
  const messagesBox = blocksWrapper.querySelector('#study-help-chat-messages');
  const scrollToChatBottom = () => {
    if (messagesBox) {
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
  };
  scrollToChatBottom();

  // Bind question navigation pills via `UnitBeatCursor`
  const navPills = blocksWrapper.querySelectorAll('.study-q-nav-pill[data-q-idx]');
  navPills.forEach(pill => {
    pill.onclick = async () => {
      const targetIdx = Number(pill.getAttribute('data-q-idx'));
      if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < questions.length) {
        await UnitBeatCursor.goToHomeworkQuestion(unit, targetIdx);
      }
    };
  });

  // Helper to mark Step 1 solved and either show Step 2 MFA or finalize the question
  const triggerStep1SuccessAndMfaGate = () => {
    currentQ.step1Solved = true;
    if (!hasMfaVerification) {
      finalizeQuestionMasteryAndShowNotebookCard();
      return;
    }
    saveAppState();
    if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
      SoundService.playSuccessSound();
    }
    const mfaCard = blocksWrapper.querySelector('#study-q-mfa-verification-card');
    if (mfaCard) {
      mfaCard.style.display = 'block';
      if (typeof mfaCard.scrollIntoView === 'function') {
        mfaCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Helper to finalize Step 2 MFA, mark question solved, play sound, and show Ready-to-Copy Notebook card
  const finalizeQuestionMasteryAndShowNotebookCard = () => {
    currentQ.step1Solved = true;
    currentQ.mfaConfirmed = true;
    currentQ.isCompleted = true;
    unit.solvedQuestions[qIdx] = true;

    if (!currentQ.starAwarded) {
      currentQ.starAwarded = true;
      awardStudyHelpStars(2, `פתרון ${currentQ.question_number_label || `שאלה ${qIdx + 1}`} ווידוא הבנה`);
    }

    const updatedSolvedCount = unit.solvedQuestions.filter(Boolean).length;
    const nowAllSolved = questions.length > 0 && updatedSolvedCount === questions.length;
    if (nowAllSolved) {
      unit.completed = true;
      unit.isCompleted = true;
      if (!unit.bonusStarsAwarded) {
        unit.bonusStarsAwarded = true;
        const stats = ensureStudyHelpStats();
        stats.lessonsCompleted = Math.max(
          (Number(stats.lessonsCompleted) || 0) + 1,
          (appState.studyHelpUnits || []).filter(u => Boolean(u && (u.completed || u.isCompleted))).length
        );
        awardStudyHelpStars(5, 'סיום יחידת שיעור מלאה 🏆');
      }
    }
    saveAppState();

    if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
      SoundService.playSuccessSound();
    }
    openStudyHelpUnit(unit.id);
    setTimeout(() => {
      const notebookCard = document.getElementById('study-notebook-copy-card');
      if (notebookCard && typeof notebookCard.scrollIntoView === 'function') {
        notebookCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  // Bind Mode A: Interactive Table Inputs, Totals Calculator, Add/Clear Row, & Check Button
  if (hasTableMode) {
    const updateTableLiveTotals = () => {
      let sumDebit = 0;
      let sumCredit = 0;
      userTableRows.forEach(r => {
        const d = parseFloat(String(r.debit || '').replace(/[^\d.-]/g, ''));
        const c = parseFloat(String(r.credit || '').replace(/[^\d.-]/g, ''));
        if (!isNaN(d)) sumDebit += d;
        if (!isNaN(c)) sumCredit += c;
      });
      const totalDebitEl = blocksWrapper.querySelector('#study-table-total-debit');
      const totalCreditEl = blocksWrapper.querySelector('#study-table-total-credit');
      const balanceStatusEl = blocksWrapper.querySelector('#study-table-balance-status');
      if (totalDebitEl) totalDebitEl.textContent = sumDebit.toLocaleString('he-IL');
      if (totalCreditEl) totalCreditEl.textContent = sumCredit.toLocaleString('he-IL');
      if (balanceStatusEl) {
        if (sumDebit === 0 && sumCredit === 0) {
          balanceStatusEl.innerHTML = '⚖️ הזן סכומים לבדיקת איזון';
          balanceStatusEl.className = '';
        } else if (Math.abs(sumDebit - sumCredit) < 0.01) {
          balanceStatusEl.innerHTML = '✅ הטבלה מאוזנת! (חובה = זכות)';
          balanceStatusEl.className = 'table-balanced-ok';
        } else {
          const diff = Math.abs(sumDebit - sumCredit).toLocaleString('he-IL');
          balanceStatusEl.innerHTML = `⏳ הפרש לאיזון: ${diff} ש"ח`;
          balanceStatusEl.className = 'table-balanced-diff';
        }
      }
    };

    blocksWrapper.querySelectorAll('.study-table-amount-input, .study-table-details-input').forEach(inp => {
      inp.oninput = () => {
        const rIdx = Number(inp.getAttribute('data-row'));
        const field = inp.getAttribute('data-field');
        if (userTableRows[rIdx] && field) {
          userTableRows[rIdx][field] = inp.value;
          saveAppState();
          updateTableLiveTotals();
        }
      };
    });

    blocksWrapper.querySelectorAll('.study-table-account-select').forEach(sel => {
      sel.onchange = () => {
        const rIdx = Number(sel.getAttribute('data-row'));
        if (userTableRows[rIdx] && sel.value) {
          userTableRows[rIdx].details = sel.value;
          const textInp = blocksWrapper.querySelector(`.study-table-details-input[data-row="${rIdx}"]`);
          if (textInp) textInp.value = sel.value;
          saveAppState();
        }
      };
    });

    updateTableLiveTotals();

    const addRowBtn = blocksWrapper.querySelector('#btn-add-table-row');
    if (addRowBtn) {
      addRowBtn.onclick = () => {
        currentQ.userTableRows.push({ debit: '', credit: '', details: '' });
        saveAppState();
        openStudyHelpUnit(unit.id);
      };
    }

    const clearRowsBtn = blocksWrapper.querySelector('#btn-clear-table-rows');
    if (clearRowsBtn) {
      clearRowsBtn.onclick = () => {
        currentQ.userTableRows = currentQ.userTableRows.map(() => ({ debit: '', credit: '', details: '' }));
        saveAppState();
        openStudyHelpUnit(unit.id);
      };
    }

    const checkTableBtn = blocksWrapper.querySelector('#btn-check-interactive-table');
    const tableFeedbackBox = blocksWrapper.querySelector('#study-table-feedback-box');
    if (checkTableBtn) {
      checkTableBtn.onclick = async () => {
        const filledRows = userTableRows.filter(
          r => String(r.debit || '').trim() || String(r.credit || '').trim() || String(r.details || '').trim()
        );
        if (filledRows.length === 0) {
          if (tableFeedbackBox) {
            tableFeedbackBox.style.display = 'block';
            tableFeedbackBox.className = 'study-mfa-feedback warning';
            tableFeedbackBox.innerHTML = '💡 מלא לפחות שורה אחת בטבלה (סכום חובה/זכות ושם החשבון) או בחר מתוך האפשרויות למטה.';
          }
          return;
        }

        // Check local match against expectedRows first
        let localMatch = false;
        let sumD = 0;
        let sumC = 0;
        filledRows.forEach(r => {
          const d = parseFloat(String(r.debit || '').replace(/[^\d.-]/g, ''));
          const c = parseFloat(String(r.credit || '').replace(/[^\d.-]/g, ''));
          if (!isNaN(d)) sumD += d;
          if (!isNaN(c)) sumC += c;
        });

        if (expectedRows.length > 0) {
          let expD = 0;
          let expC = 0;
          expectedRows.forEach(er => {
            const d = parseFloat(String(er.debit || '').replace(/[^\d.-]/g, ''));
            const c = parseFloat(String(er.credit || '').replace(/[^\d.-]/g, ''));
            if (!isNaN(d)) expD += d;
            if (!isNaN(c)) expC += c;
          });
          if (expD > 0 && Math.abs(sumD - expD) < 0.5 && Math.abs(sumC - expC) < 0.5) {
            localMatch = true;
          }
        } else if (sumD > 0 && Math.abs(sumD - sumC) < 0.01 && filledRows.every(r => String(r.details || '').trim().length >= 2)) {
          localMatch = true;
        }

        if (localMatch) {
          if (tableFeedbackBox) {
            tableFeedbackBox.style.display = 'block';
            tableFeedbackBox.className = 'study-mfa-feedback success';
            tableFeedbackBox.innerHTML = '✅ כל הכבוד דניאל! הטבלה שמילאת מאוזנת ומדויקת! בוא נשלים את וידוא ההבנה הקצר למטה:';
          }
          triggerStep1SuccessAndMfaGate();
          return;
        }

        // Otherwise ask the AI Coach to evaluate the table Daniel filled
        checkTableBtn.disabled = true;
        checkTableBtn.innerHTML = '<span>⏳ המאמן בודק את הטבלה...</span>';
        const serializedTable = filledRows
          .map((r, i) => `שורה ${i + 1}: חובה=${r.debit || 0}, זכות=${r.credit || 0}, פרטים=${r.details || 'ללא'}`)
          .join(' | ');
        const aiRes = await evaluateStudyHelpTurnWithAI({
          unit,
          qIdx,
          userText: `מילאתי בטבלה: ${serializedTable}`,
          assistMode: null
        });
        checkTableBtn.disabled = false;
        checkTableBtn.innerHTML = '<span>✅ בדוק את הטבלה שמילאתי</span>';

        if (tableFeedbackBox) {
          tableFeedbackBox.style.display = 'block';
          tableFeedbackBox.className = `study-mfa-feedback ${aiRes.is_question_solved ? 'success' : 'warning'}`;
          tableFeedbackBox.innerHTML = formatCoachChatHtml(aiRes.coach_reply);
        }
        if (aiRes.is_question_solved) {
          triggerStep1SuccessAndMfaGate();
        }
      };
    }
  }

  // Bind Mode B: Guided Option Cards
  const guidedFeedbackEl = blocksWrapper.querySelector('#study-guided-options-feedback');
  blocksWrapper.querySelectorAll('.study-guided-option-card-btn').forEach(btn => {
    btn.onclick = () => {
      const chosenIdx = Number(btn.getAttribute('data-guided-opt-idx'));
      const correctIdx = Number(currentQ.correct_option_index || 0);
      if (chosenIdx === correctIdx) {
        blocksWrapper.querySelectorAll('.study-guided-option-card-btn').forEach(b => b.classList.remove('correct-selected', 'wrong-selected'));
        btn.classList.add('correct-selected');
        if (guidedFeedbackEl) {
          guidedFeedbackEl.style.display = 'block';
          guidedFeedbackEl.className = 'study-mfa-feedback success';
          guidedFeedbackEl.innerHTML = '✅ בחירה מצוינת דניאל! זיהית את הפתרון הנכון. עכשיו רק וידוא קצר של 10 שניות למטה:';
        }
        triggerStep1SuccessAndMfaGate();
      } else {
        btn.classList.add('wrong-selected');
        if (guidedFeedbackEl) {
          guidedFeedbackEl.style.display = 'block';
          guidedFeedbackEl.className = 'study-mfa-feedback warning';
          guidedFeedbackEl.innerHTML = '💡 קרא שוב את "תרגום פשוט לדניאל – מה עושים כאן צעד אחר צעד?" למעלה ונסה לבחור את האפשרות שמתאימה לכל הנתונים מהספר.';
        }
      }
    };
  });

  // Bind Step 2: Gentle MFA Verification Options
  const qMfaFeedbackEl = blocksWrapper.querySelector('#study-q-mfa-feedback');
  blocksWrapper.querySelectorAll('.q-mfa-opt-btn').forEach(btn => {
    btn.onclick = () => {
      const chosenIdx = Number(btn.getAttribute('data-q-mfa-idx'));
      const correctIdx = Number(currentQ.mfa_verification?.correct_index || 0);
      if (chosenIdx === correctIdx) {
        btn.classList.add('correct-selected');
        finalizeQuestionMasteryAndShowNotebookCard();
      } else {
        btn.classList.add('wrong-selected');
        if (qMfaFeedbackEl) {
          qMfaFeedbackEl.style.display = 'block';
          qMfaFeedbackEl.className = 'study-mfa-feedback warning';
          qMfaFeedbackEl.innerHTML = '💡 כמעט! חשוב למה רשמנו את צד החובה וצד הזכות כך ובחר את ההסבר המתאים.';
        }
      }
    };
  });

  // Bind Ready-to-Copy to Notebook Card Controls
  const copyTextBtn = blocksWrapper.querySelector('#btn-copy-notebook-text');
  if (copyTextBtn) {
    copyTextBtn.onclick = () => {
      const rowsText = expectedRows.length > 0
        ? '\n' + expectedRows.map(r => `חובה: ${r.debit || '-'} | זכות: ${r.credit || '-'} | פרטים: ${r.details || ''}`).join('\n')
        : '';
      const textToCopy = `${currentQ.question_number_label || ('שאלה ' + (qIdx + 1))} (עמוד ${qPageNumber}):\n${currentQ.notebook_copy_summary || currentQ.expected_answer_summary || ''}${rowsText}`;
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(textToCopy);
      }
      if (typeof showToast === 'function') {
        showToast('הפתרון הועתק! מוכן להדבקה או לכתיבה במחברת 📋', 'success');
      }
    };
  }

  const copiedChk = blocksWrapper.querySelector('#chk-copied-to-notebook');
  if (copiedChk) {
    copiedChk.onchange = () => {
      currentQ.copiedToNotebook = Boolean(copiedChk.checked);
      saveAppState();
      if (copiedChk.checked && typeof showToast === 'function') {
        showToast('כל הכבוד על הסדר במחברת דניאל! ✍️🌟', 'success');
      }
    };
  }

  // Bind Next Question / Finish Unit buttons via `UnitBeatCursor`
  const bindSolvedBannerButtons = () => {
    const nextBtn = blocksWrapper.querySelector('#btn-next-study-question');
    if (nextBtn) {
      nextBtn.onclick = async () => {
        let nextIdx = qIdx + 1;
        if (nextIdx >= questions.length) {
          const firstUnsolved = unit.solvedQuestions.findIndex(s => !s);
          nextIdx = firstUnsolved >= 0 ? firstUnsolved : 0;
        }
        await UnitBeatCursor.goToHomeworkQuestion(unit, nextIdx);
      };
    }

    const finishBtn = blocksWrapper.querySelector('#btn-finish-daily-unit-exam');
    if (finishBtn) {
      finishBtn.onclick = async () => {
        await completeStudyHelpUnitAndGenerateExam(unit);
      };
    }
  };

  bindSolvedBannerButtons();

  // Handler for Mode C: Free Writing & Socratic AI Coach Chat
  let isWaitingForCoach = false;
  const chatInput = blocksWrapper.querySelector('#study-help-chat-input');
  const sendBtn = blocksWrapper.querySelector('#btn-send-study-chat');
  const typingIndicator = blocksWrapper.querySelector('#study-help-typing-indicator');

  const handleCoachInteraction = async ({ userDisplayMessage, assistMode = null }) => {
    if (isWaitingForCoach) return;
    const trimmed = String(userDisplayMessage || '').trim();
    if (!trimmed) return;

    isWaitingForCoach = true;
    if (sendBtn) sendBtn.disabled = true;

    unit.chatHistory[qIdx].push({
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString()
    });
    saveAppState();

    if (messagesBox) {
      const userBubbleRow = document.createElement('div');
      userBubbleRow.className = 'study-chat-bubble-row user-row';
      userBubbleRow.innerHTML = `
        <div class="study-chat-avatar-badge">🧑</div>
        <div class="study-chat-bubble user-bubble">
          <div class="study-chat-sender-name">דניאל</div>
          <div class="study-chat-text">${formatCoachChatHtml(trimmed)}</div>
        </div>
      `;
      messagesBox.appendChild(userBubbleRow);
      scrollToChatBottom();
    }

    if (typingIndicator) {
      typingIndicator.style.display = 'flex';
      scrollToChatBottom();
    }

    const result = await evaluateStudyHelpTurnWithAI({
      unit,
      qIdx,
      userText: trimmed,
      assistMode
    });

    if (typingIndicator) {
      typingIndicator.style.display = 'none';
    }

    unit.chatHistory[qIdx].push({
      role: 'coach',
      text: result.coach_reply,
      timestamp: new Date().toISOString()
    });

    if (messagesBox) {
      const coachBubbleRow = document.createElement('div');
      coachBubbleRow.className = 'study-chat-bubble-row coach-row';
      coachBubbleRow.innerHTML = `
        <div class="study-chat-avatar-badge">🤖</div>
        <div class="study-chat-bubble coach-bubble ${result.is_question_solved ? 'solved-coach-bubble' : ''}">
          <div class="study-chat-sender-name">המאמן האישי</div>
          <div class="study-chat-text">${formatCoachChatHtml(result.coach_reply)}</div>
        </div>
      `;
      messagesBox.appendChild(coachBubbleRow);
      scrollToChatBottom();
    }

    if (result.is_question_solved) {
      triggerStep1SuccessAndMfaGate();
    } else {
      saveAppState();
    }

    isWaitingForCoach = false;
    if (sendBtn) sendBtn.disabled = false;
  };

  if (sendBtn && chatInput) {
    sendBtn.onclick = () => {
      const val = chatInput.value.trim();
      if (!val) return;
      chatInput.value = '';
      handleCoachInteraction({ userDisplayMessage: val, assistMode: null });
    };

    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    };
  }

  const quickChips = blocksWrapper.querySelectorAll('.study-quick-assist-chip[data-assist]');
  quickChips.forEach(chip => {
    chip.onclick = () => {
      const mode = chip.getAttribute('data-assist');
      const labelMap = {
        hint: '💡 אשמח לקבל רמז כיוון לשאלה הזו',
        steps: '🔍 פרק לי בבקשה את השאלה לשלבים קטנים',
        explain: '📖 הסבר לי שוב בפשטות את הכלל בשאלה הזו'
      };
      handleCoachInteraction({
        userDisplayMessage: labelMap[mode] || chip.textContent.trim(),
        assistMode: mode
      });
    };
  });
}

/**
 * Escapes double quotes for safe HTML attribute rendering.
 * @param {string} val
 * @returns {string}
 */
function escapeHtmlAttr(val) {
  return String(val || '').replace(/"/g, '&quot;');
}

/**
 * Normalizes Stage 2 question fields (table_schema, userTableRows, guided_options,
 * mfa_verification, step_by_step_guide, notebook_copy_summary) so every question
 * supports Mode A (Table), Mode B (Guided Options), Mode C (Free Chat), 2-Step MFA,
 * and Ready-to-Copy to Notebook seamlessly.
 * @param {object} q
 * @param {number} qIdx
 * @param {object} unit
 */
function ensureQuestionStage2Schema(q, qIdx, unit) {
  if (!q || typeof q !== 'object') return;
  q.page_number = Number(q.page_number) || 1;
  q.question_number_label = String(q.question_number_label || `שאלה ${qIdx + 1}`).trim();
  q.exact_book_text = String(q.exact_book_text || q.original_question || q.questionText || `שאלה ${qIdx + 1}`).trim();
  q.friendly_translation = String(
    q.friendly_translation ||
    q.topic_focus ||
    'נקרא יחד את הנתונים מהספר, נזהה מה נכנס ומה יצא, ונפתור צעד אחר צעד.'
  ).trim();

  if (!Array.isArray(q.step_by_step_guide) || q.step_by_step_guide.length === 0) {
    q.step_by_step_guide = [
      'שלב 1: קרא את נתוני השאלה וזהה את הסכומים והחשבונות המשתתפים.',
      'שלב 2: קבע איזה חשבון נמצא בחובה ואיזה חשבון נמצא בזכות (או בחר מהאפשרויות המוכנות למטה).',
      'שלב 3: אשר את וידוא ההבנה הקצר והעתק את הפתרון המסודר למחברת שלך.'
    ];
  }

  // Table schema normalization
  if (!q.table_schema || typeof q.table_schema !== 'object') {
    q.table_schema = { has_table: false, columns: [], account_choices: [], expected_rows: [] };
  }
  if (!Array.isArray(q.table_schema.columns) || q.table_schema.columns.length < 3) {
    q.table_schema.columns = ['חובה (סכום)', 'זכות (סכום)', 'פרטים / שם החשבון'];
  }
  if (!Array.isArray(q.table_schema.expected_rows)) {
    q.table_schema.expected_rows = [];
  }

  const defaultAccounts = [
    'קופה',
    'עו"ש בנק',
    'לקוחות',
    'ספקים',
    'הכנסות ממכירות',
    'קניות סחורה',
    'מע"מ עסקאות',
    'מע"מ תשומות',
    'הוצאות הנהלה וכלליות',
    'הון עצמי'
  ];
  const expectedDetails = q.table_schema.expected_rows
    .map(r => String(r?.details || '').trim())
    .filter(Boolean);
  const rawChoices = Array.isArray(q.table_schema.account_choices) ? q.table_schema.account_choices : [];
  q.table_schema.account_choices = Array.from(new Set([...expectedDetails, ...rawChoices, ...defaultAccounts]));

  const desiredRowCount = Math.max(2, q.table_schema.expected_rows.length);
  if (!Array.isArray(q.userTableRows) || q.userTableRows.length === 0) {
    q.userTableRows = Array.from({ length: desiredRowCount }, () => ({ debit: '', credit: '', details: '' }));
  }

  // Guided options fallback so Mode B is always available
  if (!Array.isArray(q.guided_options) || q.guided_options.length < 2) {
    const expectedSummary = String(
      q.notebook_copy_summary ||
      q.expected_answer_summary ||
      (q.table_schema.expected_rows.length > 0
        ? q.table_schema.expected_rows.map(r => `${r.details}: ${r.debit ? `חובה ${r.debit}` : `זכות ${r.credit}`}`).join(' , ')
        : 'זיהוי הנתונים מהספר ורישום מאוזן של חובה וזכות בהתאם לכללי השיעור')
    ).trim();

    q.guided_options = [
      expectedSummary,
      'רישום צד אחד בלבד ללא איזון בין חובה לזכות',
      'התעלמות מחלק מהנתונים והסכומים המופיעים בשאלה'
    ];
    q.correct_option_index = 0;
  }

  // Gentle 2-Step MFA verification normalization
  if (
    !q.mfa_verification ||
    typeof q.mfa_verification !== 'object' ||
    !q.mfa_verification.question ||
    !Array.isArray(q.mfa_verification.options) ||
    q.mfa_verification.options.length < 2
  ) {
    q.mfa_verification = {
      question: 'למה הפתרון הזה נכון ומדויק לפי כללי הנהלת חשבונות?',
      options: [
        'כי הוא מבוסס ישירות על הנתונים בעמוד הספר ושומר על איזון מלא ונכון',
        'כי ניחשנו סכומים אקראיים ללא קשר לשאלה'
      ],
      correct_index: 0
    };
  }

  if (!q.notebook_copy_summary) {
    q.notebook_copy_summary = String(
      q.expected_answer_summary ||
      q.guided_options[Number(q.correct_option_index) || 0] ||
      'הפתרון אומת בהצלחה ומוכן להעתקה למחברת.'
    ).trim();
  }

  if (unit && Array.isArray(unit.solvedQuestions) && unit.solvedQuestions[qIdx]) {
    q.step1Solved = true;
    q.mfaConfirmed = true;
  }
}

/**
 * Helper to convert 0-based option index to Hebrew letter.
 * @param {number} idx
 * @returns {string}
 */
function idxToHebrewLetter(idx) {
  const letters = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
  return letters[idx] || String(idx + 1);
}

/**
 * Binds click events on the 2-Stage Journey Bar at the top of `openStudyHelpUnit`.
 * @param {HTMLElement} blocksWrapper
 * @param {object} unit
 * @param {boolean} allConceptsMastered
 */
function bindJourneyBarEvents(blocksWrapper, unit, allConceptsMastered) {
  const prevSlideBtn = blocksWrapper.querySelector('#btn-prev-slide-deck');
  if (prevSlideBtn) {
    prevSlideBtn.onclick = async () => {
      await UnitBeatCursor.goPrev(unit);
    };
  }

  const openAllPagesBtn = blocksWrapper.querySelector('#btn-open-all-pages-viewer');
  if (openAllPagesBtn) {
    openAllPagesBtn.onclick = () => {
      const curSlide = UnitBeatCursor.getCurrentSlide(unit);
      let pageHint = 1;
      if (curSlide?.type === 'CONCEPT_SLIDE') {
        pageHint = Number(unit.concepts?.[curSlide.conceptIdx]?.page_number) || 1;
      } else if (curSlide?.type === 'HOMEWORK_SLIDE') {
        pageHint = Number(unit.questions?.[curSlide.qIdx]?.page_number) || 1;
      }
      openLessonPageViewerModal(unit, pageHint);
    };
  }

  const stage1Btn = blocksWrapper.querySelector('#btn-journey-stage1');
  const stage2Btn = blocksWrapper.querySelector('#btn-journey-stage2');

  if (stage1Btn) {
    stage1Btn.onclick = async () => {
      const deck = UnitBeatCursor.getFlatSlideDeck(unit);
      const stage1Slides = deck.filter(s => s.type !== 'HOMEWORK_SLIDE');
      const nextStage1 = stage1Slides.find(s => s.isUnlocked && !s.isCompleted)
        || stage1Slides.filter(s => s.isUnlocked).pop()
        || stage1Slides[0];
      if (nextStage1) {
        await UnitBeatCursor.goToSlide(unit, nextStage1.slideIndex);
      }
    };
  }

  if (stage2Btn) {
    stage2Btn.onclick = async () => {
      if (!allConceptsMastered || !UnitBeatCursor.areAllConceptBeatsMastered(unit)) {
        if (typeof showToast === 'function') {
          showToast('שקופיות שיעורי הבית ייפתחו מיד לאחר שכל קבוצות המושגים יהיו ברורים ב-100% מול המורה הפרטי! ☀️🔒', 'warning');
        }
        return;
      }
      if (!Array.isArray(unit.questions) || unit.questions.length === 0) {
        if (typeof showToast === 'function') {
          showToast('קובץ זה מכיל מושגים ודוגמאות בלבד.', 'info');
        }
        return;
      }
      await UnitBeatCursor.goToHomeworkQuestion(unit, unit.currentQuestionIdx || 0);
    };
  }

  // Bind Guiding Stones Timeline clicks (`data-cursor-slide-idx`)
  blocksWrapper.querySelectorAll('[data-cursor-slide-idx]').forEach(stoneBtn => {
    stoneBtn.onclick = async () => {
      const targetIdx = Number(stoneBtn.getAttribute('data-cursor-slide-idx'));
      if (!isNaN(targetIdx)) {
        await UnitBeatCursor.goToSlide(unit, targetIdx);
      }
    };
  });

  const trophyBtn = blocksWrapper.querySelector('#btn-timeline-trophy-exam');
  if (trophyBtn) {
    trophyBtn.onclick = async () => {
      await completeStudyHelpUnitAndGenerateExam(unit);
    };
  }
}

/**
 * Renders the Track 3 ("עזרה בלימודים") Roadmap View inside `container` (#units-grid):
 * 1. Top "העלאת החומר של היום" Dual Upload Hub Card
 * 2. Chronological list of `appState.studyHelpUnits` as Guiding Stone cards
 * @param {HTMLElement} container
 */
function renderStudyHelpRoadmap(container) {
  const target = container || document.getElementById('units-grid');
  if (!target) return;

  if (!Array.isArray(appState.studyHelpUnits)) {
    appState.studyHelpUnits = [];
  }
  if (
    appState.studyHelpUnits.length === 0 &&
    Array.isArray(appState.studyHelp?.dailyCards) &&
    appState.studyHelp.dailyCards.length > 0
  ) {
    appState.studyHelpUnits = appState.studyHelp.dailyCards.map(c => ({
      ...c,
      createdAtLabel: c.createdAtLabel || c.dateLabel || getTodayHebrewDateLabel(),
      introText: c.introText || (Array.isArray(c.introAndRules) ? c.introAndRules[0] : ''),
      goldenRules: Array.isArray(c.goldenRules) ? c.goldenRules : (Array.isArray(c.introAndRules) ? c.introAndRules : []),
      completed: Boolean(c.completed || c.isCompleted),
      currentQuestionIdx: Number(c.currentQuestionIdx) || 0,
      chatHistory: Array.isArray(c.chatHistory) ? c.chatHistory : []
    }));
    saveAppState();
  }

  const todayLabel = getTodayHebrewDateLabel();
  const units = appState.studyHelpUnits;

  target.innerHTML = `
    <div class="study-help-roadmap-wrapper" dir="rtl">
      ${buildHabitMomentumBarHtml()}

      <!-- כרטיס מרכזי עליון: העלאת החומר של היום -->
      <section class="card study-upload-hub-card" aria-label="העלאת החומר של היום">
        <div class="study-upload-hub-top">
          <span class="study-today-date-badge">📅 החומר של היום: ${todayLabel}</span>
          <span class="badge-tag" style="background:#e0f2fe;color:#0369a1;font-weight:700;">מאמן אישי צעד אחר צעד 🤝</span>
        </div>

        <h2 class="study-upload-hub-title">העלאת החומר של היום 📚</h2>
        <p class="study-upload-hub-desc">
          העלה לכאן את דפי התרגול של היום מהספר או הדבק את השאלות, והמאמן האישי יבנה לך יחידת לימוד מודרכת צעד אחר צעד!
        </p>

        <!-- שני כפתורי הפעולה המרכזיים זה לצד זה -->
        <div class="study-upload-dual-buttons">
          <button type="button" id="btn-upload-camscanner-pdf" class="study-hub-action-btn upload-pdf-btn">
            <span class="study-hub-btn-icon">📄</span>
            <span class="study-hub-btn-text">
              <strong>העלאת PDF סרוק (CamScanner) או תמונות מהספר</strong>
              <small>בחירת קובץ PDF (עד 15 עמודים של שיעור מלא) או צילומי עמודים</small>
            </span>
          </button>

          <button type="button" id="btn-paste-direct-text" class="study-hub-action-btn paste-text-btn" aria-expanded="false">
            <span class="study-hub-btn-icon">✍️</span>
            <span class="study-hub-btn-text">
              <strong>הדבקת טקסט של השאלות והחומר ישירות</strong>
              <small>הקלדה או הדבקה מהירה של שאלות התרגול ללא קובץ</small>
            </span>
          </button>
        </div>

        <!-- קלט קבצים נסתר עבור PDF ותמונות -->
        <input
          type="file"
          id="study-help-file-input"
          accept=".pdf,image/*,.jpg,.jpeg,.png,.webp"
          multiple
          style="display:none;"
        />

        <!-- מגירת הדבקת טקסט ישירה -->
        <div id="direct-text-drawer" class="study-direct-text-drawer" style="display:none;">
          <label for="study-help-direct-textarea" class="study-drawer-label">
            ✍️ הדבק או הקלד כאן את השאלות או החומר של היום:
          </label>
          <textarea
            id="study-help-direct-textarea"
            class="study-direct-textarea"
            rows="6"
            placeholder="הדבק או הקלד כאן את השאלות או החומר של היום..."
          ></textarea>
          <div class="study-drawer-actions">
            <button type="button" id="btn-submit-direct-text" class="primary-btn study-create-unit-btn">
              <span>🚀 סדר את החומר וצור את יחידת הלימוד של היום</span>
            </button>
          </div>
        </div>
      </section>

      <!-- רשימה כרונולוגית של יחידות התרגול היומיות -->
      <section class="study-units-chronological-section" aria-label="יחידות התרגול היומיות שלי">
        <div class="study-units-section-header">
          <div>
            <h3 class="study-units-section-title">🗂️ יחידות התרגול היומיות שלי (לפי סדר כרונולוגי)</h3>
            <p class="study-units-section-subtitle">
              כל העלאה יוצרת אבן דרך חדשה בתחתית הרשימה. לחץ על כל כרטיס כדי להיכנס לשלב 1 (פיצוח המושגים) ולשלב 2 (פתרון השאלות מהספר).
            </p>
          </div>
          <span class="badge-tag" style="background:#f1f5f9;color:#334155;font-weight:800;">
            סה"כ ${units.length} יחידות
          </span>
        </div>

        <div id="study-help-units-list" class="study-help-units-list">
          ${units.length === 0 ? `
            <div class="card study-units-empty-card">
              <div style="font-size:2.6rem; margin-bottom:0.5rem;">🌱</div>
              <h4 style="margin:0 0 0.4rem 0; font-size:1.2rem; color:#1e293b;">עדיין לא הועלו יחידות תרגול יומיות</h4>
              <p style="margin:0; color:#64748b; font-size:1rem;">
                בחר באחד משני הכפתורים למעלה כדי להעלות PDF מ-CamScanner, תמונה מהספר, או להדביק את שאלות התרגול של היום!
              </p>
            </div>
          ` : units.map((unit, idx) => {
            const concepts = Array.isArray(unit.concepts) ? unit.concepts : [];
            const questions = Array.isArray(unit.questions) ? unit.questions : [];
            const totalQ = questions.length;
            const solvedArr = Array.isArray(unit.solvedQuestions) ? unit.solvedQuestions : questions.map(q => Boolean(q && q.isCompleted));
            const solvedQ = solvedArr.filter(Boolean).length;
            const isDone = Boolean(unit.completed || unit.isCompleted || (totalQ > 0 && solvedQ === totalQ));
            const progressPct = isDone ? 100 : (totalQ > 0 ? Math.round((solvedQ / totalQ) * 100) : 0);
            const dateBadge = unit.createdAtLabel || unit.dateLabel || todayLabel;

            return `
              <article
                class="unit-card study-guiding-stone-card ${isDone ? 'completed-unit' : 'active-unit'} ${!isDone && unit.isNew ? 'is-new-study-card' : ''}"
                data-study-unit-id="${unit.id}"
                tabindex="0"
                role="button"
                aria-label="יחידת תרגול ${idx + 1}: ${unit.title}"
              >
                <div class="unit-card-info" style="width:100%;">
                  <span class="study-stone-index-circle">${isDone ? '✅' : `#${idx + 1}`}</span>
                  <div style="flex:1; min-width:0;">
                    <div class="study-card-badges-row">
                      <span class="badge-tag">📅 ${dateBadge}</span>
                      ${concepts.length > 0 ? `<span class="badge-tag" style="background:#dcfce7;color:#166534;">💡 ${concepts.length} מושגים</span>` : ''}
                      <span class="badge-tag" style="background:#e0f2fe;color:#0369a1;">📝 ${totalQ} שאלות</span>
                      ${isDone
                        ? `<span class="badge-completed-card">הושלם ✅</span>`
                        : `<span class="badge-new-card">חדש ✨</span>`
                      }
                    </div>
                    <h3 class="unit-name-title" style="margin:0.35rem 0;">${unit.lesson_title || unit.title}</h3>
                    <p class="unit-skills-preview" style="margin:0 0 0.65rem 0;">
                      ${unit.pages_summary || unit.introText || unit.topic_summary || 'לחץ כדי לפתוח את שלב פיצוח המושגים ופתרון השאלות מהספר.'}
                    </p>
                    <div class="study-card-progress-row">
                      <div class="study-card-progress-track">
                        <div class="study-card-progress-fill" style="width:${progressPct}%;"></div>
                      </div>
                      <span class="study-card-progress-label">
                        ${isDone ? 'כל השאלות הושלמו בהצלחה! 🌟' : `${solvedQ} מתוך ${totalQ} שאלות נפתרו (${progressPct}%)`}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="day-action-box" style="display:flex; flex-wrap:wrap; gap:0.45rem; align-items:center;">
                  <button type="button" class="secondary-btn edit-study-unit-btn" data-study-unit-id="${unit.id}" title="ערוך יחידת לימוד" style="padding:0.4rem 0.7rem; font-size:0.85rem; min-height:36px;">✏️ ערוך</button>
                  <button type="button" class="secondary-btn delete-study-unit-btn" data-study-unit-id="${unit.id}" title="מחק יחידת לימוד" style="padding:0.4rem 0.7rem; font-size:0.85rem; min-height:36px; color:#dc2626;">🗑️ מחק</button>
                  <button type="button" class="primary-btn open-study-unit-btn" data-study-unit-id="${unit.id}">
                    <span>${isDone ? 'צפה בתרגול' : (solvedQ > 0 ? 'המשך תרגול' : 'התחל בשיעור')}</span>
                    <span>▶</span>
                  </button>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    </div>
  `;

  // Bind Button 1: Upload CamScanner PDF or Images
  const uploadBtn = target.querySelector('#btn-upload-camscanner-pdf');
  const fileInput = target.querySelector('#study-help-file-input');
  if (uploadBtn && fileInput) {
    uploadBtn.onclick = () => {
      fileInput.value = '';
      fileInput.click();
    };

    fileInput.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      showStudyHelpLoadingOverlay('קורא וסורק את עמודי קובץ השיעור...');
      try {
        const sourceLabel = files.map(f => f.name.replace(/\.[^.]+$/, '')).join(', ');
        let extracted = {
          extractedText: '',
          inlineImages: [],
          pageSnapshots: [],
          rawPdfPart: null,
          pageCount: 0
        };

        if (typeof window !== 'undefined' && window.PDFExtractor && typeof window.PDFExtractor.extractFromFiles === 'function') {
          extracted = await window.PDFExtractor.extractFromFiles(files, (progressText) => {
            showStudyHelpLoadingOverlay(progressText);
          });
        }

        await generateDailyStudyUnitFromMaterial({
          extractedText: extracted.extractedText,
          inlineImages: extracted.inlineImages,
          pageSnapshots: extracted.pageSnapshots,
          rawPdfPart: extracted.rawPdfPart,
          sourceLabel,
          isFileUpload: true
        });
      } catch (err) {
        console.error('[StudyHelp] Error processing uploaded files:', err);
        showStudyHelpRetryModal(err && err.message ? err.message : String(err), async () => {
          if (_lastUploadRetryContext) {
            await generateDailyStudyUnitFromMaterial(_lastUploadRetryContext);
          }
        });
      }
    };
  }

  // Bind Button 2: Toggle Direct Text Paste Drawer
  const pasteBtn = target.querySelector('#btn-paste-direct-text');
  const drawer = target.querySelector('#direct-text-drawer');
  const textarea = target.querySelector('#study-help-direct-textarea');
  const submitTextBtn = target.querySelector('#btn-submit-direct-text');

  if (pasteBtn && drawer) {
    pasteBtn.onclick = () => {
      const isHidden = drawer.style.display === 'none';
      drawer.style.display = isHidden ? 'block' : 'none';
      pasteBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      if (isHidden && textarea) {
        textarea.focus();
      }
    };
  }

  if (submitTextBtn && textarea) {
    submitTextBtn.onclick = async () => {
      const rawText = textarea.value.trim();
      if (!rawText) {
        if (typeof showToast === 'function') {
          showToast('אנא הדבק או הקלד את השאלות והחומר של היום בתיבה ✍️', 'warning');
        }
        textarea.focus();
        return;
      }

      await generateDailyStudyUnitFromMaterial({
        extractedText: rawText,
        inlineImages: [],
        pageSnapshots: [],
        rawPdfPart: null,
        sourceLabel: `תרגול יומי (${todayLabel})`,
        isFileUpload: false
      });
    };
  }

  // Bind click events on chronological Guiding Stone cards
  const unitCards = target.querySelectorAll('.study-guiding-stone-card');
  unitCards.forEach(cardEl => {
    const uid = cardEl.getAttribute('data-study-unit-id');
    cardEl.onclick = (e) => {
      e.stopPropagation();
      openStudyHelpUnit(uid);
    };
    cardEl.onkeydown = (e) => {
      if (e.target && e.target !== cardEl && typeof e.target.closest === 'function' && e.target.closest('button')) {
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openStudyHelpUnit(uid);
      }
    };
  });

  target.querySelectorAll('.open-study-unit-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const uid = btn.getAttribute('data-study-unit-id');
      if (uid) openStudyHelpUnit(uid);
    };
  });

  target.querySelectorAll('.edit-study-unit-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const uid = btn.getAttribute('data-study-unit-id');
      if (uid && typeof openUniversalUnitQuickEditor === 'function') {
        openUniversalUnitQuickEditor('study_help', uid);
      }
    };
  });

  target.querySelectorAll('.delete-study-unit-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const uid = btn.getAttribute('data-study-unit-id');
      if (uid && typeof deleteUnitFromAnyTrack === 'function') {
        deleteUnitFromAnyTrack('study_help', uid);
      }
    };
  });
}

/**
 * Builds a complete, valid fallback Summary Exam unit in the Dynamic Block Engine schema
 * if offline or if AI JSON parsing needs recovery.
 * @param {object} unit
 * @param {string} examUnitId
 * @returns {object}
 */
function buildFallbackSummaryExamUnit(unit, examUnitId) {
  const dateLabel = unit.createdAtLabel || unit.dateLabel || getTodayHebrewDateLabel();
  const baseTitle = unit.lesson_title || unit.title || `תרגול יומי (${dateLabel})`;
  const goldenRuleText = Array.isArray(unit.goldenRules) && unit.goldenRules.length > 0
    ? unit.goldenRules.join(' • ')
    : 'מה שנכנס לעסק או מהווה הוצאה נרשם בחובה, ומה שיוצא מהעסק או מהווה הכנסה/מקור נרשם בזכות. תמיד מוודאים שסך החובה שווה לסך הזכות.';

  return {
    unit_id: examUnitId,
    id: examUnitId,
    title: `🏆 מבחן מסכם: ${baseTitle}`,
    createdAtLabel: dateLabel,
    sourceStudyUnitId: unit.id,
    isSummaryExam: true,
    isNewExam: true,
    isCompleted: false,
    target_minutes: 10,
    blocks: [
      {
        type: 'text',
        style: 'lead',
        content: `ברוך הבא למבחן המסכם המעשי על "${baseTitle}"! במבחן זה תיישם בעצמך את העקרונות שתרגלת היום עם מספרים חדשים ואירועים עסקיים חדשים.`
      },
      {
        type: 'callout',
        style: 'rule',
        title: 'תזכורת לכלל הזהב לפני שמתחילים',
        text: goldenRuleText
      },
      {
        type: 'spreadsheet_task',
        title: 'משימת חישוב מעשית: חשבונית רכש ומע"מ',
        instructions: 'עיין בנתוני העסקה שבטבלה וחשב את הסכום הכולל לתשלום לספק (כולל מע"מ).',
        table_data: {
          headers: ['תיאור הפריט', 'סכום לפני מע"מ (₪)', 'סכום מע"מ 18% (₪)'],
          rows: [
            ['רכישת סחורה לחנות', '4,000', '720'],
            ['הובלה ואריזה', '1,000', '180']
          ]
        },
        action_prompt: 'מהו הסכום הכולל לתשלום לספק (לפני מע"מ + מע"מ עבור שני הפריטים יחד)?',
        expected_numeric_answer: 5900,
        hint: 'חבר את הסכומים לפני מע"מ (4,000 + 1,000 = 5,000) והוסף את סך המע"מ (720 + 180 = 900).'
      },
      {
        type: 'journal_grid',
        title: 'רישום פקודת יומן ממוחשבת',
        scenario: 'העסק רכש סחורה בסך 5,000 ₪ + מע"מ תשומות בסך 900 ₪ (סה"כ 5,900 ₪) ושילם בהעברה בנקאית (עו"ש בנק). השלם את פקודת היומן:',
        accounts_options: ['קניות סחורה', 'מע"מ תשומות', 'עו"ש בנק', 'קופה', 'הכנסות ממכירות', 'לקוחות'],
        expected_rows: [
          { account: 'קניות סחורה', debit: 5000, credit: 0 },
          { account: 'מע"מ תשומות', debit: 900, credit: 0 },
          { account: 'עו"ש בנק', debit: 0, credit: 5900 }
        ],
        explanation: 'קניות סחורה (5,000) ומע"מ תשומות (900) נרשמים בחובה, ועו"ש בנק שיצא ממנו התשלום נרשם בזכות (5,900).'
      },
      {
        type: 'exercise',
        question: 'כאשר העסק רוכש סחורה מספק ומשלם בהעברה בנקאית, באיזה צד יירשם חשבון "קניות סחורה"?',
        options: [
          'בצד חובה — כי הסחורה נכנסה לעסק ומהווה הוצאה',
          'בצד זכות — כי כסף יצא מהבנק',
          'לא נרשם כלל בפקודת היומן',
          'נרשם גם בחובה וגם בזכות באותו סכום'
        ],
        correct_index: 0,
        hint: 'זכור: מה שנכנס לעסק או מהווה הוצאה נרשם בחובה.',
        explanation: 'חשבון קניות סחורה מייצג הוצאה ונכס שנכנס לעסק, ולכן הוא תמיד בחובה.'
      },
      {
        type: 'exercise',
        question: 'בעסקה של רכישת ציוד או סחורה עם חשבונית מס, באיזה חשבון נרשם המע"מ?',
        options: [
          'מע"מ עסקאות בזכות',
          'מע"מ תשומות בחובה',
          'הוצאות ריבית בחובה',
          'הון עצמי בזכות'
        ],
        correct_index: 1,
        hint: 'ברכישות מספקים המע"מ נקרא מע"מ תשומות.',
        explanation: 'ברכישה מספק העסק משלם מע"מ תשומות שניתן לקיזוז, ולכן הוא נרשם בחובה.'
      },
      {
        type: 'exercise',
        question: 'כאשר העסק מוכר סחורה ללקוח ומקבל תשלום במזומן לקופה, איזה חשבון יירשם בחובה?',
        options: [
          'חשבון קופה — כי נכנס מזומן לעסק',
          'חשבון הכנסות ממכירות',
          'חשבון מע"מ עסקאות',
          'חשבון ספקים'
        ],
        correct_index: 0,
        hint: 'שאל את עצמך: לאן נכנס הכסף בעסקה הזו?',
        explanation: 'המזומן נכנס לקופת העסק ולכן חשבון קופה מחויב (נרשם בחובה).'
      },
      {
        type: 'exercise',
        question: 'מהו כלל האיזון המחייב בכל פקודת יומן בהנהלת חשבונות כפולה?',
        options: [
          'סך החובה חייב להיות גבוה מסך הזכות',
          'סך החובה חייב להיות שווה בדיוק לסך הזכות',
          'מותר לרשום רק שורה אחת בכל פקודת יומן',
          'סך הזכות תמיד כפול מסך החובה'
        ],
        correct_index: 1,
        hint: 'חשוב על מאזניים מאוזנים.',
        explanation: 'בשיטה הכפולה סך כל הסכומים בחובה חייב תמיד להיות שווה לסך כל הסכומים בזכות.'
      },
      {
        type: 'exercise',
        question: 'עסק מכר שירות ללקוח ב-2,000 ₪ + מע"מ של 360 ₪ באשראי. מהו הסכום הכולל שיירשם לחובת חשבון הלקוח?',
        options: [
          '2,000 ₪ בלבד',
          '360 ₪ בלבד',
          '2,360 ₪ (הסכום המלא כולל מע"מ)',
          '1,640 ₪'
        ],
        correct_index: 2,
        hint: 'הלקוח חייב לעסק את מלוא סכום החשבונית כולל המע"מ.',
        explanation: 'חשבון הלקוח מחויב במלוא סכום העסקה כולל מע"מ: 2,000 + 360 = 2,360 ₪.'
      },
      {
        type: 'ai_eval_qa',
        question: 'הסבר במילים שלך: איך אתה בודק שפקודת יומן שרשמת היא מאוזנת ונכונה לפני שאתה מסיים תרגיל?',
        core_concept: 'בדיקה שזיהינו נכון מה נכנס (חובה) ומה יצא (זכות), ווידוא שסך כל הסכומים בצד החובה שווה בדיוק לסך כל הסכומים בצד הזכות.',
        rubric_for_ai: 'אשר בחום כל תשובה שבה דניאל מציין השוואה בין סך החובה לסך הזכות או בדיקה של מה נכנס לעומת מה שיצא.'
      }
    ]
  };
}

/**
 * Displays the Festive Completion & Exam Ready Modal celebrating Daniel's completion
 * of today's study unit and offering direct navigation to the new Summary Exam in the Accounting tab.
 * @param {object} unit
 * @param {object} examUnit
 */
function showExamReadyCelebrationModal(unit, examUnit) {
  let modal = document.getElementById('study-exam-ready-celebration-modal');
  if (modal) {
    modal.remove();
  }

  modal = document.createElement('div');
  modal.id = 'study-exam-ready-celebration-modal';
  modal.className = 'study-calming-overlay active';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="study-calming-modal study-exam-celebration-card" dir="rtl">
      <div class="study-celebration-trophy" aria-hidden="true">🏆✨</div>
      <h2 class="study-celebration-title">אלוף דניאל! סיימת בהצלחה את יחידת הלימוד של היום! 🌟</h2>
      <p class="study-celebration-desc">
        פתרת את כל השאלות ביחידה <strong>"${unit.lesson_title || unit.title}"</strong> בצורה מעוררת השראה!
      </p>
      <div class="study-celebration-exam-box">
        <div class="study-celebration-exam-badge">חדש בחלונית הנהלת חשבונות ✨</div>
        <h3 class="study-celebration-exam-name">${examUnit.title}</h3>
        <p class="study-celebration-exam-info">
          המאמן יצר עבורך מבחן מסכם מעשי חדש עם תרגילי חישוב, טבלת פקודת יומן, 5 שאלות אמריקאיות ושאלת סיכום כדי לבדוק שליטה עצמאית!
        </p>
      </div>
      <div class="study-celebration-actions">
        <button type="button" id="btn-go-to-accounting-exam-now" class="primary-btn study-go-exam-green-btn">
          <span>🚀 עבור עכשיו למבחן המסכם בהנהלת חשבונות</span>
        </button>
        <button type="button" id="btn-stay-in-study-help" class="secondary-btn study-stay-tab-btn">
          <span>הישאר בטאב עזרה בלימודים</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const goBtn = modal.querySelector('#btn-go-to-accounting-exam-now');
  const stayBtn = modal.querySelector('#btn-stay-in-study-help');

  if (goBtn) {
    goBtn.onclick = () => {
      modal.remove();
      appState.activeTrackId = 'accounting';
      appState.currentTrack = 'accounting';
      saveAppState();
      if (typeof renderTrackTabs === 'function') renderTrackTabs();
      if (typeof showView === 'function') showView('roadmap');
      if (typeof renderRoadmap === 'function') renderRoadmap();

      setTimeout(() => {
        const examZone = document.getElementById('homework-exams-zone');
        if (examZone && typeof examZone.scrollIntoView === 'function') {
          examZone.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    };
  }

  if (stayBtn) {
    stayBtn.onclick = () => {
      modal.remove();
      if (typeof showView === 'function') showView('roadmap');
      if (typeof renderRoadmap === 'function') renderRoadmap();
    };
  }
}

/**
 * Marks `unit` as completed, generates a brand-new Practical Summary Exam unit in the
 * Dynamic Block Engine schema (`blocks` array) via `callMultiTierAI` (with fallback),
 * pushes it to `appState.accountingSummaryExams`, and opens the Festive Celebration Modal.
 * @param {object} unit
 * @returns {Promise<object>}
 */
async function completeStudyHelpUnitAndGenerateExam(unit) {
  if (!unit) return null;

  unit.completed = true;
  unit.isCompleted = true;
  if (!unit.bonusStarsAwarded) {
    unit.bonusStarsAwarded = true;
    const stats = ensureStudyHelpStats();
    stats.lessonsCompleted = Math.max(
      (Number(stats.lessonsCompleted) || 0) + 1,
      (appState.studyHelpUnits || []).filter(u => Boolean(u && (u.completed || u.isCompleted))).length
    );
    awardStudyHelpStars(5, 'סיום יחידת שיעור מלאה 🏆');
  }
  if (!appState.trackProgress || typeof appState.trackProgress !== 'object') {
    appState.trackProgress = { general: [], accounting: [], study_help: [] };
  }
  if (!Array.isArray(appState.trackProgress.study_help)) {
    appState.trackProgress.study_help = [];
  }
  if (!appState.trackProgress.study_help.includes(unit.id)) {
    appState.trackProgress.study_help.push(unit.id);
  }
  if (!Array.isArray(appState.accountingSummaryExams)) {
    appState.accountingSummaryExams = [];
  }

  let existingExam = unit.summaryExamId
    ? appState.accountingSummaryExams.find(e => e && (e.unit_id === unit.summaryExamId || e.id === unit.summaryExamId))
    : appState.accountingSummaryExams.find(e => e && e.sourceStudyUnitId === unit.id);

  if (existingExam) {
    saveAppState();
    if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
      SoundService.playSuccessSound();
    }
    showExamReadyCelebrationModal(unit, existingExam);
    return existingExam;
  }

  showStudyHelpLoadingOverlay(
    'כל הכבוד דניאל! המאמן מנתח את כל מה שלמדת היום ומכין עבורך מבחן מסכם מעשי חדש בחלונית הנהלת חשבונות...'
  );

  const examUnitId = 'acc_exam_' + Date.now();
  const dateLabel = unit.createdAtLabel || unit.dateLabel || getTodayHebrewDateLabel();

  const practicedConceptsSummary = (unit.concepts || [])
    .map((c, idx) => `מושג ${idx + 1} (עמוד ${c.page_number || 1}): "${c.term_name}" — הסבר: ${c.simple_explanation} | דוגמה מהספר: ${c.textbook_example || ''}`)
    .join('\n');

  const practicedQuestionsSummary = (unit.questions || [])
    .map((q, idx) => {
      const tableRowsStr = (q.table_schema && Array.isArray(q.table_schema.expected_rows) && q.table_schema.expected_rows.length > 0)
        ? ` | מבנה טבלה (${(q.table_schema.columns || []).join(' / ')}): ` +
          q.table_schema.expected_rows.map(r => `[חובה: ${r.debit || 0}, זכות: ${r.credit || 0}, פרטים: ${r.details || ''}]`).join(', ')
        : '';
      return `שאלה ${idx + 1} (עמוד ${q.page_number || 1}): ${q.exact_book_text || q.original_question || q.questionText || ''} | פתרון מצופה: ${q.notebook_copy_summary || q.expected_answer_summary || ''}${tableRowsStr}`;
    })
    .join('\n');

  const systemInstruction = `אתה מומחה לפיתוח מבחנים מעשיים בהנהלת חשבונות עבור דניאל.
עליך לייצר יחידת מבחן מסכם מעשית בפורמט Dynamic Block Engine (JSON תקני בלבד בעברית, ללא טקסט חופשי מחוץ ל-JSON).`;

  const prompt = `דניאל סיים בהצלחה את יחידת התרגול היומית: "${unit.lesson_title || unit.title}".
סיכום הנושא והעמודים: ${unit.pages_summary || unit.topic_summary || unit.introText || ''}

המושגים ודוגמאות הספר שנלמדו בשלב 1:
${practicedConceptsSummary}

השאלות, הטבלאות והמספרים שדניאל פתר בשלב 2:
${practicedQuestionsSummary}

צור מבחן מסכם מעשי חדש הבוחן בדיוק את אותם מושגים, כללים ומבני טבלאות מתוך השיעור הזה עם **מספרים חדשים, תרחישים עסקיים חדשים ושאלות הבנה חדשות**.
החזר אובייקט JSON תקני בלבד עם מערך "blocks" הכולל בדיוק את הבלוקים הבאים:
1. בלוק "text" ("style": "lead", "content": "פתיחה מעודדת למבחן המסכם")
2. בלוק "callout" ("style": "rule", "title": "...", "text": "תזכורת לכלל החשבונאי המרכזי")
3. בלוק "spreadsheet_task" ("title": "...", "instructions": "...", "table_data": { "headers": ["...", "..."], "rows": [["...", "..."]] }, "action_prompt": "...", "expected_numeric_answer": 1234, "hint": "...")
4. בלוק "journal_grid" ("title": "...", "scenario": "...", "accounts_options": ["חשבון א", "חשבון ב", "חשבון ג", "חשבון ד"], "expected_rows": [ { "account": "חשבון א", "debit": 1000, "credit": 0 }, { "account": "חשבון ב", "debit": 0, "credit": 1000 } ], "explanation": "...")
5. חמישה (5) בלוקים מסוג "exercise" (לכל אחד: "type": "exercise", "question": "...", "options": ["תשובה 1", "תשובה 2", "תשובה 3", "תשובה 4"], "correct_index": 0, "hint": "...", "explanation": "...")
6. בלוק אחד מסוג "ai_eval_qa" ("type": "ai_eval_qa", "question": "שאלת הבנה ושיקוף פתוחה לדניאל", "core_concept": "...", "rubric_for_ai": "...")`;

  let examUnit = null;
  try {
    const raw = await callMultiTierAI(prompt, {
      systemInstruction,
      jsonMode: true,
      maxTokens: 8192
    });

    let parsed = null;
    if (typeof AIService !== 'undefined' && typeof AIService.cleanAndParseJSON === 'function') {
      parsed = AIService.cleanAndParseJSON(raw);
    } else {
      const m = String(raw || '').match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : raw);
    }

    if (parsed && Array.isArray(parsed.blocks) && parsed.blocks.length >= 6) {
      const fallbackExam = buildFallbackSummaryExamUnit(unit, examUnitId);
      const sanitizedBlocks = parsed.blocks.map(b => {
        if (!b || typeof b !== 'object') return null;
        if (b.type === 'spreadsheet_task') {
          return {
            ...fallbackExam.blocks[2],
            ...b,
            instructions: b.instructions || b.instruction || fallbackExam.blocks[2].instructions,
            action_prompt: b.action_prompt || b.question || fallbackExam.blocks[2].action_prompt,
            expected_numeric_answer: Number(b.expected_numeric_answer ?? b.expected_answer) || fallbackExam.blocks[2].expected_numeric_answer,
            table_data: (b.table_data && Array.isArray(b.table_data.headers) && Array.isArray(b.table_data.rows))
              ? b.table_data
              : fallbackExam.blocks[2].table_data
          };
        }
        if (b.type === 'journal_grid') {
          return {
            ...fallbackExam.blocks[3],
            ...b,
            expected_rows: Array.isArray(b.expected_rows) && b.expected_rows.length >= 2
              ? b.expected_rows.map(r => ({
                  account: String(r.account || '').trim(),
                  debit: Number(r.debit) || 0,
                  credit: Number(r.credit) || 0
                }))
              : fallbackExam.blocks[3].expected_rows
          };
        }
        return b;
      }).filter(Boolean);

      const exCount = sanitizedBlocks.filter(b => b.type === 'exercise').length;
      if (exCount < 5) {
        const fallbackExercises = fallbackExam.blocks.filter(b => b.type === 'exercise');
        for (let i = exCount; i < 5; i++) {
          sanitizedBlocks.push(fallbackExercises[i % fallbackExercises.length]);
        }
      }
      if (!sanitizedBlocks.some(b => b.type === 'ai_eval_qa')) {
        sanitizedBlocks.push(fallbackExam.blocks[fallbackExam.blocks.length - 1]);
      }

      examUnit = {
        unit_id: examUnitId,
        id: examUnitId,
        title: `🏆 מבחן מסכם: ${unit.lesson_title || unit.title}`,
        createdAtLabel: dateLabel,
        sourceStudyUnitId: unit.id,
        isSummaryExam: true,
        isNewExam: true,
        isCompleted: false,
        target_minutes: 10,
        blocks: sanitizedBlocks
      };
    }
  } catch (err) {
    console.warn('[StudyHelp] Using fallback summary exam structure:', err);
  }

  if (!examUnit) {
    examUnit = buildFallbackSummaryExamUnit(unit, examUnitId);
  }

  appState.accountingSummaryExams.push(examUnit);
  unit.summaryExamId = examUnit.unit_id;
  saveAppState();

  hideStudyHelpLoadingOverlay();

  if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
    SoundService.playSuccessSound();
  }

  showExamReadyCelebrationModal(unit, examUnit);
  return examUnit;
}

const BeatGenerator = {
  extractLessonBeatBlueprint,
  generateConceptBeatContent,
  generateHomeworkBeatContent,
  runAsyncBeatsWorker,
  ensureBeatReadyForLearner,
  groupConceptOutlinesIntoBeats,
  groupQuestionOutlinesIntoBeats
};

if (typeof window !== 'undefined') {
  window.BeatGenerator = BeatGenerator;
  window.UnitBeatCursor = UnitBeatCursor;
  window.performAsyncTutorContextHandoff = performAsyncTutorContextHandoff;
  window.evaluatePrivateTutorTurnWithGroq = evaluatePrivateTutorTurnWithGroq;
  window.extractLessonBeatBlueprint = extractLessonBeatBlueprint;
  window.generateConceptBeatContent = generateConceptBeatContent;
  window.generateHomeworkBeatContent = generateHomeworkBeatContent;
  window.runAsyncBeatsWorker = runAsyncBeatsWorker;
  window.ensureBeatReadyForLearner = ensureBeatReadyForLearner;
  window.getTodayHebrewDateLabel = getTodayHebrewDateLabel;
  window.showStudyHelpLoadingOverlay = showStudyHelpLoadingOverlay;
  window.hideStudyHelpLoadingOverlay = hideStudyHelpLoadingOverlay;
  window.showStudyHelpRetryModal = showStudyHelpRetryModal;
  window.openLessonPageViewerModal = openLessonPageViewerModal;
  window.generateDailyStudyUnitFromMaterial = generateDailyStudyUnitFromMaterial;
  window.renderStudyHelpRoadmap = renderStudyHelpRoadmap;
  window.openStudyHelpUnit = openStudyHelpUnit;
  window.completeStudyHelpUnitAndGenerateExam = completeStudyHelpUnitAndGenerateExam;
  window.showExamReadyCelebrationModal = showExamReadyCelebrationModal;
}
