// ============================================================================
// בועת עוזר ה-AI הצפה הכלל-מערכתית של דניאל (Global Floating AI Assistant Bubble v5.0)
// כוללת סנכרון הקשר אסינכרוני (Async Context Handoff) עם דיאלוג טעינה גלוי,
// חיבור לערוץ Groq המהיר (עם גיבוי Gemini -> OpenRouter), ושמירה קפדנית על טוהר בחינות.
// ============================================================================

const GlobalAiAssistant = {
  isInitialized: false,
  isOpen: false,
  isSyncingContext: false,
  isSendingMessage: false,
  syncDelayMs: 280,
  lastContextKey: '',
  activeContext: null,
  chatHistory: [],

  quickStarterChips: [
    '💡 תסביר לי את המושג שעל המסך במילים פשוטות',
    '🔍 מה אני צריך לעשות בשלב הזה?',
    '🧮 תעזור לי להבין את החישוב כאן'
  ],

  /**
   * אתחול חד-פעמי של הכפתור הצף (#global-ai-assistant-fab) ומגירת הצ'אט (#global-ai-assistant-drawer)
   */
  init() {
    if (typeof document === 'undefined' || !document.body) return;

    const existingFab = document.getElementById('global-ai-assistant-fab');
    const existingDrawer = document.getElementById('global-ai-assistant-drawer');
    if (existingFab && existingDrawer) {
      this.isInitialized = true;
      return;
    }

    this._injectDomElements();
    this._bindEvents();
    this.isInitialized = true;
  },

  /**
   * הזרקת כפתור הבועה הצפה (בפינה השמאלית-תחתונה) ומגירת העוזר הנגישה
   */
  _injectDomElements() {
    if (!document.getElementById('global-ai-assistant-fab')) {
      const fabBtn = document.createElement('button');
      fabBtn.id = 'global-ai-assistant-fab';
      fabBtn.type = 'button';
      fabBtn.className = 'global-ai-fab-btn';
      fabBtn.setAttribute('dir', 'rtl');
      fabBtn.setAttribute('aria-label', '🤖 עוזר ה-AI של דניאל • שאל אותי הכל!');
      fabBtn.setAttribute('aria-expanded', 'false');
      fabBtn.setAttribute('aria-controls', 'global-ai-assistant-drawer');
      fabBtn.innerHTML = `
        <span class="global-ai-fab-pulse" aria-hidden="true"></span>
        <span class="global-ai-fab-label">🤖 עוזר ה-AI של דניאל • שאל אותי הכל!</span>
      `;
      document.body.appendChild(fabBtn);
    }

    if (!document.getElementById('global-ai-assistant-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'global-ai-assistant-backdrop';
      backdrop.className = 'global-ai-backdrop';
      backdrop.style.display = 'none';
      document.body.appendChild(backdrop);
    }

    if (!document.getElementById('global-ai-assistant-drawer')) {
      const drawer = document.createElement('aside');
      drawer.id = 'global-ai-assistant-drawer';
      drawer.className = 'global-ai-drawer';
      drawer.setAttribute('dir', 'rtl');
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'false');
      drawer.setAttribute('aria-label', 'עוזר ה-AI האישי של דניאל');
      drawer.setAttribute('aria-hidden', 'true');

      const chipsHtml = this.quickStarterChips
        .map(
          (chipText, idx) => `
          <button
            type="button"
            class="global-ai-chip-btn"
            data-chip-index="${idx}"
            data-chip-question="${this._escapeHtml(chipText)}"
          >${this._escapeHtml(chipText)}</button>
        `
        )
        .join('');

      drawer.innerHTML = `
        <div class="global-ai-drawer-header">
          <div class="global-ai-header-brand">
            <span class="global-ai-avatar" aria-hidden="true">🤖</span>
            <div class="global-ai-header-titles">
              <h3 class="global-ai-title">עוזר ה-AI של דניאל</h3>
              <span class="global-ai-subtitle">ליווי אישי, מהיר ובגובה העיניים בכל מסך ✨</span>
            </div>
          </div>
          <div class="global-ai-header-actions">
            <button
              type="button"
              id="global-ai-clear-chat-btn"
              class="global-ai-icon-btn"
              title="נקה שיחה והתחל מחדש"
              aria-label="נקה שיחה"
            >🗑️</button>
            <button
              type="button"
              id="global-ai-close-btn"
              class="global-ai-close-btn"
              title="סגור חלונית עוזר AI"
              aria-label="סגור"
            >✕</button>
          </div>
        </div>

        <div class="global-ai-context-bar">
          <div id="global-ai-context-badge" class="global-ai-context-badge" role="status" aria-live="polite">
            📍 מחובר למסך הנוכחי: מסנכרן...
          </div>
          <button
            type="button"
            id="global-ai-refresh-context-btn"
            class="global-ai-refresh-btn"
          >🔄 עדכן הקשר למסך הנוכחי</button>
        </div>

        <div class="global-ai-body-wrap">
          <!-- דיאלוג טעינה גלוי להעברת הקשר אסינכרונית (Async Context Handoff Dialog) -->
          <div
            id="global-ai-context-loading-overlay"
            class="global-ai-context-loading-overlay"
            role="alert"
            aria-live="assertive"
            style="display: none;"
          >
            <div class="global-ai-loading-dialog-card">
              <div class="global-ai-loading-spinner" aria-hidden="true"></div>
              <div id="global-ai-loading-title" class="global-ai-loading-title">
                🔄 מסנכרן את ההקשר של המסך והשקופית הנוכחית שלך...
              </div>
              <div class="global-ai-loading-sub">
                אוסף את המסלול הפעיל, כותרת היחידה, תוכן השקופית והיסטוריית הלמידה כדי לעזור לך בדיוק במקום שבו אתה נמצא
              </div>
            </div>
          </div>

          <div id="global-ai-messages-feed" class="global-ai-messages-feed" aria-live="polite"></div>
        </div>

        <div class="global-ai-quick-chips-section">
          <div class="global-ai-chips-caption">שאלות מהירות בלחיצה אחת:</div>
          <div id="global-ai-quick-chips" class="global-ai-quick-chips">
            ${chipsHtml}
          </div>
        </div>

        <div class="global-ai-input-area">
          <textarea
            id="global-ai-input"
            class="global-ai-input"
            rows="2"
            placeholder="שאל אותי הכל דניאל — על המושג במסך, על הוראה לא ברורה, או כל שאלה אחרת..."
            aria-label="הקלד שאלה לעוזר ה-AI"
          ></textarea>
          <button
            type="button"
            id="global-ai-send-btn"
            class="global-ai-send-btn primary-btn"
          >
            <span>שלח ➤</span>
          </button>
        </div>
      `;

      document.body.appendChild(drawer);
    }
  },

  /**
   * חיבור מאזיני לחיצה ומקלדת לכפתור הצף, כפתור סנכרון ההקשר, הצ'יפים המהירים ושדה הקלט
   */
  _bindEvents() {
    const fabBtn = document.getElementById('global-ai-assistant-fab');
    const drawer = document.getElementById('global-ai-assistant-drawer');
    const backdrop = document.getElementById('global-ai-assistant-backdrop');
    const closeBtn = document.getElementById('global-ai-close-btn');
    const clearBtn = document.getElementById('global-ai-clear-chat-btn');
    const refreshBtn = document.getElementById('global-ai-refresh-context-btn');
    const chipsWrap = document.getElementById('global-ai-quick-chips');
    const inputEl = document.getElementById('global-ai-input');
    const sendBtn = document.getElementById('global-ai-send-btn');

    if (fabBtn) {
      fabBtn.onclick = () => {
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      };
    }

    if (closeBtn) {
      closeBtn.onclick = () => this.close();
    }

    if (backdrop) {
      backdrop.onclick = () => this.close();
    }

    if (clearBtn) {
      clearBtn.onclick = () => {
        this.chatHistory = [];
        this.lastContextKey = '';
        const feed = document.getElementById('global-ai-messages-feed');
        if (feed) feed.innerHTML = '';
        this.syncActiveScreenContext({ forceGreeting: true });
      };
    }

    if (refreshBtn) {
      refreshBtn.onclick = () => {
        this.syncActiveScreenContext({ manualRefresh: true });
      };
    }

    if (chipsWrap && typeof chipsWrap.querySelectorAll === 'function') {
      const chipBtns = chipsWrap.querySelectorAll('.global-ai-chip-btn');
      Array.from(chipBtns).forEach((btn) => {
        btn.onclick = () => {
          const question = btn.getAttribute('data-chip-question') || btn.textContent || '';
          if (question.trim()) {
            this.sendMessage(question.trim());
          }
        };
      });
    }

    if (sendBtn) {
      sendBtn.onclick = () => {
        if (!inputEl) return;
        const val = inputEl.value.trim();
        if (!val) return;
        inputEl.value = '';
        this.sendMessage(val);
      };
    }

    if (inputEl && typeof inputEl.addEventListener === 'function') {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const val = inputEl.value.trim();
          if (!val) return;
          inputEl.value = '';
          this.sendMessage(val);
        }
      });
    }

    if (typeof document.addEventListener === 'function') {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });
    }

    if (drawer && typeof drawer.addEventListener === 'function') {
      drawer.addEventListener('click', (e) => {
        const target = e.target && typeof e.target.closest === 'function'
          ? e.target.closest('.global-ai-tts-btn')
          : null;
        if (target) {
          const msgIdx = Number(target.getAttribute('data-msg-idx'));
          const item = this.chatHistory[msgIdx];
          if (item && item.text && typeof SoundService !== 'undefined' && typeof SoundService.speakText === 'function') {
            SoundService.speakText(item.text);
          }
        }
      });
    }
  },

  /**
   * פתיחת מגירת העוזר והפעלה מיידית של סנכרון ההקשר האסינכרוני עם דיאלוג הטעינה הגלוי
   */
  async open(options = {}) {
    if (!this.isInitialized) {
      this.init();
    }

    const drawer = document.getElementById('global-ai-assistant-drawer');
    const fabBtn = document.getElementById('global-ai-assistant-fab');
    const backdrop = document.getElementById('global-ai-assistant-backdrop');

    this.isOpen = true;
    if (drawer) {
      if (drawer.classList) drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
    }
    if (fabBtn) {
      if (fabBtn.classList) fabBtn.classList.add('is-active');
      fabBtn.setAttribute('aria-expanded', 'true');
    }
    if (backdrop) {
      backdrop.style.display = 'block';
    }

    await this.syncActiveScreenContext(options);

    const inputEl = document.getElementById('global-ai-input');
    if (inputEl && typeof inputEl.focus === 'function') {
      inputEl.focus();
    }
  },

  /**
   * סגירת מגירת העוזר והחזרת פוקוס לכפתור הצף
   */
  close() {
    const drawer = document.getElementById('global-ai-assistant-drawer');
    const fabBtn = document.getElementById('global-ai-assistant-fab');
    const backdrop = document.getElementById('global-ai-assistant-backdrop');

    this.isOpen = false;
    if (drawer) {
      if (drawer.classList) drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (fabBtn) {
      if (fabBtn.classList) fabBtn.classList.remove('is-active');
      fabBtn.setAttribute('aria-expanded', 'false');
    }
    if (backdrop) {
      backdrop.style.display = 'none';
    }
  },

  /**
   * סנכרון אסינכרוני של הקשר המסך והשקופית הפעילה עם דיאלוג טעינה גלוי למשתמש
   */
  async syncActiveScreenContext(options = {}) {
    const overlay = document.getElementById('global-ai-context-loading-overlay');
    const loadingTitle = document.getElementById('global-ai-loading-title');
    const refreshBtn = document.getElementById('global-ai-refresh-context-btn');
    const badgeEl = document.getElementById('global-ai-context-badge');

    this.isSyncingContext = true;
    if (loadingTitle) {
      loadingTitle.textContent = '🔄 מסנכרן את ההקשר של המסך והשקופית הנוכחית שלך...';
    }
    if (overlay) {
      overlay.style.display = 'flex';
      if (overlay.classList) overlay.classList.add('visible');
    }
    if (refreshBtn) {
      refreshBtn.disabled = true;
    }

    const waitMs = typeof options.delayMs === 'number' ? Math.max(0, options.delayMs) : this.syncDelayMs;

    try {
      // Yield to browser paint cycle so the loading dialog is clearly rendered during async context collection
      await new Promise((resolve) => setTimeout(resolve, waitMs));

      const collected = await Promise.resolve(this.collectActiveScreenContext());
      const prevKey = this.lastContextKey;
      this.activeContext = collected;
      this.lastContextKey = collected.contextKey;

      if (badgeEl) {
        badgeEl.textContent = `📍 מחובר למסך הנוכחי: ${collected.badgeLabel}`;
      }

      if (this.chatHistory.length === 0 || options.forceGreeting) {
        const welcomeText = this._buildContextualWelcome(collected);
        this.chatHistory.push({
          role: 'assistant',
          text: welcomeText,
          timestamp: new Date().toISOString()
        });
        this._renderMessages();
      } else if (options.manualRefresh || (prevKey && prevKey !== collected.contextKey)) {
        this._appendContextNotice(`📍 ההקשר סונכרן למסך הנוכחי: ${collected.badgeLabel}`);
      }

      return collected;
    } finally {
      this.isSyncingContext = false;
      if (overlay) {
        if (overlay.classList) overlay.classList.remove('visible');
        overlay.style.display = 'none';
      }
      if (refreshBtn) {
        refreshBtn.disabled = false;
      }
    }
  },

  /**
   * איסוף מלא של הקשר המסך הפעיל:
   * - מסלול פעיל (`activeTrack`)
   * - תצוגה נוכחית (`roadmap` / `unit` / `checkpoint` / `admin`)
   * - כותרת יחידה פעילה
   * - תוכן שקופית / מושג / שאלה פעילה על המסך
   * - יומן אינטראקציות אחרונות (`recentInteractionLog`)
   */
  collectActiveScreenContext() {
    const state = typeof appState !== 'undefined' && appState ? appState : {};
    const trackObj = typeof getActiveTrack === 'function'
      ? getActiveTrack()
      : (typeof TRACKS !== 'undefined' && Array.isArray(TRACKS)
          ? TRACKS.find(t => t.id === (state.activeTrackId || 'general')) || TRACKS[0]
          : { id: 'general', shortLabel: 'כללי ו-AI', title: 'מיומנויות AI וכלים מעשיים' });

    const activeTrackId = (trackObj && trackObj.id) || state.activeTrackId || 'general';
    const activeTrackLabel = (trackObj && (trackObj.shortLabel || trackObj.title)) || 'כללי ו-AI';

    let currentView = state.currentView || 'roadmap';
    if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
      const activeSec = document.querySelector('.view-section.active');
      if (activeSec && activeSec.id) {
        currentView = activeSec.id.replace(/^view-/, '');
      }
    }

    let unitTitle = '';
    let slideLabel = '';
    let activeContentText = '';
    let recentInteractionLog = '';
    let isExamOrCheckpoint = false;

    // 1. מסך יחידה פעילה (Track 1 / Track 2 / Track 3 / Summary Exam)
    if (currentView === 'unit') {
      const activeId = state.activeUnitId || '';

      const studyHelpList = Array.isArray(state.studyHelpUnits) ? state.studyHelpUnits : [];
      const dailyCards = Array.isArray(state.studyHelp?.dailyCards) ? state.studyHelp.dailyCards : [];
      const studyUnit = studyHelpList.find(u => u && u.id === activeId) || dailyCards.find(u => u && u.id === activeId);

      const summaryExams = Array.isArray(state.accountingSummaryExams) ? state.accountingSummaryExams : [];
      const summaryExamUnit = summaryExams.find(e => e && (e.unit_id === activeId || e.id === activeId));

      if (studyUnit) {
        unitTitle = studyUnit.lesson_title || studyUnit.title || 'יחידת לימוד יומית';
        const slide = (typeof UnitBeatCursor !== 'undefined' && UnitBeatCursor && typeof UnitBeatCursor.getCurrentSlide === 'function')
          ? UnitBeatCursor.getCurrentSlide(studyUnit)
          : null;

        if (slide) {
          slideLabel = slide.fullTitle || slide.shortLabel || 'שקופית פעילה';
          if (slide.type === 'PROMO_OVERVIEW_SLIDE') {
            activeContentText = [
              `יחידה: ${unitTitle}`,
              studyUnit.pages_summary ? `תקציר עמודי השיעור: ${studyUnit.pages_summary}` : '',
              studyUnit.friendly_summary ? `סיכום ידידותי: ${studyUnit.friendly_summary}` : ''
            ].filter(Boolean).join('\n');
          } else if (slide.type === 'CONCEPT_SLIDE') {
            const c = Array.isArray(studyUnit.concepts) ? studyUnit.concepts[slide.conceptIdx] : null;
            if (c) {
              slideLabel = `מושג: ${c.term_name || slide.shortLabel}`;
              const paragraphs = Array.isArray(c.paragraphs)
                ? c.paragraphs.join(' ')
                : (c.simple_explanation || c.plain_explanation || '');
              let bookExText = '';
              if (typeof c.book_example === 'string') {
                bookExText = c.book_example;
              } else if (c.book_example && typeof c.book_example === 'object') {
                bookExText = [
                  c.book_example.title,
                  c.book_example.scenario || c.book_example.text,
                  Array.isArray(c.book_example.solution_steps) ? c.book_example.solution_steps.join(' -> ') : c.book_example.solution_steps
                ].filter(Boolean).join(' — ');
              } else if (c.concrete_example) {
                bookExText = String(c.concrete_example);
              }
              const mcqPrompt = c.bottom_questions?.mc_question?.question || c.bottom_questions?.mcq?.prompt || c.mfa_step1_question || '';
              const openPrompt = c.bottom_questions?.open_question?.question || c.bottom_questions?.open_q?.prompt || '';
              activeContentText = [
                `מושג נלמד (עמוד ${c.page_number || 1}): ${c.term_name || ''}`,
                paragraphs ? `הסבר המושג: ${paragraphs}` : '',
                bookExText ? `דוגמה מהספר: ${bookExText}` : '',
                mcqPrompt ? `שאלה אמריקאית בשקופית: ${mcqPrompt}` : '',
                openPrompt ? `שאלה פתוחה בשקופית: ${openPrompt}` : ''
              ].filter(Boolean).join('\n');
            }
          } else if (slide.type === 'PRIVATE_TUTOR_SLIDE') {
            const beat = Array.isArray(studyUnit.conceptBeats) ? studyUnit.conceptBeats[slide.beatIndex] : null;
            const checklist = Array.isArray(beat?.tutorSlide?.required_terms_checklist)
              ? beat.tutorSlide.required_terms_checklist
              : [];
            const recentTutorMsgs = Array.isArray(beat?.tutorSlide?.chatHistory)
              ? beat.tutorSlide.chatHistory.slice(-4).map(m => `${m.role === 'user' ? 'דניאל' : 'המורה הפרטי'}: ${m.text}`).join('\n')
              : '';
            slideLabel = `שיחה עם המורה הפרטי (קבוצה ${(slide.beatIndex || 0) + 1})`;
            activeContentText = [
              `מושגים לבדיקה בשיחה: ${checklist.map(t => `${t.term_name} (${t.verified ? 'מובן' : 'בתרגול'})`).join(', ')}`,
              recentTutorMsgs ? `הודעות אחרונות בשיחה:\n${recentTutorMsgs}` : ''
            ].filter(Boolean).join('\n');
          } else if (slide.type === 'HOMEWORK_SLIDE') {
            const q = Array.isArray(studyUnit.questions) ? studyUnit.questions[slide.qIdx] : null;
            isExamOrCheckpoint = false; // שיעורי בית מודרכים — מותר להדריך צעד-אחר-צעד אך לא לתת פתרון סופי להעתקה עיוורת
            if (q) {
              slideLabel = q.question_number_label || `שאלת שיעורי בית ${(slide.qIdx || 0) + 1}`;
              activeContentText = [
                `שאלת תרגול מעמוד ${q.page_number || 1} (${slideLabel}):`,
                `ניסוח השאלה בספר: ${q.exact_book_text || q.original_text || ''}`,
                q.friendly_translation ? `הסבר השאלה במילים פשוטות: ${q.friendly_translation}` : '',
                Array.isArray(q.step_by_step_guide) && q.step_by_step_guide.length > 0
                  ? `שלבי הפתרון המומלצים: ${q.step_by_step_guide.join(' | ')}`
                  : ''
              ].filter(Boolean).join('\n');
            }
          }
        }

        // איסוף יומן אינטראקציות אחרונות ביחידה
        const logEntries = Array.isArray(studyUnit.slideInteractionLog)
          ? studyUnit.slideInteractionLog.slice(-5).map(entry => {
              const label = entry.termName || entry.questionId || entry.slideType || 'אינטראקציה';
              const status = entry.isCorrect === true ? 'הצליח ✅' : (entry.isCorrect === false ? 'ביקש חיזוק 💡' : 'בוצע');
              return `${label}: ${status}${entry.detail ? ' (' + entry.detail + ')' : ''}`;
            })
          : [];
        const misconceptions = Array.isArray(studyUnit.learnerAdaptationProfile?.recentMisconceptions)
          ? studyUnit.learnerAdaptationProfile.recentMisconceptions.slice(-3)
          : [];
        recentInteractionLog = [
          logEntries.length > 0 ? `פעולות אחרונות של דניאל: ${logEntries.join(' ; ')}` : '',
          misconceptions.length > 0 ? `נקודות לחיזוק עדין: ${misconceptions.join(' ; ')}` : ''
        ].filter(Boolean).join('\n');
      } else if (summaryExamUnit) {
        isExamOrCheckpoint = true;
        unitTitle = summaryExamUnit.title || 'מבחן מסכם מעשי בהנהלת חשבונות';
        slideLabel = 'מבחן מסכם מעשי';
        const domSnippet = this._readCleanDomText(['#unit-blocks-wrapper', '#unit-goal-desc'], 1300);
        activeContentText = `מבחן מסכם פעיל: ${unitTitle}\n${domSnippet}`;
      } else {
        // Track 1 (general) או Track 2 (accounting)
        const domUnitTitle = this._readCleanDomText(['#unit-main-title', '#unit-view-title'], 180);
        const domGoal = this._readCleanDomText(['#unit-goal-desc'], 260);
        const domBody = this._readCleanDomText(['#unit-blocks-wrapper', '#unit-steps-wrapper'], 1400);
        unitTitle = domUnitTitle || 'יחידת לימוד פעילה';
        slideLabel = unitTitle;
        activeContentText = [
          `יחידה: ${unitTitle}`,
          domGoal ? `מטרת היחידה: ${domGoal}` : '',
          domBody ? `תוכן מוצג על המסך:\n${domBody}` : ''
        ].filter(Boolean).join('\n');
      }
    } else if (currentView === 'checkpoint') {
      isExamOrCheckpoint = true;
      const cpHeader = this._readCleanDomText(['#checkpoint-view-header'], 180) || 'מבחן שלב / מבחן מסכם';
      const cpStep = this._readCleanDomText(['#checkpoint-step-text'], 100);
      const cpArea = this._readCleanDomText(['#checkpoint-content-area'], 1300);
      unitTitle = cpHeader;
      slideLabel = cpStep || 'שאלה פעילה במבחן';
      activeContentText = [
        `מבחן פעיל: ${cpHeader} (${slideLabel})`,
        cpArea ? `תוכן השאלה על המסך:\n${cpArea}` : ''
      ].filter(Boolean).join('\n');
    } else if (currentView === 'admin') {
      unitTitle = 'מרכז ניהול ומעקב למלווה';
      const activeTabText = this._readCleanDomText(['.adm-tab-btn.active'], 120) || 'מעקב והתקדמות';
      slideLabel = activeTabText;
      activeContentText = `מסך ניהול מלווה פעיל בלשונית: ${activeTabText}`;
    } else {
      // roadmap (ברירת מחדל)
      unitTitle = 'מפת הלמידה האישית';
      slideLabel = activeTrackLabel;
      const stats = state.studyHelpStats || {};
      const roadmapPreview = this._readCleanDomText(['#study-help-hub-wrapper', '#roadmap-days-container'], 900);
      activeContentText = [
        `מסך ראשי: מפת הלמידה במסלול "${activeTrackLabel}".`,
        stats.totalStars !== undefined ? `כוכבי שליטה של דניאל: ${stats.totalStars || 0} ⭐, רצף למידה: ${stats.streakDays || 1} ימים 🔥.` : '',
        roadmapPreview ? `תצוגה נוכחית במסך:\n${roadmapPreview}` : ''
      ].filter(Boolean).join('\n');
    }

    const badgeParts = [activeTrackLabel];
    if (slideLabel && slideLabel !== activeTrackLabel) {
      badgeParts.push(slideLabel);
    } else if (unitTitle && unitTitle !== activeTrackLabel) {
      badgeParts.push(unitTitle);
    }
    const badgeLabel = badgeParts.join(' / ');
    const contextKey = `${currentView}::${activeTrackId}::${unitTitle}::${slideLabel}`;

    return {
      contextKey,
      currentView,
      activeTrack: activeTrackId,
      activeTrackLabel,
      unitTitle,
      slideLabel,
      badgeLabel,
      activeContentText: activeContentText.slice(0, 2000),
      recentInteractionLog: recentInteractionLog.slice(0, 800),
      isExamOrCheckpoint,
      syncedAt: new Date().toISOString()
    };
  },

  /**
   * שליחת שאלה חופשית או צ'יפ מהיר לערוץ `callGroqPreferredAI` (Groq -> Gemini -> OpenRouter)
   */
  async sendMessage(rawUserText) {
    const userText = String(rawUserText || '').trim();
    if (!userText || this.isSendingMessage) return null;

    if (!this.activeContext) {
      await this.syncActiveScreenContext({ delayMs: 60 });
    } else {
      // עדכון שקט של נתוני המסך במידה ודניאל עבר שקופית כשהמגירה כבר פתוחה
      const fresh = this.collectActiveScreenContext();
      if (fresh.contextKey !== this.lastContextKey) {
        this.activeContext = fresh;
        this.lastContextKey = fresh.contextKey;
        const badgeEl = document.getElementById('global-ai-context-badge');
        if (badgeEl) {
          badgeEl.textContent = `📍 מחובר למסך הנוכחי: ${fresh.badgeLabel}`;
        }
      }
    }

    this.chatHistory.push({
      role: 'user',
      text: userText,
      timestamp: new Date().toISOString()
    });
    this._renderMessages();

    this.isSendingMessage = true;
    this._setTypingState(true);

    const ctx = this.activeContext || this.collectActiveScreenContext();
    const systemInstruction = [
      'אתה עוזר ה-AI האישי, החם והנגיש של דניאל במערכת הלמידה שלו.',
      'כללי שיחה מחייבים:',
      '1. ענה תמיד בעברית תקנית, חמה, מעודדת ובגובה העיניים.',
      '2. כתוב בסגנון וואטסאפ קצר, נקי ונעים לקריאה (2 עד 4 פסקאות קצרצרות או נקודות ברורות, בלי הצפת טקסט).',
      '3. התבסס על ההקשר המדויק של המסך והשקופית שדניאל צופה בהם כרגע.',
      '4. שמירה מוחלטת על למידה אמיתית וטוהר בחינות: לעולם אל תגלה תשובה סופית מוכנה במבחן או בשאלת תרגול! במקום לגלות את התשובה הסופית, הסבר את המושג במילים פשוטות, פרק את הדרך לצעדים קטנים, או תן דוגמה דומה עם מספרים אחרים כדי שדניאל יגיע לתשובה בעצמו בגאווה.'
    ].join('\n');

    const recentTurns = this.chatHistory
      .slice(-7, -1)
      .map(m => `${m.role === 'user' ? 'דניאל' : 'עוזר ה-AI'}: ${m.text}`)
      .join('\n');

    const fullPrompt = [
      `=== הקשר המסך הנוכחי של דניאל ===`,
      `- מסלול פעיל: ${ctx.activeTrackLabel} (${ctx.activeTrack})`,
      `- מסך / יחידה: ${ctx.unitTitle || 'כללי'}`,
      `- שקופית / שלב נוכחי: ${ctx.slideLabel || 'כללי'}`,
      ctx.isExamOrCheckpoint
        ? `- ⚠️ מצב מבחן פעיל: דניאל נמצא כרגע במבחן! אסור בשום אופן לגלות את התשובה הנכונה לשאלה שעל המסך — הסבר רק את המושג או רמז חשיבתי עדין.`
        : `- מצב למידה/תרגול: הסבר בפשטות ועזור לדניאל להבין בעצמו בלי לתת פתרון סופי להעתקה עיוורת.`,
      ctx.activeContentText ? `- תוכן המסך והשקופית כרגע:\n${ctx.activeContentText}` : '',
      ctx.recentInteractionLog ? `- יומן אינטראקציות אחרונות של דניאל:\n${ctx.recentInteractionLog}` : '',
      recentTurns ? `\n=== היסטוריית שיחה אחרונה בחלונית העוזר ===\n${recentTurns}` : '',
      `\n=== השאלה החדשה של דניאל ===\n"${userText}"`,
      `\nענה כעת לדניאל בעברית חמה, קצרה וברורה (בסגנון הודעת וואטסאפ ידידותית):`
    ]
      .filter(Boolean)
      .join('\n');

    let assistantReply = '';
    try {
      if (typeof callGroqPreferredAI === 'function') {
        assistantReply = await callGroqPreferredAI(fullPrompt, {
          systemInstruction,
          maxTokens: 900,
          timeoutMs: 25000
        });
      } else if (typeof callMultiTierAI === 'function') {
        assistantReply = await callMultiTierAI(fullPrompt, {
          systemInstruction,
          maxTokens: 900
        });
      }
    } catch (err) {
      console.warn('[GlobalAiAssistant] AI call warning, falling back to contextual offline helper:', err);
    }

    if (!assistantReply || !String(assistantReply).trim()) {
      assistantReply = this._buildOfflineContextualFallback(userText, ctx);
    }

    const cleanReply = String(assistantReply).trim();
    this.chatHistory.push({
      role: 'assistant',
      text: cleanReply,
      timestamp: new Date().toISOString()
    });

    this.isSendingMessage = false;
    this._setTypingState(false);
    this._renderMessages();

    return cleanReply;
  },

  /**
   * בניית הודעת פתיחה חמה המותאמת אוטומטית למסך הנוכחי של דניאל
   */
  _buildContextualWelcome(ctx) {
    if (ctx.isExamOrCheckpoint) {
      return `היי דניאל אלוף! 👋 אני מחובר עכשיו למסך **"${ctx.badgeLabel}"**.\n\nמאחר שאתה באמצע מבחן, לא אגלה את התשובות הסופיות 😉 — אבל אשמח להסביר לך במילים פשוטות כל מילה, מושג או הוראה בשאלה כדי שתפתור בביטחון!`;
    }
    if (ctx.currentView === 'unit' && ctx.slideLabel) {
      return `היי דניאל! 👋 אני מסונכרן ב-100% לשקופית שלך: **"${ctx.badgeLabel}"**.\n\nאפשר ללחוץ על אחד הכפתורים המהירים למטה או לשאול אותי במילים שלך כל דבר שלא ברור על המסך! 💬`;
    }
    return `היי דניאל! 👋 אני עוזר ה-AI האישי שלך, ואני מחובר עכשיו אל **"${ctx.badgeLabel}"**.\n\nאפשר לשאול אותי כל שאלה על החומר, על מה עושים בשלב הבא, או כל מושג שתרצה שנפרק יחד במילים פשוטות! ✨`;
  },

  /**
   * מענה גיבוי חכם ואמפתי במידה ואין חיבור רשת / מפתחות API זמינים
   */
  _buildOfflineContextualFallback(userText, ctx) {
    if (ctx.isExamOrCheckpoint) {
      return `אני רואה שאתה נמצא ב-**"${ctx.badgeLabel}"** 🎯.\n\nבמבחן אנחנו עובדים צעד-צעד: קרא שוב את משפט המפתח בשאלה, זהה מה נכנס לעסק ומה יצא ממנו, ובדוק אילו נתונים מספריים מופיעים. כתוב לי איזו מילה בשאלה תרצה שנפרק!`;
    }
    return `אני איתך במסך **"${ctx.badgeLabel}"** 💡.\n\nלגבי השאלה שלך (*"${userText.slice(0, 70)}"*): בוא נסתכל יחד על הכותרת והדוגמה שעל המסך, נזהה קודם כל את הפעולה המרכזית במילים פשוטות, ונתקדם צעד אחד רגוע בכל פעם. תרצה שנפרק את המשפט הראשון בשקופית?`;
  },

  /**
   * קריאת טקסט נקי מרשימת סלקטורים ב-DOM ללא תגיות מיותרות
   */
  _readCleanDomText(selectors, maxLen = 1000) {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return '';
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const raw = typeof el.innerText === 'string' && el.innerText.trim()
          ? el.innerText
          : (el.textContent || '');
        const cleaned = raw.replace(/\s+/g, ' ').trim();
        if (cleaned) {
          return cleaned.slice(0, maxLen);
        }
      }
    }
    return '';
  },

  /**
   * הוספת שורת עדכון הקשר עדינה בתוך הפיד כאשר דניאל מרענן הקשר או עובר מסך
   */
  _appendContextNotice(noticeText) {
    this.chatHistory.push({
      role: 'system_notice',
      text: noticeText,
      timestamp: new Date().toISOString()
    });
    this._renderMessages();
  },

  /**
   * הצגה/הסתרה של חיווי הקלדה בזמן המתנה לתשובת ה-AI
   */
  _setTypingState(isTyping) {
    const sendBtn = document.getElementById('global-ai-send-btn');
    if (sendBtn) sendBtn.disabled = Boolean(isTyping);

    const feed = document.getElementById('global-ai-messages-feed');
    if (!feed) return;

    const existingTyping = document.getElementById('global-ai-typing-row');
    if (isTyping && !existingTyping) {
      const typingDiv = document.createElement('div');
      typingDiv.id = 'global-ai-typing-row';
      typingDiv.className = 'global-ai-msg-row assistant-row';
      typingDiv.innerHTML = `
        <div class="global-ai-msg-bubble assistant-bubble typing-bubble">
          <span>🤖 חושב ומנסח הסבר קצר וברור...</span>
        </div>
      `;
      feed.appendChild(typingDiv);
      feed.scrollTop = feed.scrollHeight;
    } else if (!isTyping && existingTyping && existingTyping.parentNode) {
      existingTyping.parentNode.removeChild(existingTyping);
    }
  },

  /**
   * רינדור כל בועות השיחה בחלונית העוזר
   */
  _renderMessages() {
    const feed = document.getElementById('global-ai-messages-feed');
    if (!feed) return;

    feed.innerHTML = this.chatHistory
      .map((msg, idx) => {
        if (msg.role === 'system_notice') {
          return `
            <div class="global-ai-context-notice-pill">
              ${this._escapeHtml(msg.text)}
            </div>
          `;
        }
        const isUser = msg.role === 'user';
        return `
          <div class="global-ai-msg-row ${isUser ? 'user-row' : 'assistant-row'}">
            <div class="global-ai-msg-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}">
              <div class="global-ai-msg-header">
                <span class="global-ai-msg-author">${isUser ? '👤 דניאל' : '🤖 עוזר ה-AI'}</span>
                ${
                  !isUser
                    ? `<button type="button" class="global-ai-tts-btn" data-msg-idx="${idx}" title="הקרא בקול">🔊 הקרא</button>`
                    : ''
                }
              </div>
              <div class="global-ai-msg-text">${this._formatMessageHtml(msg.text)}</div>
            </div>
          </div>
        `;
      })
      .join('');

    feed.scrollTop = feed.scrollHeight;
  },

  _escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  _formatMessageHtml(text) {
    const escaped = this._escapeHtml(text);
    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
};

if (typeof window !== 'undefined') {
  window.GlobalAiAssistant = GlobalAiAssistant;
}
if (typeof globalThis !== 'undefined') {
  globalThis.GlobalAiAssistant = GlobalAiAssistant;
}
