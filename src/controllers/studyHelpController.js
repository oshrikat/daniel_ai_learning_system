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
          <div class="study-calming-step-pill" data-step="3">3. מכין את שלב פיצוח המושגים ואת צ'אט המאמן...</div>
        </div>
        <p class="study-calming-subtitle">
          קח נשימה רגועה, דניאל 💙 עוד כמה שניות כל החומר מהקובץ יהיה מונגש ומסודר צעד אחר צעד.
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
        (stepNum === '2' && (text.includes('מזהה') || text.includes('מחלץ') || text.includes('מנתח'))) ||
        (stepNum === '3' && text.includes('מכין'));
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

/**
 * Grounded parser for pasted text when running without cloud AI connectivity (e.g., offline pasted text only).
 * Uses ONLY the user's actual pasted text — NEVER injects hardcoded fake questions.
 * @param {object} params
 * @returns {object|null}
 */
function buildGroundedPastedTextUnit({ extractedText = '', sourceLabel = '' } = {}) {
  const cleanText = String(extractedText || '').trim();
  if (!cleanText) return null;

  const dateStr = getTodayHebrewDateLabel();
  const lines = cleanText
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean);

  const rawQuestions = cleanText
    .split(/(?=(?:^|\n)\s*(?:שאלה\s*\d+|תרגיל\s*\d+|\d+[\.\)\-]\s+))/g)
    .map(s => s.trim())
    .filter(s => s.length >= 6);

  const questionChunks = rawQuestions.length > 0 ? rawQuestions : [cleanText];

  const concepts = [
    {
      id: 'c1',
      term_name: 'זיהוי הנתונים והפעולה החשבונאית בשאלה',
      page_number: 1,
      simple_explanation: 'לפני שרושמים מספרים בטבלה, אנחנו קוראים את המשפט ומזהים מה נכנס לעסק (חובה) ומה יצא מהעסק (זכות) — ממש כמו לבדוק מה נכנס ויצא מהארנק.',
      textbook_example: lines[0] || cleanText.slice(0, 140),
      mfa_step1_question: 'מה הצעד הראשון שאנחנו עושים כשאנחנו קוראים שאלה חדשה בדף?',
      mfa_step1_options: [
        'מסמנים בנחת את הסכומים ומזהים מה נכנס לעסק ומה יצא ממנו',
        'מנחשים מספר אקראי בלי לקרוא את הנתונים',
        'מדלגים על השאלה בלי לבדוק את הסכומים'
      ],
      mfa_step1_correct_index: 0,
      mfa_step2_why_question: 'למה חשוב לבדוק מה נכנס ומה יצא לפני שרושמים בפקודת היומן?',
      mfa_step2_options: [
        'כדי לדעת בוודאות איזה חשבון נמצא בחובה ואיזה חשבון נמצא בזכות',
        'כי אין צורך באיזון בין חובה לזכות'
      ],
      mfa_step2_correct_index: 0
    }
  ];

  const questions = questionChunks.map((qText, idx) => ({
    id: `q${idx + 1}`,
    page_number: 1,
    question_number_label: `שאלה ${idx + 1}`,
    question_type: 'open_question',
    exact_book_text: qText,
    friendly_translation: 'נקרא יחד את השאלה שהדבקת, נזהה את הסכומים ואת החשבונות המשתתפים, ונרשום את הפתרון צעד אחר צעד.',
    table_schema: {
      has_table: false,
      columns: ['חובה', 'זכות', 'פרטים / שם החשבון'],
      account_choices: ['קופה', 'עו"ש בנק', 'הכנסות ממכירות', 'קניות סחורה', 'ספקים', 'לקוחות'],
      expected_rows: []
    },
    guided_options: [
      'זיהוי חשבון החובה וחשבון הזכות ורישום הסכום המדויק מתוך השאלה',
      'רישום צד אחד בלבד ללא איזון',
      'התעלמות מהסכום המופיע בשאלה'
    ],
    correct_option_index: 0,
    mfa_verification: {
      question: 'למה הפתרון שבחרנו מאוזן ונכון?',
      options: [
        'כי זיהינו את החשבון שמקבל (חובה) ואת החשבון שנותן (זכות) בסכומים שווים',
        'כי רשמנו רק צד אחד בטבלה'
      ],
      correct_index: 0
    },
    notebook_copy_summary: `פתרון שאלה ${idx + 1}: ${qText}`,
    step_by_step_guide: [
      'שלב 1: קריאת נתוני השאלה וסימון הסכומים.',
      'שלב 2: קביעת חשבון חובה וחשבון זכות ואיזון הסכומים.'
    ],
    hint: 'בדוק אילו חשבונות מופיעים בטקסט השאלה ומה הסכום שצוין.',
    expected_answer_summary: `פתרון מבוסס על נתוני השאלה: ${qText}`
  }));

  return {
    lesson_title: sourceLabel || `שיעור ותרגול יומי (${dateStr})`,
    pages_summary: 'יחידת לימוד זו נבנתה ישירות מתוך הטקסט שהדבקת: תחילה נעבור על המושג המרכזי ולאחר מכן נפתור יחד את השאלות.',
    concepts,
    questions
  };
}

