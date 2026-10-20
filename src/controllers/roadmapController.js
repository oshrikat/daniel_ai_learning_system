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

  if (Array.isArray(TRACKS) && !TRACKS.some(t => t.id === 'study_help')) {
    TRACKS.push({
      id: 'study_help',
      label: 'מסלול 3: עזרה בלימודים 🎓',
      shortLabel: 'עזרה בלימודים',
      title: 'עזרה בלימודים',
      icon: '🎓',
      description: 'עזרה אישית בשיעורי בית, הסבר מושגים ותרגול מונחה עם מאמן ה-AI',
      dataVar: null,
      engine: 'study_help'
    });
  }

  const activeTrack = getActiveTrack();

  TRACKS.forEach(track => {
    const isSelected = track.id === activeTrack.id;
    const btn = document.createElement('button');
    btn.id = `tab-${track.id}`;
    btn.className = `track-tab-btn ${isSelected ? 'active' : ''}`;
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('data-track', track.id);
    btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    btn.innerHTML = `
      <span class="track-tab-icon">${track.icon}</span>
      <span class="track-tab-title">${track.label}</span>
    `;
    btn.onclick = () => {
      appState.activeTrackId = track.id;
      appState.currentTrack = track.id;
      saveAppState();
      if (typeof showView === 'function' && appState.currentView !== 'roadmap') {
        showView('roadmap');
      }
      renderTrackTabs();
      renderRoadmap();
    };
    container.appendChild(btn);
  });
}

