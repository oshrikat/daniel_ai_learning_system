/**
 * Track 3 Controller: Study Help & Daily Homework Practice (עזרה בלימודים - תרגול יומי)
 * Provides:
 * 1. Dual Upload Hub (CamScanner PDF / Images + Direct Text Paste)
 * 2. Calming Async Loading Overlay
 * 3. AI Unit Structuring via Gemini Vision (`generateDailyStudyUnitFromMaterial`)
 * 4. Chronological Daily Study Unit Cards (`renderStudyHelpRoadmap`)
 * 5. Interactive Daily Study Unit View (`openStudyHelpUnit`):
 *    - Part 1: Warm Topic Introduction & 3 Golden Rules + TTS Read-Aloud
 *    - Part 2: Question Progress Bar, Navigation Pills & Active Question Banner
 *    - Part 3: Real-Time Socratic Coach Chat with 3 Quick-Assist Buttons & Completion Flow
 */

let _loadingStepTimer = null;

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
        <h3 class="study-calming-title">המאמן האישי מכין לך את יחידת הלימוד של היום...</h3>
        <p id="study-help-loading-status" class="study-calming-step-label">${statusText}</p>
        <div class="study-calming-steps-list">
          <div class="study-calming-step-pill" data-step="1">1. קורא את הדפים שהעלית...</div>
          <div class="study-calming-step-pill" data-step="2">2. מזהה את השאלות ובונה הקדמה וכללי זהב...</div>
          <div class="study-calming-step-pill" data-step="3">3. מכין את צ'אט המאמן האישי שלך...</div>
        </div>
        <p class="study-calming-subtitle">
          קח נשימה רגועה, דניאל 💙 עוד כמה שניות הכל יהיה מסודר וברור צעד אחר צעד.
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
        (stepNum === '1' && text.includes('קורא')) ||
        (stepNum === '2' && text.includes('מזהה')) ||
        (stepNum === '3' && text.includes('מכין'));
      pill.classList.toggle('active', isMatch);
    });
  };

  updateActiveStepPill(statusText);

  if (_loadingStepTimer) {
    clearInterval(_loadingStepTimer);
    _loadingStepTimer = null;
  }

  const progressMessages = [
    'קורא את הדפים שהעלית...',
    'מזהה את השאלות ובונה הקדמה וכללי זהב...',
    'מכין את צ\'אט המאמן האישי שלך...'
  ];
  let stepIdx = progressMessages.findIndex(m => statusText.includes(m.slice(0, 8)));
  if (stepIdx < 0) stepIdx = 0;

  _loadingStepTimer = setInterval(() => {
    if (stepIdx < progressMessages.length - 1) {
      stepIdx += 1;
      updateActiveStepPill(progressMessages[stepIdx]);
    }
  }, 2600);
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
 * Smart deterministic fallback generator if offline or if JSON parsing needs recovery.
 * Guarantees unit creation succeeds 100% of the time.
 * @param {object} params
 * @returns {object}
 */