/**
 * Calls `callMultiTierAI` (with `jsonMode: true`, `maxTokens: 8192`, `inlineImages`, and `rawPdfPart`)
 * instructing Gemini to analyze ALL uploaded pages of the lesson (explanations, examples, tables, and exercises)
 * and return the full structured JSON schema (`lesson_title`, `pages_summary`, `concepts`, `questions`).
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
  const hasImages = (Array.isArray(inlineImages) && inlineImages.length > 0) || Boolean(rawPdfPart && rawPdfPart.data);
  const cleanText = String(extractedText || '').trim();

  _lastUploadRetryContext = {
    extractedText,
    inlineImages,
    pageSnapshots,
    rawPdfPart,
    sourceLabel,
    isFileUpload
  };

  showStudyHelpLoadingOverlay(
    hasImages
      ? 'מנתח את כל עמודי השיעור, ההסברים, הדוגמאות והשאלות מתוך הקובץ...'
      : 'מזהה את המושגים והשאלות ובונה את שלבי הלימוד...'
  );

  const systemInstruction = `אתה מורה פרטי ומאמן הוראה מתקנת סבלני, חם ומקצועי להנהלת חשבונות עבור דניאל (בחור בן 28).
תפקידך לקרוא בעיון רב את כל העמודים שהועלו מקובץ השיעור (הן עמודי ההסבר והדוגמאות מהספר והן עמודי השאלות, הטבלאות והתרגילים) ולהחזיר אובייקט JSON תקני בלבד בעברית ברורה.
איסור מוחלט להמציא שאלות שלא מופיעות בחומר שהועלה! כל מושג, דוגמה ושאלה חייבים להיות מעוגנים ב-100% בטקסט ובתמונות של העמודים שהועלו.`;

  const prompt = `נתח את כל עמודי השיעור וחומר הלימוד המצורפים ובנה עבור דניאל יחידת לימוד מלאה בת 2 שלבים:
שלב 1: פיצוח המושגים והדוגמאות מתוך עמודי ההסבר בספר (עם הסבר פשוט בגובה העיניים ווידוא הבנה עדין בן 2 שלבים).
שלב 2: כל השאלות, התרגילים והטבלאות המופיעים בדפים — עם ציטוט מדויק מהספר, תרגום ידידותי ופשוט לדניאל, סכמת טבלה (אם השאלה דורשת טבלת חובה/זכות או טבלה אחרת), אפשרויות מונחות וניסוח מסודר להעתקה למחברת.

${sourceLabel ? `שם הקובץ / מקור החומר: ${sourceLabel}` : ''}
${cleanText ? `\nטקסט שחולץ מעמודי הקובץ:\n"""\n${cleanText}\n"""\n` : '\nחלץ וקרא בקפידה את כל הטקסט, ההסברים, הטבלאות והשאלות מתוך צילומי העמודים המצורפים לפי סדר העמודים.\n'}

החזר אך ורק אובייקט JSON תקני במבנה המדויק הבא:
{
  "lesson_title": "הכותרת המדויקת של השיעור מתוך הדפים (למשל: שיעור 1 - מבוא להנהלת חשבונות וחובה/זכות)",
  "pages_summary": "תיאור קצר וחם למה שמופיע בעמודי הקובץ (למשל: עמודים 1-4 הסברים ודוגמאות מהספר, עמודים 5-8 תרגילים וטבלאות)",
  "concepts": [
    {
      "id": "c1",
      "term_name": "שם המושג או הכלל מתוך הדף",
      "page_number": 1,
      "simple_explanation": "הסבר פשוט וברור ברמת פשטות של 'מים' או 'לחייך' (1-2 משפטים קצרים מחיי היומיום)",
      "textbook_example": "איך המושג או הדוגמה מופיעים בדף שהועלה (כולל המספרים או המילים המדויקות מהעמוד בספר)",
      "mfa_step1_question": "שאלת הבנה ראשונה ופשוטה על המושג",
      "mfa_step1_options": ["התשובה הנכונה והפשוטה", "מסיח 1", "מסיח 2"],
      "mfa_step1_correct_index": 0,
      "mfa_step2_why_question": "וידוא הבנה שני (עדין וקצר): למה זה נכון או איזו דוגמה מתאימה לזה?",
      "mfa_step2_options": ["ההסבר הפשוט והנכון", "הסבר שגוי"],
      "mfa_step2_correct_index": 0
    }
  ],
  "questions": [
    {
      "id": "q1",
      "page_number": 5,
      "question_number_label": "שאלה 1 (או טבלה בעמוד 5)",
      "question_type": "journal_table | general_table | calculation | multiple_choice | open_question",
      "exact_book_text": "הציטוט המדויק של השאלה, הסעיפים והמספרים מתוך העמוד הסרוק בספר",
      "friendly_translation": "תרגום מונגש, חם ופשוט עבור דניאל: מה בעצם מבקשים ממך לעשות כאן ואיך לגשת לזה בלי להתבלבל (ב-2-3 צעדים פשוטים)",
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
        "התשובה הנכונה המלאה לבחירה נוחה",
        "אפשרות שגויה 1",
        "אפשרות שגויה 2"
      ],
      "correct_option_index": 0,
      "mfa_verification": {
        "question": "וידוא הבנה מהיר (שלב 2): למה בחרנו/רשמנו את הפתרון הזה?",
        "options": ["הנימוק הנכון והפשוט", "נימוק לא נכון"],
        "correct_index": 0
      },
      "notebook_copy_summary": "הניסוח המדויק והמסודר שדניאל צריך להעתיק למחברת או לדף העבודה שלו עבור שאלה זו",
      "step_by_step_guide": ["שלב 1...", "שלב 2..."],
      "hint": "רמז עדין ומכוון",
      "expected_answer_summary": "הפתרון המלא והמדויק"
    }
  ]
}`;

  let parsedUnit = null;
  let lastDiagnosticError = '';

  // Try up to 2 attempts if AI call or JSON parse fails
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (attempt === 2) {
        showStudyHelpLoadingOverlay('מבצע ניסיון שני מעמיק לפענוח כל עמודי השיעור...');
      }
      const rawResponse = await callMultiTierAI(prompt, {
        systemInstruction,
        jsonMode: true,
        maxTokens: 8192,
        inlineImages: hasImages ? inlineImages : [],
        rawPdfPart: rawPdfPart || null
      });

      if (typeof AIService !== 'undefined' && typeof AIService.cleanAndParseJSON === 'function') {
        parsedUnit = AIService.cleanAndParseJSON(rawResponse);
      } else {
        const jsonMatch = String(rawResponse || '').match(/\{[\s\S]*\}/);
        parsedUnit = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);
      }

      if (
        parsedUnit &&
        typeof parsedUnit === 'object' &&
        ((Array.isArray(parsedUnit.questions) && parsedUnit.questions.length > 0) ||
          (Array.isArray(parsedUnit.concepts) && parsedUnit.concepts.length > 0))
      ) {
        break;
      } else {
        lastDiagnosticError = 'המודל החזיר מבנה ללא שאלות או מושגים.';
        parsedUnit = null;
      }
    } catch (err) {
      lastDiagnosticError = err && err.message ? err.message : String(err);
      console.warn(`[StudyHelp] Attempt ${attempt} failed:`, err);
      parsedUnit = null;
    }
  }

  // If AI failed and this was a file upload (or no pasted text), NEVER inject fake hardcoded questions!
  if (!parsedUnit) {
    if (isFileUpload || hasImages || !cleanText) {
      showStudyHelpRetryModal(lastDiagnosticError || 'לא התקבל מענה תקין משרת ה-AI עבור קובץ השיעור.', async () => {
        if (_lastUploadRetryContext) {
          await generateDailyStudyUnitFromMaterial(_lastUploadRetryContext);
        }
      });
      return null;
    }
    // Only if Daniel directly pasted text and is offline, structure his exact pasted text without fake questions
    parsedUnit = buildGroundedPastedTextUnit({ extractedText: cleanText, sourceLabel });
    if (!parsedUnit) {
      showStudyHelpRetryModal(lastDiagnosticError || 'לא ניתן היה לחלץ שאלות מהטקסט.', async () => {
        if (_lastUploadRetryContext) {
          await generateDailyStudyUnitFromMaterial(_lastUploadRetryContext);
        }
      });
      return null;
    }
  }

  const unitId = `sh_unit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const dateLabel = getTodayHebrewDateLabel();

  // Normalize Concepts
  const rawConcepts = Array.isArray(parsedUnit.concepts) && parsedUnit.concepts.length > 0
    ? parsedUnit.concepts
    : [
        {
          id: 'c1',
          term_name: parsedUnit.lesson_title || parsedUnit.title || 'העיקרון המרכזי בשיעור',
          page_number: 1,
          simple_explanation: parsedUnit.pages_summary || parsedUnit.topic_summary || 'נבין יחד את הכלל הפשוט שעומד מאחורי השיעור של היום לפני שנפתור את השאלות.',
          textbook_example: Array.isArray(parsedUnit.golden_rules) && parsedUnit.golden_rules[0]
            ? parsedUnit.golden_rules[0]
            : 'בכל רישום חשבונאי אנו מזהים מה נכנס לעסק ומה יצא ממנו.',
          mfa_step1_question: 'איך אנחנו ניגשים נכון לפתרון השאלות בשיעור הזה?',
          mfa_step1_options: [
            'קוראים את הנתונים מהספר צעד אחר צעד ומיישמים את הכלל שלמדנו',
            'מנחשים תשובה בלי לבדוק את הנתונים בדף',
            'מדלגים על קריאת השאלה'
          ],
          mfa_step1_correct_index: 0,
          mfa_step2_why_question: 'למה חשוב לעבוד לפי השלבים שלמדנו בדוגמה מהספר?',
          mfa_step2_options: [
            'כי כך אנחנו מבינים ב-100% כל פעולה ומונעים טעויות חישוב או רישום',
            'אין צורך לבדוק את הנתונים'
          ],
          mfa_step2_correct_index: 0
        }
      ];

  const normalizedConcepts = rawConcepts.map((c, idx) => {
    const step1Opts = Array.isArray(c.mfa_step1_options) && c.mfa_step1_options.length >= 2
      ? c.mfa_step1_options.map(o => String(o).trim())
      : ['הבנת הכלל והנתונים מהדוגמה בספר', 'ניחוש אקראי ללא בדיקה'];
    const step2Opts = Array.isArray(c.mfa_step2_options) && c.mfa_step2_options.length >= 2
      ? c.mfa_step2_options.map(o => String(o).trim())
      : ['כי זה מדגים בדיוק איך הכלל פועל בפועל בתרגיל', 'כי אין קשר בין הכלל לתרגיל'];

    return {
      id: c.id || `${unitId}_c${idx + 1}`,
      index: idx + 1,
      term_name: String(c.term_name || `מושג ${idx + 1}`).trim(),
      page_number: Number(c.page_number) || 1,
      simple_explanation: String(c.simple_explanation || '').trim(),
      textbook_example: String(c.textbook_example || '').trim(),
      mfa_step1_question: String(c.mfa_step1_question || `מה אומר המושג "${c.term_name || ''}" במילים פשוטות?`).trim(),
      mfa_step1_options: step1Opts,
      mfa_step1_correct_index: Math.min(Math.max(0, Number(c.mfa_step1_correct_index) || 0), step1Opts.length - 1),
      mfa_step2_why_question: String(c.mfa_step2_why_question || 'וידוא הבנה שני: למה ההסבר הזה נכון ומתאים לדוגמה בספר?').trim(),
      mfa_step2_options: step2Opts,
      mfa_step2_correct_index: Math.min(Math.max(0, Number(c.mfa_step2_correct_index) || 0), step2Opts.length - 1),
      extraSimplerAnalogy: '',
      check1Passed: false,
      mastered: false
    };
  });

  // Normalize Questions
  const rawQuestions = Array.isArray(parsedUnit.questions) ? parsedUnit.questions : [];
  const normalizedQuestions = rawQuestions.map((q, idx) => {
    const exactText = String(q.exact_book_text || q.original_question || q.questionText || q.question || `שאלה ${idx + 1} מתוך הקובץ`).trim();
    const friendlyTrans = String(q.friendly_translation || q.topic_focus || 'נקרא את השאלה בנחת ונפתור אותה צעד אחר צעד.').trim();
    const stepGuide = Array.isArray(q.step_by_step_guide) && q.step_by_step_guide.length > 0
      ? q.step_by_step_guide.map(s => String(s).trim()).filter(Boolean)
      : ['שלב 1: קריאת הנתונים מהספר', 'שלב 2: רישום הפתרון ובדיקתו'];

    return {
      id: q.id || `${unitId}_q${idx + 1}`,
      index: idx + 1,
      page_number: Number(q.page_number) || 1,
      question_number_label: String(q.question_number_label || `שאלה ${idx + 1}`).trim(),
      question_type: String(q.question_type || 'open_question').trim(),
      exact_book_text: exactText,
      original_question: exactText,
      questionText: exactText,
      friendly_translation: friendlyTrans,
      topic_focus: friendlyTrans,
      topic: friendlyTrans,
      table_schema: q.table_schema && typeof q.table_schema === 'object'
        ? q.table_schema
        : { has_table: false, columns: [], account_choices: [], expected_rows: [] },
      guided_options: Array.isArray(q.guided_options) ? q.guided_options : [],
      correct_option_index: Number(q.correct_option_index) || 0,
      mfa_verification: q.mfa_verification && typeof q.mfa_verification === 'object'
        ? q.mfa_verification
        : null,
      notebook_copy_summary: String(q.notebook_copy_summary || q.expected_answer_summary || '').trim(),
      step_by_step_guide: stepGuide,
      hint: String(q.hint || 'הסתכל על הדוגמה שלמדנו בשלב המושגים ויישם אותה כאן צעד אחר צעד.').trim(),
      expected_answer_summary: String(q.expected_answer_summary || q.notebook_copy_summary || '').trim(),
      coreConcept: String(q.expected_answer_summary || q.notebook_copy_summary || '').trim(),
      isCompleted: false,
      chatHistory: []
    };
  });

  const lessonTitle = String(
    parsedUnit.lesson_title ||
    parsedUnit.title ||
    sourceLabel ||
    `שיעור יומי (${dateLabel})`
  ).trim();

  const pagesSummary = String(
    parsedUnit.pages_summary ||
    parsedUnit.topic_summary ||
    parsedUnit.introText ||
    'ביחידה זו נלמד קודם את המושגים והדוגמאות מתוך עמודי הקובץ, ומיד לאחר מכן נפתור יחד את השאלות והטבלאות!'
  ).trim();

  const goldenRules = normalizedConcepts.slice(0, 3).map(c => `${c.term_name}: ${c.simple_explanation}`);

  // Store compact pageSnapshots ({ pageNumber, dataUrl }) on the unit object
  const storedSnapshots = Array.isArray(pageSnapshots) && pageSnapshots.length > 0
    ? pageSnapshots.map(s => ({
        pageNumber: Number(s.pageNumber) || 1,
        dataUrl: s.dataUrl || (s.data ? `data:${s.mimeType || 'image/jpeg'};base64,${s.data}` : '')
      }))
    : (Array.isArray(inlineImages)
      ? inlineImages
          .filter(img => !img.isNativePdf && img.mimeType !== 'application/pdf')
          .map((img, i) => ({
            pageNumber: Number(img.pageNumber) || i + 1,
            dataUrl: img.dataUrl || (img.data ? `data:${img.mimeType || 'image/jpeg'};base64,${img.data}` : '')
          }))
      : []);

  const newUnit = {
    id: unitId,
    createdAt: new Date().toISOString(),
    createdAtLabel: dateLabel,
    dateLabel,
    title: lessonTitle,
    lesson_title: lessonTitle,
    pages_summary: pagesSummary,
    introText: pagesSummary,
    topic_summary: pagesSummary,
    goldenRules,
    golden_rules: goldenRules,
    introAndRules: [pagesSummary, ...goldenRules],
    concepts: normalizedConcepts,
    currentConceptIdx: 0,
    activeStage: 'stage1',
    pageSnapshots: storedSnapshots,
    questions: normalizedQuestions,
    chatHistory: normalizedQuestions.map(() => []),
    solvedQuestions: normalizedQuestions.map(() => false),
    currentQuestionIdx: 0,
    isNew: true,
    completed: false,
    isCompleted: false,
    summaryExamId: null
  };

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
  hideStudyHelpLoadingOverlay();

  if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
    SoundService.playSuccessSound();
  }
  if (typeof showToast === 'function') {
    showToast('יחידת השיעור של היום מוכנה! גלול למטה לכרטיס החדש 🌟', 'success');
  }

  if (typeof renderRoadmap === 'function') {
    renderRoadmap();
  }

  setTimeout(() => {
    const newCardEl = document.querySelector(`[data-study-unit-id="${newUnit.id}"]`);
    if (newCardEl && typeof newCardEl.scrollIntoView === 'function') {
      newCardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 150);

  return newUnit;
}

/**
 * Ensures `unit.concepts` exists for older saved units so Stage 1 works seamlessly.
 * @param {object} unit
 */