function formatStudyMessageHtml(text) {
  const safe = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return safe
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function readFileAsBase64Obj(file) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      resolve({ mimeType: 'application/octet-stream', data: '' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = String(reader.result || '');
      const base64Data = resultStr.replace(/^data:[^;]+;base64,/, '');
      const inferredMime = file.type || (String(file.name || '').toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      resolve({ mimeType: inferredMime, data: base64Data });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

async function createDailyCardFromInput({ rawText = '', fileImagesBase64 = [], fileName = '', sourceType = 'pasted_text', container = null } = {}) {
  const targetContainer = container || document.getElementById('units-grid');
  const overlay = targetContainer ? targetContainer.querySelector('#study-calming-overlay') : document.getElementById('study-calming-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.classList.add('active');
  }

  let parsedCardData = null;
  try {
    parsedCardData = await AIService.createDailyStudyCardFromMaterial({
      rawText,
      fileImagesBase64,
      fileName
    });
  } catch (err) {
    console.warn('[StudyHelp] Fallback card creation:', err);
    parsedCardData = AIService.parseHomeworkFallback({ rawText, fileName });
  }

  const createdCard = saveDailyStudyCard({
    title: parsedCardData.title,
    sourceType,
    introAndRules: parsedCardData.introAndRules,
    questions: parsedCardData.questions,
    isNew: true,
    isCompleted: false
  });

  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }

  if (typeof SoundService !== 'undefined') {
    SoundService.playSuccessSound();
  }

  if (targetContainer) {
    renderStudyHelpWorkspace(targetContainer);
    const newCardEl = targetContainer.querySelector(`[data-daily-card-id="${createdCard.id}"]`);
    if (newCardEl && typeof newCardEl.scrollIntoView === 'function') {
      newCardEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  showToast(`נוצרה יחידת תרגול יומית חדשה: "${createdCard.title}" ✨`, 'success');
  return createdCard;
}

function renderStudyHelpWorkspace(container) {
  if (!appState.studyHelp || typeof appState.studyHelp !== 'object') {
    appState.studyHelp = { dailyCards: [], activeCardId: null, sessions: [], activeSessionId: null, savedNotes: [], totalQuestionsAsked: 0 };
  }
  if (!Array.isArray(appState.studyHelp.dailyCards)) {
    appState.studyHelp.dailyCards = [];
  }

  const todayFormatted = new Date().toLocaleDateString('he-IL');
  const dailyCards = appState.studyHelp.dailyCards;

  container.innerHTML = `
    <div class="study-help-workspace">
      <!-- STEP 1: Top Box - העלאת החומר של היום -->
      <div class="card study-upload-top-box">
        <div class="study-upload-header">
          <div>
            <span class="badge-tag study-date-badge">📅 החומר של היום: ${todayFormatted}</span>
            <h3 class="study-upload-title">העלאת החומר של היום והכנת יחידת תרגול מותאמת אישית 📚</h3>
            <p class="study-upload-subtitle">
              בחר איך להעלות את דף העבודה או השאלות מהשיעור היום, ומאמן ה-AI יסדר לך הקדמה ברורה, כללי אצבע ושאלות לתרגול מונחה צעד אחר צעד:
            </p>
          </div>
        </div>

        <!-- 2 Prominent Action Buttons Side-by-Side -->
        <div class="study-upload-actions-grid">
          <button type="button" id="study-upload-pdf-btn" class="primary-btn study-upload-action-btn pdf-upload-btn">
            <span class="upload-btn-icon">📄</span>
            <span class="upload-btn-text">📄 העלאת PDF סרוק (CamScanner) או תמונות מהספר</span>
          </button>

          <button type="button" id="study-toggle-paste-btn" class="secondary-btn study-upload-action-btn paste-toggle-btn">
            <span class="upload-btn-icon">📋</span>
            <span class="upload-btn-text">📋 הדבקת טקסט ישירה של השאלות והחומר</span>
          </button>
        </div>

        <input
          type="file"
          id="study-file-upload-input"
          accept=".pdf,image/*"
          multiple
          style="display: none;"
        />

        <!-- Inline Textarea for Pasted Homework Text (Button 2) -->
        <div id="study-paste-panel" class="study-paste-panel" style="display: none;">
          <label for="study-paste-textarea" class="study-input-label">
            ✍️ הדבק או הקלד כאן את השאלות והחומר של היום:
          </label>
          <textarea
            id="study-paste-textarea"
            class="styled-textarea study-help-textarea"
            rows="4"
            placeholder="לדוגמה:
1. עסק רכש סחורה מספק בסך 2,000 ש״ח + מע״מ (18%) באשראי. רשום פקודת יומן.
2. העסק מכר סחורה ללקוח בסך 3,500 ש״ח + מע״מ במזומן. רשום פקודת יומן."
          ></textarea>
          <div class="study-input-actions">
            <span class="study-input-hint">💡 מנוע ה-AI יחלק אוטומטית כל שאלה לשלב נפרד ויוסיף רמזים וכללי אצבע.</span>
            <button type="button" id="study-create-from-text-btn" class="primary-btn study-create-unit-btn">
              <span>✨ סדר את החומר וצור יחידה יומית</span>
            </button>
          </div>
        </div>
      </div>

      <!-- STEP 2: Calming Async Transition Screen (Loading Overlay) -->
      <div id="study-calming-overlay" class="study-calming-overlay" style="display: none;" role="status" aria-live="polite">
        <div class="study-calming-card">
          <div class="study-calming-breathing-circle">🌱</div>
          <h3 class="study-calming-title">
            נושמים עמוק... מאמן ה-AI מסדר עבורך את החומר של היום ליחידה פשוטה וברורה 🌱
          </h3>
          <p class="study-calming-subtitle">
            אנחנו מחלצים את השאלות, מכינים כללי אצבע בגובה העיניים ומארגנים הכל צעד אחר צעד בקצב שלך...
          </p>
        </div>
      </div>

      <!-- Daily Cards List (Below the Upload Box) -->
      <div class="study-daily-cards-section">
        <div class="study-daily-cards-header">
          <h3 class="study-daily-cards-title">🗂️ יחידות התרגול היומיות של דניאל (${dailyCards.length})</h3>
        </div>

        <div id="study-daily-cards-list" class="study-daily-cards-list">
          ${dailyCards.length === 0 ? `
            <div class="card study-empty-cards-placeholder">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📥 ✨</div>
              <h4>עדיין לא הועלה חומר לימוד היום</h4>
              <p>לחץ למעלה על <strong>"העלאת PDF סרוק או תמונות"</strong> או על <strong>"הדבקת טקסט ישירה"</strong> כדי ליצור את כרטיס הלימוד הראשון שלך!</p>
            </div>
          ` : dailyCards.map((card, cIdx) => {
            const questions = Array.isArray(card.questions) ? card.questions : [];
            const completedQ = questions.filter(q => q.isCompleted).length;
            const totalQ = questions.length;
            const isCardDone = totalQ > 0 && completedQ === totalQ;

            return `
              <div class="unit-card study-daily-card ${card.isNew ? 'is-new-card' : ''} ${isCardDone ? 'completed-unit' : 'active-unit'}" data-daily-card-id="${card.id}">
                <div class="unit-card-info">
                  <span class="unit-status-icon">${isCardDone ? '🟢' : '📘'}</span>
                  <div>
                    <div class="study-card-badges-row">
                      ${card.isNew ? `<span class="badge-new-card">חדש ✨</span>` : ''}
                      <span class="badge-tag">📅 ${card.dateLabel || todayFormatted}</span>
                      <span class="badge-tag" style="background:#e0f2fe;color:#0369a1;">
                        ${card.sourceType === 'pdf_or_image' ? '📄 מתוך קובץ / סריקה' : '📋 מתוך טקסט שהודבק'}
                      </span>
                      <span class="badge-tag" style="background:#f0fdf4;color:#047857;">
                        הושלמו ${completedQ} מתוך ${totalQ} שאלות
                      </span>
                    </div>
                    <h3 class="unit-name-title">${card.title || `יחידת תרגול #${cIdx + 1}`}</h3>
                    <span class="unit-skills-preview">
                      ${(card.introAndRules && card.introAndRules[0]) ? `💡 ${card.introAndRules[0]}` : 'כולל כללי אצבע והקדמה + תרגול מונחה שאלה אחר שאלה'}
                    </span>
                  </div>
                </div>
                <div class="day-action-box">
                  <button type="button" class="primary-btn enter-daily-card-btn" data-card-id="${card.id}">
                    <span>היכנס ליחידת התרגול ▶</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Wire Button 1: File Picker for PDF / Images
  const uploadPdfBtn = container.querySelector('#study-upload-pdf-btn');
  const fileInput = container.querySelector('#study-file-upload-input');
  if (uploadPdfBtn && fileInput) {
    uploadPdfBtn.onclick = () => {
      fileInput.value = '';
      fileInput.click();
    };

    fileInput.onchange = async () => {
      const files = Array.from(fileInput.files || []);
      if (files.length === 0) return;

      const fileImagesBase64 = [];
      for (const f of files.slice(0, 5)) {
        try {
          const b64Obj = await readFileAsBase64Obj(f);
          if (b64Obj && b64Obj.data) {
            fileImagesBase64.push(b64Obj);
          }
        } catch (readErr) {
          console.warn('[StudyHelp] Could not read file as base64:', readErr);
        }
      }

      const primaryName = files.map(f => f.name).join(', ');
      await createDailyCardFromInput({
        rawText: '',
        fileImagesBase64,
        fileName: primaryName,
        sourceType: 'pdf_or_image',
        container
      });
    };
  }

  // Wire Button 2: Toggle Paste Panel & Create Daily Card from Pasted Text
  const togglePasteBtn = container.querySelector('#study-toggle-paste-btn');
  const pastePanel = container.querySelector('#study-paste-panel');
  const pasteTextarea = container.querySelector('#study-paste-textarea');
  const createFromTextBtn = container.querySelector('#study-create-from-text-btn');

  if (togglePasteBtn && pastePanel) {
    togglePasteBtn.onclick = () => {
      const isHidden = pastePanel.style.display === 'none';
      pastePanel.style.display = isHidden ? 'flex' : 'none';
      if (isHidden && pasteTextarea) {
        pasteTextarea.focus();
      }
    };
  }

  if (createFromTextBtn && pasteTextarea) {
    createFromTextBtn.onclick = async () => {
      const pasted = pasteTextarea.value.trim();
      if (!pasted) {
        showToast('דניאל, הדבק או כתוב תחילה את השאלות והחומר בתיבת הטקסט ✍️', 'warning');
        pasteTextarea.focus();
        return;
      }
      createFromTextBtn.disabled = true;
      await createDailyCardFromInput({
        rawText: pasted,
        fileImagesBase64: [],
        fileName: '',
        sourceType: 'pasted_text',
        container
      });
    };
  }

  // Wire clicking the Daily Study Card or its "היכנס ליחידת התרגול ▶" button
  container.querySelectorAll('.study-daily-card').forEach(cardEl => {
    cardEl.onclick = () => {
      const cardId = cardEl.getAttribute('data-daily-card-id');
      if (cardId && typeof openDailyStudyCard === 'function') {
        openDailyStudyCard(cardId);
      }
    };
  });

  container.querySelectorAll('.enter-daily-card-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const cardId = btn.getAttribute('data-card-id');
      if (cardId && typeof openDailyStudyCard === 'function') {
        openDailyStudyCard(cardId);
      }
    };
  });
}

function renderRoadmap() {
  const container = document.getElementById('units-grid');
  if (!container) return;
  container.innerHTML = '';

  const activeTrack = getActiveTrack();
  const cpBadgeBox = document.getElementById('checkpoints-progress-pill');

  if (activeTrack.id === 'study_help' || activeTrack.engine === 'study_help' || appState.currentTrack === 'study_help') {
    if (cpBadgeBox) cpBadgeBox.style.display = 'none';

    const titleEl = document.querySelector('.roadmap-title');
    if (titleEl) titleEl.textContent = 'עזרה בלימודים ושיעורי בית עם מאמן ה-AI 🎓';
    const subEl = document.querySelector('.roadmap-subtitle');
    if (subEl) subEl.textContent = 'העלאת החומר של היום, כללי אצבע בגובה העיניים ותרגול מונחה צעד אחר צעד';

    const cardsCount = Array.isArray(appState.studyHelp?.dailyCards) ? appState.studyHelp.dailyCards.length : 0;
    const unitsText = document.getElementById('units-stat-text');
    if (unitsText) unitsText.textContent = `${cardsCount} יחידות יומיות`;

    const bar = document.getElementById('weekly-progress-bar');
    if (bar) bar.style.width = '100%';

    renderStudyHelpWorkspace(container);
    return;
  }

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

    // פונקציית עזר ליצירת כרטיס המבחן המסכם האוטומטי בהנהלת חשבונות
    const buildAccountingSummaryExamCard = () => {
      const examState = appState.accountingExam || { activeExam: null, attempts: [], bestScore: 0, isPassed: false };
      const attemptsCount = Array.isArray(examState.attempts) ? examState.attempts.length : 0;
      const bestScore = Number(examState.bestScore) || 0;
      const hasOpenExam = !!(examState.activeExam && Array.isArray(examState.activeExam.questions) && examState.activeExam.questions.length > 0);
      const isPassedExam = !!examState.isPassed || bestScore >= 80;

      const examCard = document.createElement('div');
      examCard.className = `checkpoint-card accounting-summary-exam-card ${isPassedExam ? 'passed' : ''}`;
      examCard.innerHTML = `
        <div class="checkpoint-info">
          <span style="font-size: 2.4rem; line-height: 1;">🏆</span>
          <div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem;">
              <span class="badge-tag" style="background:#fef3c7;color:#b45309;">
                ${isPassedExam ? `עברת בהצלחה! שיא ציון: ${bestScore}% ⭐` : 'מבחן מסכם אוטומטי AI (ציון מעבר: 80+)'}
              </span>
              <span class="badge-tag" style="background:#e0f2fe;color:#0369a1;">
                📊 ניסיונות קודמים: ${attemptsCount}
              </span>
              ${bestScore > 0 ? `<span class="badge-tag" style="background:#ecfdf5;color:#047857;">🏅 ציון שיא: ${bestScore}%</span>` : ''}
            </div>
            <h3 class="checkpoint-title">🏆 מבחן מסכם אוטומטי בהנהלת חשבונות</h3>
            <span class="checkpoint-desc">
              סימולציה מקיפה הבוחנת את כל יחידות המסלול: שאלות אמריקאיות, חישובי מע"מ והנחות, ואיזון פקודות יומן עם בדיקה ומשוב אוטומטי.
            </span>
          </div>
        </div>
        <div class="day-action-box" style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
          ${hasOpenExam ? `
            <button type="button" class="primary-btn accounting-resume-exam-btn" style="padding: 0.65rem 1.25rem; font-size: 1rem; min-height: 44px; background: #0f766e;">
              <span>המשך מבחן פתוח 📝</span>
            </button>
            <button type="button" class="secondary-btn accounting-new-exam-btn" style="padding: 0.55rem 1rem; font-size: 0.92rem; min-height: 42px;">
              <span>התחל מבחן מסכם חדש 🔄</span>
            </button>
          ` : `
            <button type="button" class="primary-btn accounting-start-exam-btn" style="padding: 0.65rem 1.3rem; font-size: 1rem; min-height: 44px; background: #d97706;">
              <span>התחל מבחן מסכם חדש ▶</span>
            </button>
          `}
        </div>
      `;

      const resumeBtn = examCard.querySelector('.accounting-resume-exam-btn');
      const newBtn = examCard.querySelector('.accounting-new-exam-btn');
      const startBtn = examCard.querySelector('.accounting-start-exam-btn');

      if (resumeBtn) {
        resumeBtn.onclick = (e) => {
          e.stopPropagation();
          if (typeof openAccountingSummaryExam === 'function') {
            openAccountingSummaryExam(false);
          }
        };
      }
      if (newBtn) {
        newBtn.onclick = (e) => {
          e.stopPropagation();
          if (typeof openAccountingSummaryExam === 'function') {
            openAccountingSummaryExam(true);
          }
        };
      }
      if (startBtn) {
        startBtn.onclick = (e) => {
          e.stopPropagation();
          if (typeof openAccountingSummaryExam === 'function') {
            openAccountingSummaryExam(true);
          }
        };
      }
      return examCard;
    };

    // הצגת כרטיס המבחן המסכם גם בראש המסלול לנראות מיידית
    container.appendChild(buildAccountingSummaryExamCard());

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

    // הצגת כרטיס המבחן המסכם גם בתחתית רשימת היחידות
    container.appendChild(buildAccountingSummaryExamCard());

    const unitsText = document.getElementById('units-stat-text');
    if (unitsText) unitsText.textContent = `${completedCount} מתוך ${units.length} יחידות`;

    const bar = document.getElementById('weekly-progress-bar');
    if (bar) bar.style.width = `${(completedCount / Math.max(1, units.length)) * 100}%`;
  }
}