function buildDeterministicStudyUnitFallback({ extractedText = '', sourceLabel = '' } = {}) {
  const cleanText = String(extractedText || '').trim();
  const dateStr = getTodayHebrewDateLabel();
  const defaultTitle = sourceLabel
    ? `תרגול יומי: ${sourceLabel}`
    : `יחידת תרגול בהנהלת חשבונות (${dateStr})`;

  let questionCandidates = [];
  if (cleanText) {
    const numberedBlocks = cleanText
      .split(/(?=(?:^|\n)\s*(?:שאלה\s*\d+|תרגיל\s*\d+|\d+[\.\)\-]\s+))/g)
      .map(s => s.trim())
      .filter(s => s.length >= 10);

    if (numberedBlocks.length >= 2) {
      questionCandidates = numberedBlocks;
    } else {
      const paragraphBlocks = cleanText
        .split(/\n{2,}/)
        .map(s => s.trim())
        .filter(s => s.length >= 12);
      questionCandidates = paragraphBlocks.length > 0 ? paragraphBlocks : [cleanText];
    }
  }

  if (questionCandidates.length === 0) {
    questionCandidates = [
      'עסק רכש סחורה בסך 5,000 ש"ח + מע"מ (18%) ושילם בהעברה בנקאית. רשום את פקודת היומן המתאימה וציין איזה חשבון בחובה ואיזה בזכות.',
      'העסק מכר סחורה ללקוח בסך 3,000 ש"ח + מע"מ (18%) באשראי. מהי פקודת היומן ומהו הסכום הכולל שיירשם לחובת הלקוח?'
    ];
  }

  const questions = questionCandidates.slice(0, 8).map((qText, idx) => ({
    id: `q${idx + 1}`,
    original_question: qText,
    topic_focus: 'זיהוי חשבונות חובה וזכות וחישוב הסכומים בפקודת היומן',
    step_by_step_guide: [
      'שלב 1: סמן את הסכומים המופיעים בשאלה ובדוק האם יש להוסיף או לחלץ מע"מ.',
      'שלב 2: זהה איזה חשבון מקבל ערך (חובה) ואיזה חשבון נותן ערך או מהווה מקור (זכות).',
      'שלב 3: ודא שסך צד החובה שווה בדיוק לסך צד הזכות.'
    ],
    hint: 'שאל את עצמך קודם כל: מה נכנס לעסק ומה יצא ממנו בעסקה הזו?',
    expected_answer_summary: 'זיהוי מדויק של חשבונות החובה והזכות ואיזון מלא של הסכומים כולל מע"מ.'
  }));

  return {
    title: defaultTitle,
    topic_summary:
      'ביחידת התרגול של היום נעבור יחד, צעד אחר צעד ובנחת, על השאלות מתוך חומר הלימוד שהעלית. נקרא כל שאלה, נזהה את הנתונים החשובים ונפתור אותה יחד עם המאמן האישי.',
    golden_rules: [
      'קוראים כל שאלה בנחת ומסמנים קודם כל את הסכומים, התאריכים ואמצעי התשלום.',
      'זוכרים את כלל הזהב: מה שנכנס לעסק או מהווה הוצאה נרשם בחובה, ומה שיוצא או מהווה הכנסה/מקור נרשם בזכות.',
      'בכל פקודת יומן בודקים תמיד שסך החובה שווה בדיוק לסך הזכות.'
    ],
    questions
  };
}

/**
 * Calls `callMultiTierAI` (with `jsonMode: true` and `inlineImages`) instructing Gemini 3.6 Flash
 * to analyze the accounting practice material and return a structured JSON object, then saves
 * the newly created unit at the bottom of `appState.studyHelpUnits`.
 * @param {object} params
 * @returns {Promise<object>}
 */