function ensureUnitConceptsState(unit) {
  if (!Array.isArray(unit.concepts) || unit.concepts.length === 0) {
    const rules = Array.isArray(unit.goldenRules) && unit.goldenRules.length > 0
      ? unit.goldenRules
      : [unit.introText || unit.topic_summary || 'זיהוי הנתונים בשאלה ורישום מאוזן של חובה וזכות'];

    unit.concepts = rules.map((rText, idx) => ({
      id: `${unit.id}_c${idx + 1}`,
      index: idx + 1,
      term_name: `כלל מפתח ${idx + 1} בשיעור`,
      page_number: 1,
      simple_explanation: String(rText),
      textbook_example: (unit.questions && unit.questions[0] && (unit.questions[0].exact_book_text || unit.questions[0].original_question)) || String(rText),
      mfa_step1_question: 'איך ניישם את הכלל הזה בתרגול של היום?',
      mfa_step1_options: [
        'נבדוק את הנתונים בשאלה ונפעל בדיוק לפי הכלל צעד אחר צעד',
        'נדלג על בדיקת הנתונים'
      ],
      mfa_step1_correct_index: 0,
      mfa_step2_why_question: 'וידוא הבנה שני: למה חשוב לפעול לפי הכלל הזה?',
      mfa_step2_options: [
        'כדי להבטיח פתרון מדויק ומאוזן ב-100% ללא ניחושים',
        'כי אין חשיבות לדיוק בנתונים'
      ],
      mfa_step2_correct_index: 0,
      extraSimplerAnalogy: '',
      check1Passed: Boolean(unit.completed || unit.isCompleted),
      mastered: Boolean(unit.completed || unit.isCompleted)
    }));
  }

  if (typeof unit.currentConceptIdx !== 'number' || unit.currentConceptIdx < 0 || unit.currentConceptIdx >= unit.concepts.length) {
    unit.currentConceptIdx = 0;
  }

  const allConceptsMastered = unit.concepts.every(c => Boolean(c.mastered));
  if (!unit.activeStage) {
    unit.activeStage = allConceptsMastered ? 'stage2' : 'stage1';
  }
  if (!allConceptsMastered) {
    unit.activeStage = 'stage1';
  }
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
 * Displays `#view-unit`, hides `#unit-steps-wrapper`, and renders the 2-Stage Track 3 interface
 * inside `#unit-blocks-wrapper`:
 * - Stage 1: Lesson Promo + Concept & Textbook Example Mastery Gate with Gentle 2-Step MFA
 * - Stage 2: Grounded Textbook Questions & Real-Time Socratic Coach Chat
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

  ensureUnitConceptsState(unit);

  const concepts = Array.isArray(unit.concepts) ? unit.concepts : [];
  const questions = Array.isArray(unit.questions) ? unit.questions : [];
  const masteredConceptsCount = concepts.filter(c => Boolean(c.mastered)).length;
  const allConceptsMastered = concepts.length === 0 || masteredConceptsCount === concepts.length;

  if (typeof unit.currentQuestionIdx !== 'number' || unit.currentQuestionIdx < 0 || unit.currentQuestionIdx >= Math.max(1, questions.length)) {
    unit.currentQuestionIdx = 0;
  }
  const qIdx = unit.currentQuestionIdx;
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
  if (viewTitleEl) viewTitleEl.textContent = `📚 עזרה בלימודים • ${displayTitle}`;
  if (badgeEl) badgeEl.textContent = `📅 ${dateLabel}`;
  if (mainTitleEl) mainTitleEl.textContent = displayTitle;
  if (goalDescEl) goalDescEl.textContent = unit.pages_summary || unit.topic_summary || 'לימוד מונחה צעד אחר צעד מתוך עמודי השיעור שלך';

  const solvedQuestionsCount = Array.isArray(unit.solvedQuestions) ? unit.solvedQuestions.filter(Boolean).length : 0;
  const isStage1Active = unit.activeStage !== 'stage2' || !allConceptsMastered;
  const hasPageSnapshots = Array.isArray(unit.pageSnapshots) && unit.pageSnapshots.length > 0;

  // Build 2-Stage Journey Bar HTML
  const journeyBarHtml = `
    <nav class="study-journey-bar" aria-label="שלבי הלמידה ביחידה">
      <button
        type="button"
        id="btn-journey-stage1"
        class="study-journey-stage-tab ${isStage1Active ? 'active' : ''} ${allConceptsMastered ? 'completed' : ''}"
      >
        <span class="journey-stage-icon">${allConceptsMastered ? '✅' : '1️⃣'}</span>
        <div class="journey-stage-info">
          <strong>שלב 1: הכנה לשיעור ופיצוח המושגים (${masteredConceptsCount}/${concepts.length})</strong>
          <small>הסבר פשוט בגובה העיניים + דוגמה מהספר ווידוא הבנה</small>
        </div>
      </button>

      <button
        type="button"
        id="btn-journey-stage2"
        class="study-journey-stage-tab ${!isStage1Active ? 'active' : ''} ${!allConceptsMastered ? 'locked' : ''}"
        ${!allConceptsMastered ? 'aria-disabled="true"' : ''}
      >
        <span class="journey-stage-icon">${!allConceptsMastered ? '🔒' : (solvedQuestionsCount === questions.length && questions.length > 0 ? '🏆' : '2️⃣')}</span>
        <div class="journey-stage-info">
          <strong>שלב 2: פתרון השאלות והטבלאות מהספר (${solvedQuestionsCount}/${questions.length})</strong>
          <small>${!allConceptsMastered ? 'ייפתח מיד לאחר השלמת המושגים בשלב 1' : 'תרגול מודרך של כל השאלות מתוך דפי השיעור'}</small>
        </div>
      </button>
    </nav>
  `;

  if (isStage1Active) {
    // ========================================================================
    // STAGE 1: LESSON PROMO + CONCEPT & TEXTBOOK EXAMPLE MASTERY GATE (2-STEP MFA)
    // ========================================================================
    const cIdx = unit.currentConceptIdx;
    const activeConcept = concepts[cIdx] || concepts[0];
    const pageNum = Number(activeConcept?.page_number) || 1;
    const conceptCheck1Done = Boolean(activeConcept?.check1Passed || activeConcept?.mastered);
    const conceptMastered = Boolean(activeConcept?.mastered);

    blocksWrapper.innerHTML = `
      <div class="study-unit-player-container" dir="rtl">
        ${journeyBarHtml}

        <!-- באנר פרומו לשיעור של היום -->
        <section class="card study-lesson-promo-banner" aria-label="פרומו לשיעור">
          <div class="study-intro-card-header">
            <div class="study-intro-badges">
              <span class="study-today-date-badge">📅 ${dateLabel}</span>
              <span class="badge-tag" style="background:#dcfce7;color:#166534;font-weight:800;">🧭 שלב 1 מתוך 2: מבינים את החומר לפני שפותרים</span>
            </div>
            ${hasPageSnapshots ? `
              <button type="button" id="btn-open-all-pages-viewer" class="secondary-btn study-view-page-btn">
                <span>👁️ צפה בעמודי הקובץ (${unit.pageSnapshots.length} עמודים)</span>
              </button>
            ` : ''}
          </div>
          <h3 class="study-intro-unit-title">${displayTitle}</h3>
          <p class="study-intro-summary-text">${formatCoachChatHtml(unit.pages_summary || unit.topic_summary || '')}</p>
        </section>

        <!-- כרטיס פיצוח מושג פעיל + דוגמה מהספר + וידוא הבנה דו-שלבי (Gentle 2-Step MFA) -->
        <section class="card study-concept-mastery-card" aria-label="כרטיס מושג ודוגמה מהספר">
          <div class="study-q-progress-top">
            <div class="study-q-progress-headline">
              <span class="study-q-counter-badge">מושג ${cIdx + 1} מתוך ${concepts.length} בשיעור</span>
              <span class="study-q-solved-counter">${masteredConceptsCount} מתוך ${concepts.length} מושגים הובנו ב-100% ✅</span>
            </div>
            <div class="study-q-progress-bar-track">
              <div class="study-q-progress-bar-fill" style="width:${Math.round((masteredConceptsCount / Math.max(1, concepts.length)) * 100)}%;"></div>
            </div>
          </div>

          <!-- כפתורי ניווט בין מושגים -->
          <div class="study-q-nav-pills" role="tablist" aria-label="בחירת מושג בשיעור">
            ${concepts.map((cItem, idx) => {
              const isCurrent = idx === cIdx;
              const isDone = Boolean(cItem.mastered);
              return `
                <button
                  type="button"
                  class="study-q-nav-pill concept-nav-pill ${isCurrent ? 'active' : ''} ${isDone ? 'solved' : ''}"
                  data-concept-idx="${idx}"
                  role="tab"
                  aria-selected="${isCurrent ? 'true' : 'false'}"
                >
                  <span>${idx + 1}. ${cItem.term_name}</span>
                  <span>${isDone ? '✅' : (isCurrent ? '🔵' : '⚪')}</span>
                </button>
              `;
            }).join('')}
          </div>

          <!-- תוכן המושג הפעיל -->
          <div class="study-concept-detail-box">
            <div class="study-concept-top-bar">
              <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                <span class="study-active-q-tag">📄 מתוך עמוד ${pageNum} בקובץ השיעור</span>
                ${conceptMastered ? `<span class="badge-completed-card">✅ הבנתי את המושג ב-100%!</span>` : ''}
              </div>
              ${hasPageSnapshots ? `
                <button type="button" id="btn-view-concept-page" class="secondary-btn study-view-page-btn" data-page-num="${pageNum}">
                  <span>👁️ הצג את עמוד ${pageNum} מהקובץ</span>
                </button>
              ` : ''}
            </div>

            <h3 class="study-concept-term-title">💡 מושג ${cIdx + 1}: ${activeConcept.term_name}</h3>

            <div class="study-concept-columns">
              <!-- בלוק 1: מה זה אומר במילים הכי פשוטות? -->
              <div class="study-concept-explain-panel simple-panel">
                <div class="study-panel-badge">🌱 מה זה אומר במילים הכי פשוטות?</div>
                <p class="study-panel-body-text">${formatCoachChatHtml(activeConcept.simple_explanation)}</p>
                ${activeConcept.extraSimplerAnalogy ? `
                  <div class="study-extra-analogy-box">
                    <strong>✨ דוגמה פשוטה נוספת מחיי היומיום:</strong>
                    <p style="margin:0.3rem 0 0 0;">${formatCoachChatHtml(activeConcept.extraSimplerAnalogy)}</p>
                  </div>
                ` : ''}
              </div>

              <!-- בלוק 2: איך זה מופיע בדוגמה בספר שלנו? -->
              <div class="study-concept-explain-panel textbook-panel">
                <div class="study-panel-badge">📖 איך זה מופיע בדוגמה בספר שלנו? (עמוד ${pageNum})</div>
                <p class="study-panel-body-text">${formatCoachChatHtml(activeConcept.textbook_example)}</p>
              </div>
            </div>

            <!-- וידוא הבנה דו-שלבי עדין (Gentle 2-Step MFA) -->
            <div class="study-mfa-gate-container">
              <div class="study-mfa-header-row">
                <h4 class="study-mfa-gate-title">🎯 וידוא הבנה עדין ב-2 צעדים (כדי שנהיה בטוחים ב-100% שזה ברור!)</h4>
                <button type="button" id="btn-simpler-analogy" class="study-quick-assist-chip">
                  <span>🤔 תסביר לי בעוד דרך פשוטה יותר</span>
                </button>
              </div>

              <!-- צעד 1 של וידוא ההבנה -->
              <div class="study-mfa-step-box ${conceptCheck1Done ? 'step-passed' : ''}" id="concept-mfa-step1-box">
                <div class="study-mfa-step-badge">בדיקה 1 מתוך 2 — זיהוי הרעיון המרכזי</div>
                <p class="study-mfa-question-text">${formatCoachChatHtml(activeConcept.mfa_step1_question)}</p>
                <div class="study-mfa-options-list">
                  ${(activeConcept.mfa_step1_options || []).map((opt, oIdx) => {
                    const isCorrectOpt = oIdx === activeConcept.mfa_step1_correct_index;
                    return `
                      <button
                        type="button"
                        class="study-mfa-option-btn step1-opt-btn ${conceptCheck1Done && isCorrectOpt ? 'correct-selected' : ''}"
                        data-opt-idx="${oIdx}"
                      >
                        <span class="opt-letter">${idxToHebrewLetter(oIdx)}.</span>
                        <span>${opt}</span>
                      </button>
                    `;
                  }).join('')}
                </div>

                <!-- אפשרות להסביר במילים של דניאל במקום לבחור -->
                <div class="study-mfa-own-words-row">
                  <input
                    type="text"
                    id="concept-own-words-input"
                    class="styled-input study-own-words-input"
                    placeholder="או כתוב כאן במילים שלך איך הבנת את המושג..."
                  />
                  <button type="button" id="btn-check-own-words" class="secondary-btn">
                    <span>בדוק בניסוח שלי ✨</span>
                  </button>
                </div>
                <div id="concept-mfa-step1-feedback" class="study-mfa-feedback" style="display:${conceptCheck1Done ? 'block' : 'none'};">
                  ${conceptCheck1Done ? '✅ מעולה דניאל! עברת את בדיקה 1 בהצלחה. עכשיו בוא נאשר זאת בבדיקה הקצרה השנייה:' : ''}
                </div>
              </div>

              <!-- צעד 2 של וידוא ההבנה (נפתח לאחר צעד 1) -->
              <div
                class="study-mfa-step-box ${conceptMastered ? 'step-passed' : ''}"
                id="concept-mfa-step2-box"
                style="display:${conceptCheck1Done ? 'block' : 'none'};"
              >
                <div class="study-mfa-step-badge">בדיקה 2 מתוך 2 (וידוא הבנה סופי - בלי ניחושים!)</div>
                <p class="study-mfa-question-text">${formatCoachChatHtml(activeConcept.mfa_step2_why_question)}</p>
                <div class="study-mfa-options-list">
                  ${(activeConcept.mfa_step2_options || []).map((opt, oIdx) => {
                    const isCorrectOpt = oIdx === activeConcept.mfa_step2_correct_index;
                    return `
                      <button
                        type="button"
                        class="study-mfa-option-btn step2-opt-btn ${conceptMastered && isCorrectOpt ? 'correct-selected' : ''}"
                        data-opt-idx="${oIdx}"
                      >
                        <span class="opt-letter">${idxToHebrewLetter(oIdx)}.</span>
                        <span>${opt}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
                <div id="concept-mfa-step2-feedback" class="study-mfa-feedback" style="display:${conceptMastered ? 'block' : 'none'};">
                  ${conceptMastered ? '🌟 <strong>הבנתי את המושג ב-100%!</strong> כל הכבוד דניאל, פיצחת את המושג הזה עד הסוף.' : ''}
                </div>
              </div>

              <!-- פעולת המשך למושג הבא או פתיחת שלב 2 -->
              <div id="concept-mastered-actions-bar" class="study-question-solved-action-box" style="display:${conceptMastered ? 'flex' : 'none'}; margin-top:1rem;">
                ${allConceptsMastered ? `
                  <div class="study-solved-celebration-text">
                    🎉 <strong>אלוף דניאל! פיצחת ב-100% את כל המושגים והדוגמאות של השיעור!</strong>
                  </div>
                  <button type="button" id="btn-unlock-stage2-questions" class="primary-btn study-finish-all-btn">
                    <span>🔓 כל המושגים ברורים! בוא נעבור לפתרון השאלות מהספר ▶</span>
                  </button>
                ` : `
                  <div class="study-solved-celebration-text">
                    ✅ <strong>הבנתי את המושג ב-100%!</strong> מוכן לעבור למושג הבא בשיעור.
                  </div>
                  <button type="button" id="btn-next-concept-step" class="primary-btn study-next-question-btn">
                    <span>המשך למושג הבא (${cIdx + 2} מתוך ${concepts.length}) ▶</span>
                  </button>
                `}
              </div>
            </div>
          </div>
        </section>
      </div>
    `;

    // Bind Journey Bar Stage Tabs
    bindJourneyBarEvents(blocksWrapper, unit, allConceptsMastered);

    // Bind Page Viewer Buttons
    const openAllPagesBtn = blocksWrapper.querySelector('#btn-open-all-pages-viewer');
    if (openAllPagesBtn) {
      openAllPagesBtn.onclick = () => openLessonPageViewerModal(unit, pageNum);
    }
    const viewConceptPageBtn = blocksWrapper.querySelector('#btn-view-concept-page');
    if (viewConceptPageBtn) {
      viewConceptPageBtn.onclick = () => openLessonPageViewerModal(unit, pageNum);
    }

    // Bind Concept Nav Pills
    blocksWrapper.querySelectorAll('.concept-nav-pill').forEach(pill => {
      pill.onclick = () => {
        const targetIdx = Number(pill.getAttribute('data-concept-idx'));
        if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < concepts.length) {
          unit.currentConceptIdx = targetIdx;
          saveAppState();
          openStudyHelpUnit(unit.id);
        }
      };
    });

    // Bind "🤔 תסביר לי בעוד דרך פשוטה יותר" button
    const simplerBtn = blocksWrapper.querySelector('#btn-simpler-analogy');
    if (simplerBtn) {
      simplerBtn.onclick = async () => {
        simplerBtn.disabled = true;
        simplerBtn.innerHTML = '<span>⏳ מכין הסבר עוד יותר פשוט...</span>';
        try {
          const prompt = `הסבר לדניאל (בן 28) את המושג "${activeConcept.term_name}" (מתוך השיעור "${displayTitle}") בדרך פשוטה עוד יותר, עם דוגמה מוחשית מחיי היומיום (כמו קניות בסופר, ארנק או חשבון בנק אישי) ב-2 משפטים קצרים וברורים.
הסבר נוכחי: ${activeConcept.simple_explanation}
דוגמה מהספר: ${activeConcept.textbook_example}`;
          const reply = await callMultiTierAI(prompt, { maxTokens: 1024 });
          activeConcept.extraSimplerAnalogy = String(reply || '').trim();
        } catch (e) {
          activeConcept.extraSimplerAnalogy = `תחשוב על "${activeConcept.term_name}" כמו בדיקה פשוטה ביומיום: קודם מסתכלים מה קיבלנו ומה נתנו, ורושמים כל צד במקום הקבוע שלו כדי שלא נתבלבל.`;
        }
        saveAppState();
        openStudyHelpUnit(unit.id);
      };
    }

    // Bind Check 1 Multiple-Choice Options
    const step1Feedback = blocksWrapper.querySelector('#concept-mfa-step1-feedback');
    const step2Box = blocksWrapper.querySelector('#concept-mfa-step2-box');

    blocksWrapper.querySelectorAll('.step1-opt-btn').forEach(btn => {
      btn.onclick = () => {
        const chosenIdx = Number(btn.getAttribute('data-opt-idx'));
        if (chosenIdx === activeConcept.mfa_step1_correct_index) {
          activeConcept.check1Passed = true;
          saveAppState();
          blocksWrapper.querySelectorAll('.step1-opt-btn').forEach(b => b.classList.remove('correct-selected', 'wrong-selected'));
          btn.classList.add('correct-selected');
          if (step1Feedback) {
            step1Feedback.style.display = 'block';
            step1Feedback.className = 'study-mfa-feedback success';
            step1Feedback.innerHTML = '✅ מעולה דניאל! תשובה נכונה. עכשיו בוא נאשר זאת בבדיקה הקצרה השנייה למטה:';
          }
          if (step2Box) {
            step2Box.style.display = 'block';
            if (typeof step2Box.scrollIntoView === 'function') {
              step2Box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        } else {
          btn.classList.add('wrong-selected');
          if (step1Feedback) {
            step1Feedback.style.display = 'block';
            step1Feedback.className = 'study-mfa-feedback warning';
            step1Feedback.innerHTML = '💡 כמעט! קרא שוב את ההסבר הפשוט למעלה ("מה זה אומר במילים הכי פשוטות?") ונסה לבחור את המשפט שמתאר אותו.';
          }
        }
      };
    });

    // Bind Check 1 Own-Words Input
    const ownWordsInput = blocksWrapper.querySelector('#concept-own-words-input');
    const checkOwnWordsBtn = blocksWrapper.querySelector('#btn-check-own-words');
    if (checkOwnWordsBtn && ownWordsInput) {
      checkOwnWordsBtn.onclick = async () => {
        const userWords = ownWordsInput.value.trim();
        if (userWords.length < 3) {
          if (typeof showToast === 'function') {
            showToast('כתוב משפט קצר במילים שלך ונבדוק יחד 💡', 'warning');
          }
          return;
        }
        checkOwnWordsBtn.disabled = true;
        checkOwnWordsBtn.innerHTML = '<span>בודק...</span>';
        let passed = true;
        let feedbackMsg = '✅ ניסוח נהדר דניאל! הבנת את הכיוון. עכשיו השלם את בדיקה 2 למטה:';
        try {
          const evalPrompt = `דניאל לומד את המושג "${activeConcept.term_name}" (${activeConcept.simple_explanation}).
הוא הסביר אותו במילים שלו כך: "${userWords}".
החזר JSON בלבד: { "passed": true/false, "feedback": "משוב קצר וחם בעברית" }`;
          const raw = await callMultiTierAI(evalPrompt, { jsonMode: true, maxTokens: 512 });
          const parsed = typeof AIService !== 'undefined' && AIService.cleanAndParseJSON ? AIService.cleanAndParseJSON(raw) : JSON.parse(raw);
          if (parsed && typeof parsed.passed === 'boolean') {
            passed = parsed.passed;
            feedbackMsg = parsed.feedback || feedbackMsg;
          }
        } catch (err) {
          passed = true;
        }
        checkOwnWordsBtn.disabled = false;
        checkOwnWordsBtn.innerHTML = '<span>בדוק בניסוח שלי ✨</span>';

        if (passed) {
          activeConcept.check1Passed = true;
          saveAppState();
          if (step1Feedback) {
            step1Feedback.style.display = 'block';
            step1Feedback.className = 'study-mfa-feedback success';
            step1Feedback.innerHTML = `✅ ${formatCoachChatHtml(feedbackMsg)}`;
          }
          if (step2Box) {
            step2Box.style.display = 'block';
          }
        } else if (step1Feedback) {
          step1Feedback.style.display = 'block';
          step1Feedback.className = 'study-mfa-feedback warning';
          step1Feedback.innerHTML = `💡 ${formatCoachChatHtml(feedbackMsg)}`;
        }
      };
    }

    // Bind Check 2 (Gentle MFA Confirmation)
    const step2Feedback = blocksWrapper.querySelector('#concept-mfa-step2-feedback');
    blocksWrapper.querySelectorAll('.step2-opt-btn').forEach(btn => {
      btn.onclick = () => {
        const chosenIdx = Number(btn.getAttribute('data-opt-idx'));
        if (chosenIdx === activeConcept.mfa_step2_correct_index) {
          activeConcept.check1Passed = true;
          activeConcept.mastered = true;
          saveAppState();
          if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
            SoundService.playSuccessSound();
          }
          openStudyHelpUnit(unit.id);
        } else {
          btn.classList.add('wrong-selected');
          if (step2Feedback) {
            step2Feedback.style.display = 'block';
            step2Feedback.className = 'study-mfa-feedback warning';
            step2Feedback.innerHTML = '💡 שים לב לדוגמה מהספר למעלה ובחר את הנימוק שמסביר למה זה נכון.';
          }
        }
      };
    });

    // Bind Next Concept / Unlock Stage 2 Buttons
    const nextConceptBtn = blocksWrapper.querySelector('#btn-next-concept-step');
    if (nextConceptBtn) {
      nextConceptBtn.onclick = () => {
        const nextUnmastered = concepts.findIndex((c, i) => i > cIdx && !c.mastered);
        const anyUnmastered = concepts.findIndex(c => !c.mastered);
        unit.currentConceptIdx = nextUnmastered >= 0
          ? nextUnmastered
          : (anyUnmastered >= 0 ? anyUnmastered : Math.min(cIdx + 1, concepts.length - 1));
        saveAppState();
        openStudyHelpUnit(unit.id);
      };
    }

    const unlockStage2Btn = blocksWrapper.querySelector('#btn-unlock-stage2-questions');
    if (unlockStage2Btn) {
      unlockStage2Btn.onclick = () => {
        unit.activeStage = 'stage2';
        saveAppState();
        if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
          SoundService.playSuccessSound();
        }
        openStudyHelpUnit(unit.id);
      };
    }

    return;
  }

  // ==========================================================================
  // STAGE 2: GROUNDED TEXTBOOK QUESTIONS & REAL-TIME SOCRATIC COACH CHAT
  // ==========================================================================
  const currentQ = questions[qIdx] || {
    exact_book_text: 'שאלה לתרגול',
    original_question: 'שאלה לתרגול',
    friendly_translation: 'הנהלת חשבונות',
    page_number: 1
  };
  const solvedCount = unit.solvedQuestions.filter(Boolean).length;
  const totalQ = Math.max(1, questions.length);
  const progressPct = Math.round((solvedCount / totalQ) * 100);
  const isCurrentSolved = Boolean(unit.solvedQuestions[qIdx]);
  const allSolved = questions.length > 0 && solvedCount === questions.length;
  const activeMessages = unit.chatHistory[qIdx] || [];
  const qPageNumber = Number(currentQ.page_number) || 1;

  blocksWrapper.innerHTML = `
    <div class="study-unit-player-container" dir="rtl">
      ${journeyBarHtml}

      <!-- סרגל התקדמות שאלות וכרטיס השאלה הפעילה מהספר -->
      <section class="card study-question-progress-card" aria-label="התקדמות בשאלות התרגול">
        <div class="study-q-progress-top">
          <div class="study-q-progress-headline">
            <span class="study-q-counter-badge">שאלה ${qIdx + 1} מתוך ${questions.length} בדף התרגול של היום</span>
            <span class="study-q-solved-counter">${solvedCount} מתוך ${questions.length} נפתרו ✅</span>
          </div>
          <div class="study-q-progress-bar-track">
            <div class="study-q-progress-bar-fill" style="width:${progressPct}%;"></div>
          </div>
        </div>

        <!-- כפתורי ניווט בין שאלות -->
        <div class="study-q-nav-pills" role="tablist" aria-label="בחירת שאלה בדף">
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

        <!-- באנר השאלה הפעילה בקונטרסט גבוה (הטקסט המדויק מהספר + תרגום מונגש) -->
        <div class="study-active-question-banner">
          <div class="study-active-q-meta" style="justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
              <span class="study-active-q-tag">📌 ${currentQ.question_number_label || `שאלה ${qIdx + 1}`} (עמוד ${qPageNumber})</span>
              ${isCurrentSolved ? `<span class="badge-completed-card">שאלה זו נפתרה בהצלחה ✅</span>` : ''}
            </div>
            ${hasPageSnapshots ? `
              <button type="button" id="btn-view-question-page" class="secondary-btn study-view-page-btn" data-page-num="${qPageNumber}">
                <span>👁️ הצג את עמוד ${qPageNumber} מהקובץ</span>
              </button>
            ` : ''}
          </div>
          <div class="study-active-q-text">
            ${formatCoachChatHtml(currentQ.exact_book_text || currentQ.original_question || currentQ.questionText || '')}
          </div>
          ${currentQ.friendly_translation ? `
            <div class="study-friendly-translation-box">
              <strong>🧭 במילים פשוטות (מה מבקשים מאיתנו כאן?):</strong>
              <p style="margin:0.25rem 0 0 0;">${formatCoachChatHtml(currentQ.friendly_translation)}</p>
            </div>
          ` : ''}
        </div>
      </section>

      <!-- צ'אט ליווי אישי בזמן אמת (Socratic Coach Chat) -->
      <section class="card study-socratic-coach-card" aria-label="צ'אט ליווי אישי בזמן אמת">
        <div class="study-coach-header">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span class="study-coach-avatar" aria-hidden="true">🤖</span>
            <div>
              <h3 class="study-coach-title">צ'אט ליווי אישי בזמן אמת — ${currentQ.question_number_label || `שאלה ${qIdx + 1}`}</h3>
              <p class="study-coach-subtitle">פתור יחד עם המאמן צעד אחר צעד. תמיד אפשר להיעזר בכפתורי ההכוונה המהירים למטה!</p>
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

        <!-- כפתור מעבר לשאלה הבאה או סיום חגיגי של כל היחידה -->
        <div id="study-question-solved-banner" class="study-question-solved-action-box" style="display:${isCurrentSolved ? 'flex' : 'none'};">
          ${allSolved ? `
            <div class="study-solved-celebration-text">
              🎉 <strong>מדהים דניאל! פתרת את כל ${questions.length} השאלות בדף התרגול של היום!</strong>
            </div>
            <button type="button" id="btn-finish-daily-unit-exam" class="primary-btn study-finish-all-btn">
              <span>🎉 סיימתי את כל יחידת הלימוד של היום! צור לי מבחן מסכם</span>
            </button>
          ` : `
            <div class="study-solved-celebration-text">
              ✅ <strong>כל הכבוד דניאל! השלמת את שאלה ${qIdx + 1} בהצלחה.</strong>
            </div>
            <button type="button" id="btn-next-study-question" class="primary-btn study-next-question-btn">
              <span>המשך לשאלה הבאה בדף ▶</span>
            </button>
          `}
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
            placeholder="כתוב כאן את התשובה שלך לשאלה ${qIdx + 1}, או שאל את המאמן כל דבר..."
          ></textarea>
          <button type="button" id="btn-send-study-chat" class="primary-btn study-chat-send-btn">
            <span>שלח תשובה 🚀</span>
          </button>
        </div>
      </section>

    </div>
  `;

  bindJourneyBarEvents(blocksWrapper, unit, allConceptsMastered);

  const viewQPageBtn = blocksWrapper.querySelector('#btn-view-question-page');
  if (viewQPageBtn) {
    viewQPageBtn.onclick = () => openLessonPageViewerModal(unit, qPageNumber);
  }

  // Scroll chat box to bottom
  const messagesBox = blocksWrapper.querySelector('#study-help-chat-messages');
  const scrollToChatBottom = () => {
    if (messagesBox) {
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
  };
  scrollToChatBottom();

  // Bind question navigation pills
  const navPills = blocksWrapper.querySelectorAll('.study-q-nav-pill[data-q-idx]');
  navPills.forEach(pill => {
    pill.onclick = () => {
      const targetIdx = Number(pill.getAttribute('data-q-idx'));
      if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < questions.length) {
        unit.currentQuestionIdx = targetIdx;
        saveAppState();
        openStudyHelpUnit(unit.id);
      }
    };
  });

  // Helper to bind Next Question / Finish Unit buttons inside #study-question-solved-banner
  const bindSolvedBannerButtons = () => {
    const nextBtn = blocksWrapper.querySelector('#btn-next-study-question');
    if (nextBtn) {
      nextBtn.onclick = () => {
        let nextIdx = qIdx + 1;
        if (nextIdx >= questions.length) {
          const firstUnsolved = unit.solvedQuestions.findIndex(s => !s);
          nextIdx = firstUnsolved >= 0 ? firstUnsolved : 0;
        }
        unit.currentQuestionIdx = nextIdx;
        saveAppState();
        openStudyHelpUnit(unit.id);
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

  // Handler for sending either a chat message or a quick-assist chip action
  let isWaitingForCoach = false;
  const chatInput = blocksWrapper.querySelector('#study-help-chat-input');
  const sendBtn = blocksWrapper.querySelector('#btn-send-study-chat');
  const typingIndicator = blocksWrapper.querySelector('#study-help-typing-indicator');
  const solvedBanner = blocksWrapper.querySelector('#study-question-solved-banner');

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
      unit.solvedQuestions[qIdx] = true;
      if (unit.questions[qIdx]) {
        unit.questions[qIdx].isCompleted = true;
      }
      const updatedSolvedCount = unit.solvedQuestions.filter(Boolean).length;
      const nowAllSolved = questions.length > 0 && updatedSolvedCount === questions.length;
      if (nowAllSolved) {
        unit.completed = true;
        unit.isCompleted = true;
      }
      saveAppState();

      if (typeof SoundService !== 'undefined' && typeof SoundService.playSuccessSound === 'function') {
        SoundService.playSuccessSound();
      }

      const activePill = blocksWrapper.querySelector(`.study-q-nav-pill[data-q-idx="${qIdx}"]`);
      if (activePill) {
        activePill.classList.add('solved');
        activePill.innerHTML = `<span>${currentQ.question_number_label || `שאלה ${qIdx + 1}`}</span><span>✅</span>`;
      }
      const solvedCounterEl = blocksWrapper.querySelector('.study-q-solved-counter');
      if (solvedCounterEl) {
        solvedCounterEl.textContent = `${updatedSolvedCount} מתוך ${questions.length} נפתרו ✅`;
      }
      const progressFillEl = blocksWrapper.querySelector('.study-q-progress-bar-fill');
      if (progressFillEl) {
        progressFillEl.style.width = `${Math.round((updatedSolvedCount / totalQ) * 100)}%`;
      }

      if (solvedBanner) {
        solvedBanner.style.display = 'flex';
        solvedBanner.innerHTML = nowAllSolved ? `
          <div class="study-solved-celebration-text">
            🎉 <strong>מדהים דניאל! פתרת את כל ${questions.length} השאלות בדף התרגול של היום!</strong>
          </div>
          <button type="button" id="btn-finish-daily-unit-exam" class="primary-btn study-finish-all-btn">
            <span>🎉 סיימתי את כל יחידת הלימוד של היום! צור לי מבחן מסכם</span>
          </button>
        ` : `
          <div class="study-solved-celebration-text">
            ✅ <strong>כל הכבוד דניאל! השלמת את שאלה ${qIdx + 1} בהצלחה.</strong>
          </div>
          <button type="button" id="btn-next-study-question" class="primary-btn study-next-question-btn">
            <span>המשך לשאלה הבאה בדף ▶</span>
          </button>
        `;
        bindSolvedBannerButtons();
      }
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

  const quickChips = blocksWrapper.querySelectorAll('.study-quick-assist-chip');
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
  const stage1Btn = blocksWrapper.querySelector('#btn-journey-stage1');
  const stage2Btn = blocksWrapper.querySelector('#btn-journey-stage2');

  if (stage1Btn) {
    stage1Btn.onclick = () => {
      unit.activeStage = 'stage1';
      saveAppState();
      openStudyHelpUnit(unit.id);
    };
  }

  if (stage2Btn) {
    stage2Btn.onclick = () => {
      if (!allConceptsMastered) {
        if (typeof showToast === 'function') {
          showToast('נשלים קודם את פיצוח המושגים בשלב 1 כדי שפתרון השאלות יהיה קל וברור ב-100%! 🌱', 'warning');
        }
        return;
      }
      unit.activeStage = 'stage2';
      saveAppState();
      openStudyHelpUnit(unit.id);
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
                <div class="day-action-box">
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
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openStudyHelpUnit(uid);
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
  const practicedQuestionsSummary = (unit.questions || [])
    .map((q, idx) => `שאלה ${idx + 1}: ${q.exact_book_text || q.original_question || q.questionText || ''} (פתרון: ${q.expected_answer_summary || ''})`)
    .join('\n');

  const systemInstruction = `אתה מומחה לפיתוח מבחנים מעשיים בהנהלת חשבונות עבור דניאל.
עליך לייצר יחידת מבחן מסכם מעשית בפורמט Dynamic Block Engine (JSON תקני בלבד בעברית, ללא טקסט חופשי מחוץ ל-JSON).`;

  const prompt = `דניאל סיים בהצלחה את יחידת התרגול היומית: "${unit.lesson_title || unit.title}".
סיכום הנושא: ${unit.pages_summary || unit.topic_summary || unit.introText || ''}
המושגים שנלמדו: ${(unit.concepts || []).map(c => `${c.term_name}: ${c.simple_explanation}`).join(' | ')}
השאלות שדניאל פתר היום:
${practicedQuestionsSummary}

צור מבחן מסכם מעשי חדש הבוחן בדיוק את אותם עקרונות חשבונאיים עם **מספרים חדשים, תרחישים עסקיים חדשים ושאלות הבנה חדשות**.
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

if (typeof window !== 'undefined') {
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