async function generateDailyStudyUnitFromMaterial({ extractedText = '', inlineImages = [], sourceLabel = '' } = {}) {
  const hasImages = Array.isArray(inlineImages) && inlineImages.length > 0;
  const cleanText = String(extractedText || '').trim();

  showStudyHelpLoadingOverlay(
    hasImages ? 'קורא את הדפים שהעלית...' : 'מזהה את השאלות ובונה הקדמה וכללי זהב...'
  );

  const systemInstruction = `אתה מאמן הוראה מתקנת סבלני, חם ומקצועי להנהלת חשבונות עבור דניאל (בחור בן 28).
תפקידך לנתח דפי תרגול מהספר (מתוך תמונות סרוקות ו/או טקסט) ולהחזיר אובייקט JSON תקני בלבד (ללא טקסט עוטף וללא בלוקים של קוד) בעברית תקנית וברורה.`;

  const prompt = `נתח את חומר התרגול הבא בהנהלת חשבונות ובנה ממנו יחידת לימוד יומית מודרכת עבור דניאל.
${sourceLabel ? `מקור החומר: ${sourceLabel}` : ''}
${cleanText ? `\nטקסט שחולץ מהחומר:\n"""\n${cleanText}\n"""\n` : '\nקרא וחלץ בקפידה את כל השאלות והנתונים מתוך התמונות המצורפות לפי סדר הופעתם.\n'}

החזר אך ורק אובייקט JSON תקני במבנה המדויק הבא:
{
  "title": "כותרת ברורה ומזמינה לנושא התרגול של היום",
  "topic_summary": "הקדמה חמה וברורה בגובה העיניים על החומר של היום (3-4 משפטים)",
  "golden_rules": [
    "כלל אצבע 1 קצר וברור לפתרון",
    "כלל אצבע 2 קצר וברור לפתרון",
    "כלל אצבע 3 קצר וברור לפתרון"
  ],
  "questions": [
    {
      "id": "q1",
      "original_question": "הטקסט המלא והמדויק של השאלה מתוך הדף (כולל כל הסכומים והנתונים)",
      "topic_focus": "מה השאלה בודקת",
      "step_by_step_guide": [
        "שלב 1 לפתרון",
        "שלב 2 לפתרון"
      ],
      "hint": "רמז עדין ומכוון לדניאל",
      "expected_answer_summary": "הפתרון המלא והמדויק (חובה/זכות/חישוב) לצורך בדיקת המאמן"
    }
  ]
}`;

  let parsedUnit = null;
  try {
    const rawResponse = await callMultiTierAI(prompt, {
      systemInstruction,
      jsonMode: true,
      inlineImages: hasImages ? inlineImages : []
    });

    if (typeof AIService !== 'undefined' && typeof AIService.cleanAndParseJSON === 'function') {
      parsedUnit = AIService.cleanAndParseJSON(rawResponse);
    } else {
      const jsonMatch = String(rawResponse || '').match(/\{[\s\S]*\}/);
      parsedUnit = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);
    }
  } catch (err) {
    console.warn('[StudyHelp] AI parsing failed or offline, using deterministic recovery:', err);
  }

  if (
    !parsedUnit ||
    typeof parsedUnit !== 'object' ||
    !Array.isArray(parsedUnit.questions) ||
    parsedUnit.questions.length === 0
  ) {
    parsedUnit = buildDeterministicStudyUnitFallback({ extractedText: cleanText, sourceLabel });
  }

  const unitId = `sh_unit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const dateLabel = getTodayHebrewDateLabel();

  const normalizedQuestions = parsedUnit.questions.map((q, idx) => {
    const qText = String(q.original_question || q.questionText || q.question || `שאלה ${idx + 1}`).trim();
    const stepGuide = Array.isArray(q.step_by_step_guide) && q.step_by_step_guide.length > 0
      ? q.step_by_step_guide.map(s => String(s).trim()).filter(Boolean)
      : ['שלב 1: זיהוי הנתונים והסכומים בשאלה', 'שלב 2: קביעת חשבונות חובה וזכות ואיזון הפקודה'];
    return {
      id: q.id || `${unitId}_q${idx + 1}`,
      index: idx + 1,
      original_question: qText,
      questionText: qText,
      topic_focus: String(q.topic_focus || q.topic || 'תרגול הנהלת חשבונות').trim(),
      topic: String(q.topic_focus || q.topic || 'תרגול הנהלת חשבונות').trim(),
      step_by_step_guide: stepGuide,
      hint: String(q.hint || 'פרק את השאלה לשלבים: מה נכנס (חובה) ומה יצא (זכות)?').trim(),
      expected_answer_summary: String(q.expected_answer_summary || q.coreConcept || 'פתרון מאוזן של חובה וזכות').trim(),
      coreConcept: String(q.expected_answer_summary || q.coreConcept || 'פתרון מאוזן של חובה וזכות').trim(),
      isCompleted: false,
      chatHistory: []
    };
  });

  const goldenRules = Array.isArray(parsedUnit.golden_rules) && parsedUnit.golden_rules.length > 0
    ? parsedUnit.golden_rules.map(r => String(r).trim()).filter(Boolean)
    : [
        'קוראים כל שאלה בנחת ומסמנים קודם כל את הסכומים והנתונים.',
        'שואלים: מה נכנס לעסק (חובה) ומה יצא או נוצר כמקור (זכות)?',
        'פותרים שלב אחר שלב ובודקים שסך החובה שווה לסך הזכות.'
      ];

  const introText = String(
    parsedUnit.topic_summary ||
    parsedUnit.introText ||
    'ביחידה זו נתרגל יחד צעד אחר צעד את השאלות מתוך דף התרגול של היום.'
  ).trim();

  const newUnit = {
    id: unitId,
    createdAt: new Date().toISOString(),
    createdAtLabel: dateLabel,
    dateLabel,
    title: String(parsedUnit.title || sourceLabel || `יחידת תרגול יומית (${dateLabel})`).trim(),
    introText,
    topic_summary: introText,
    goldenRules,
    golden_rules: goldenRules,
    introAndRules: [introText, ...goldenRules],
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
    showToast('יחידת הלימוד של היום מוכנה! גלול למטה לכרטיס החדש 🌟', 'success');
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

  // Migrate any legacy flat messages or per-question chatHistory
  if (!Array.isArray(unit.chatHistory[qIdx])) {
    const qObj = questions[qIdx];
    unit.chatHistory[qIdx] = (qObj && Array.isArray(qObj.chatHistory)) ? [...qObj.chatHistory] : [];
  }

  // Seed initial Socratic greeting if empty
  if (unit.chatHistory[qIdx].length === 0 && questions[qIdx]) {
    const qObj = questions[qIdx];
    const qText = qObj.original_question || qObj.questionText || '';
    const openingText =
      `שלום דניאל! 👋 אנחנו בשאלה ${qIdx + 1} מתוך ${questions.length}:\n` +
      `"**${qText}**"\n\n` +
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
  const questionText = qObj.original_question || qObj.questionText || '';
  const expectedAnswer = qObj.expected_answer_summary || qObj.coreConcept || '';
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
מוקד השאלה: ${qObj.topic_focus || ''}
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

  // Deterministic offline fallback
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
      coach_reply: `בוא נסביר את זה הכי פשוט שיש 📖:\nתחשוב על העסק כמו קופה שמנהלת שני צדדים מאוזנים: כל מה שנכנס לעסק או מהווה הוצאה נרשם בצד **חובה**, וכל מה שיוצא מהעסק או מהווה הכנסה נרשם בצד **זכות**.\n\nלפי הכלל הזה, מה נכנס לעסק בשאלה שלנו ומה יצא?`
    };
  }

  const cleanUser = String(userText || '').trim();
  const hasAccountingTerms = /(חובה|זכות|מע"מ|מעמ|בנק|קופה|לקוח|ספק|קניות|מכירות|הוצאות|הכנסות|\d{2,})/.test(cleanUser);
  if (hasAccountingTerms && cleanUser.length >= 8) {
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
 * Displays `#view-unit`, hides `#unit-steps-wrapper`, and renders the Track 3 interface
 * inside `#unit-blocks-wrapper`.
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

  const questions = Array.isArray(unit.questions) ? unit.questions : [];
  if (typeof unit.currentQuestionIdx !== 'number' || unit.currentQuestionIdx < 0 || unit.currentQuestionIdx >= questions.length) {
    unit.currentQuestionIdx = 0;
  }
  const qIdx = unit.currentQuestionIdx;
  ensureUnitQuestionChatState(unit, qIdx);
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
  if (viewTitleEl) viewTitleEl.textContent = `📚 עזרה בלימודים • ${unit.title}`;
  if (badgeEl) badgeEl.textContent = `📅 ${dateLabel}`;
  if (mainTitleEl) mainTitleEl.textContent = unit.title;
  if (goalDescEl) goalDescEl.textContent = 'לימוד מונחה צעד אחר צעד עם המאמן האישי שלך';

  const goldenRules = Array.isArray(unit.goldenRules) && unit.goldenRules.length > 0
    ? unit.goldenRules
    : (Array.isArray(unit.golden_rules) && unit.golden_rules.length > 0
      ? unit.golden_rules
      : [
          'קוראים כל שאלה בנחת ומסמנים קודם כל את הסכומים והנתונים.',
          'שואלים: מה נכנס לעסק (חובה) ומה יצא או נוצר כמקור (זכות)?',
          'פותרים שלב אחר שלב ובודקים שסך החובה שווה לסך הזכות.'
        ]);

  const topicSummary = unit.topic_summary || unit.introText || 'נעבור יחד בנחת על שאלות התרגול של היום ונפתור אותן שלב אחר שלב.';
  const currentQ = questions[qIdx] || { original_question: 'שאלה לתרגול', topic_focus: 'הנהלת חשבונות' };
  const solvedCount = unit.solvedQuestions.filter(Boolean).length;
  const totalQ = Math.max(1, questions.length);
  const progressPct = Math.round((solvedCount / totalQ) * 100);
  const isCurrentSolved = Boolean(unit.solvedQuestions[qIdx]);
  const allSolved = questions.length > 0 && solvedCount === questions.length;
  const activeMessages = unit.chatHistory[qIdx] || [];

  blocksWrapper.innerHTML = `
    <div class="study-unit-player-container" dir="rtl">

      <!-- חלק 1: הקדמה חמה ו-3 כללי זהב -->
      <section class="card study-intro-golden-card" aria-label="הקדמה וכללי זהב">
        <div class="study-intro-card-header">
          <div class="study-intro-badges">
            <span class="study-today-date-badge">📅 ${dateLabel}</span>
            <span class="badge-tag" style="background:#dcfce7;color:#166534;font-weight:800;">✨ הקדמה וכללי אצבע לפני שמתחילים</span>
          </div>
          <button type="button" id="btn-tts-study-intro" class="secondary-btn study-tts-intro-btn" title="הקרא הקדמה וכללי זהב">
            <span>🔊 הקרא הקדמה</span>
          </button>
        </div>

        <h3 class="study-intro-unit-title">${unit.title}</h3>
        <p class="study-intro-summary-text">${topicSummary}</p>

        <div class="study-golden-rules-box">
          <h4 class="study-golden-rules-heading">🌟 3 כללי הזהב שלנו לתרגול היום:</h4>
          <div class="study-golden-rules-grid">
            ${goldenRules.slice(0, 3).map((rule, rIdx) => `
              <div class="study-golden-rule-stone">
                <span class="study-golden-rule-num">${rIdx + 1}</span>
                <p class="study-golden-rule-text">${rule}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- חלק 2: סרגל התקדמות שאלות וכרטיס השאלה הפעילה -->
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
                <span>שאלה ${idx + 1}</span>
                <span>${solved ? '✅' : (isActive ? '🔵' : '⚪')}</span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- באנר השאלה הפעילה בקונטרסט גבוה -->
        <div class="study-active-question-banner">
          <div class="study-active-q-meta">
            <span class="study-active-q-tag">📌 שאלה ${qIdx + 1} מתוך הדף</span>
            ${currentQ.topic_focus ? `<span class="study-active-q-focus">🎯 מוקד: ${currentQ.topic_focus}</span>` : ''}
            ${isCurrentSolved ? `<span class="badge-completed-card">שאלה זו נפתרה בהצלחה ✅</span>` : ''}
          </div>
          <div class="study-active-q-text">
            ${formatCoachChatHtml(currentQ.original_question || currentQ.questionText || '')}
          </div>
        </div>
      </section>

      <!-- חלק 3: צ'אט ליווי אישי בזמן אמת (Socratic Coach Chat) -->
      <section class="card study-socratic-coach-card" aria-label="צ'אט ליווי אישי בזמן אמת">
        <div class="study-coach-header">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span class="study-coach-avatar" aria-hidden="true">🤖</span>
            <div>
              <h3 class="study-coach-title">צ'אט ליווי אישי בזמן אמת — שאלה ${qIdx + 1}</h3>
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

  // Scroll chat box to bottom
  const messagesBox = blocksWrapper.querySelector('#study-help-chat-messages');
  const scrollToChatBottom = () => {
    if (messagesBox) {
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
  };
  scrollToChatBottom();

  // Bind TTS button for Intro & Golden Rules
  const ttsBtn = blocksWrapper.querySelector('#btn-tts-study-intro');
  if (ttsBtn) {
    ttsBtn.onclick = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        if (typeof showToast === 'function') {
          showToast('הקראה קולית אינה נתמכת בדפדפן זה.', 'warning');
        }
        return;
      }
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        ttsBtn.innerHTML = '<span>🔊 הקרא הקדמה</span>';
        return;
      }
      const textToSpeak = `${unit.title}. ${topicSummary}. שלושת כללי הזהב שלנו: ${goldenRules.join('. ')}`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'he-IL';
      utterance.rate = 0.95;
      utterance.onend = () => {
        ttsBtn.innerHTML = '<span>🔊 הקרא הקדמה</span>';
      };
      ttsBtn.innerHTML = '<span>⏹️ עצור הקראה</span>';
      window.speechSynthesis.speak(utterance);
    };
  }

  // Bind question navigation pills
  const navPills = blocksWrapper.querySelectorAll('.study-q-nav-pill');
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

    // 1. Append Daniel's message immediately
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

    // 2. Show calm typing indicator
    if (typingIndicator) {
      typingIndicator.style.display = 'flex';
      scrollToChatBottom();
    }

    // 3. Evaluate turn with AI Coach
    const result = await evaluateStudyHelpTurnWithAI({
      unit,
      qIdx,
      userText: trimmed,
      assistMode
    });

    if (typingIndicator) {
      typingIndicator.style.display = 'none';
    }

    // 4. Append Coach reply
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

    // 5. If question solved accurately, mark solved & reveal Next / Finish button
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

      // Update active pill and progress bar in place
      const activePill = blocksWrapper.querySelector(`.study-q-nav-pill[data-q-idx="${qIdx}"]`);
      if (activePill) {
        activePill.classList.add('solved');
        activePill.innerHTML = `<span>שאלה ${qIdx + 1}</span><span>✅</span>`;
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

  // Bind Send button and Enter key
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

  // Bind 3 Quick-Assist Buttons
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
              <small>בחירת קובץ PDF (עמוד אחד או יותר לפי הסדר) או צילומי עמודים</small>
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
              כל העלאה יוצרת אבן דרך חדשה בתחתית הרשימה. לחץ על כל כרטיס כדי להיכנס להקדמה, לכללי הזהב ולצ'אט המודרך עם המאמן.
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
                      <span class="badge-tag" style="background:#e0f2fe;color:#0369a1;">📝 ${totalQ} שאלות</span>
                      ${isDone
                        ? `<span class="badge-completed-card">הושלם ✅</span>`
                        : `<span class="badge-new-card">חדש ✨</span>`
                      }
                    </div>
                    <h3 class="unit-name-title" style="margin:0.35rem 0;">${unit.title}</h3>
                    <p class="unit-skills-preview" style="margin:0 0 0.65rem 0;">
                      ${unit.introText || unit.topic_summary || 'לחץ כדי לפתוח את ההקדמה, כללי הזהב ופתרון השאלות בצ׳אט עם המאמן.'}
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
                    <span>${isDone ? 'צפה בתרגול' : (solvedQ > 0 ? 'המשך תרגול' : 'התחל תרגול')}</span>
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

      showStudyHelpLoadingOverlay('קורא את הדפים שהעלית...');
      try {
        const sourceLabel = files.map(f => f.name.replace(/\.[^.]+$/, '')).join(', ');
        let extracted = { extractedText: '', inlineImages: [], pageCount: 0 };

        if (typeof window !== 'undefined' && window.PDFExtractor && typeof window.PDFExtractor.extractFromFiles === 'function') {
          extracted = await window.PDFExtractor.extractFromFiles(files);
        }

        await generateDailyStudyUnitFromMaterial({
          extractedText: extracted.extractedText,
          inlineImages: extracted.inlineImages,
          sourceLabel
        });
      } catch (err) {
        console.error('[StudyHelp] Error processing uploaded files:', err);
        hideStudyHelpLoadingOverlay();
        if (typeof showToast === 'function') {
          showToast('אירעה שגיאה בקריאת הקובץ. ניתן לנסות שוב או להדביק את הטקסט ישירות.', 'warning');
        }
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
        sourceLabel: `תרגול יומי (${todayLabel})`
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
  const baseTitle = unit.title || `תרגול יומי (${dateLabel})`;
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
        פתרת את כל השאלות ביחידה <strong>"${unit.title}"</strong> בצורה מעוררת השראה!
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

  // Check if summary exam already exists for this unit
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
    .map((q, idx) => `שאלה ${idx + 1}: ${q.original_question || q.questionText || ''} (פתרון: ${q.expected_answer_summary || ''})`)
    .join('\n');

  const systemInstruction = `אתה מומחה לפיתוח מבחנים מעשיים בהנהלת חשבונות עבור דניאל.
עליך לייצר יחידת מבחן מסכם מעשית בפורמט Dynamic Block Engine (JSON תקני בלבד בעברית, ללא טקסט חופשי מחוץ ל-JSON).`;

  const prompt = `דניאל סיים בהצלחה את יחידת התרגול היומית: "${unit.title}".
סיכום הנושא: ${unit.topic_summary || unit.introText || ''}
כללי הזהב שנלמדו: ${(unit.goldenRules || []).join(' | ')}
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
      jsonMode: true
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

      // Ensure at least 5 exercise blocks and 1 ai_eval_qa block exist
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
        title: `🏆 מבחן מסכם: ${unit.title}`,
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
  window.generateDailyStudyUnitFromMaterial = generateDailyStudyUnitFromMaterial;
  window.renderStudyHelpRoadmap = renderStudyHelpRoadmap;
  window.openStudyHelpUnit = openStudyHelpUnit;
  window.completeStudyHelpUnitAndGenerateExam = completeStudyHelpUnitAndGenerateExam;
  window.showExamReadyCelebrationModal = showExamReadyCelebrationModal;
}
