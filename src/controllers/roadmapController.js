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
        appState.currentTrack = track.id;
        saveAppState();
        renderTrackTabs();
        renderRoadmap();
      }
    };
    container.appendChild(btn);
  });
}

const STUDY_HELP_SUBJECTS = [
  'הנהלת חשבונות 📊',
  'שימוש ב-AI ומחשבים 🤖',
  'מתמטיקה וחישובים 🧮',
  'אנגלית וניסוח 📝',
  'שאלה כללית 💡'
];

const STUDY_HELP_STARTERS = [
  'תסביר לי מושג בהנהלת חשבונות בצורה פשוטה',
  'עזור לי לפתור תרגיל שלב אחר שלב',
  'תעשה לי תרגול קצר של 3 שאלות על נושא שלמדתי',
  'תן לי דוגמה פשוטה לחישוב מע"מ ופקודת יומן'
];

function formatStudyMessageHtml(text) {
  const safe = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return safe
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function renderStudyHelpWorkspace(container) {
  if (!appState.studyHelp || typeof appState.studyHelp !== 'object') {
    appState.studyHelp = { sessions: [], activeSessionId: null, savedNotes: [], totalQuestionsAsked: 0 };
  }

  let activeSession = getOrCreateStudySession();
  const currentSubject = activeSession.subject && STUDY_HELP_SUBJECTS.includes(activeSession.subject)
    ? activeSession.subject
    : STUDY_HELP_SUBJECTS[0];
  activeSession.subject = currentSubject;

  const sessions = Array.isArray(appState.studyHelp.sessions) ? appState.studyHelp.sessions : [];
  const messages = Array.isArray(activeSession.messages) ? activeSession.messages : [];

  container.innerHTML = `
    <div class="study-help-workspace card">
      <!-- Top Subject Selector -->
      <div class="study-help-section">
        <div class="study-help-section-header">
          <h3 class="study-help-section-title">1. בחר תחום לימוד או מקצוע 🎯</h3>
          <button type="button" id="study-new-session-btn" class="secondary-btn study-new-session-btn">
            <span>➕ שיחה חדשה</span>
          </button>
        </div>
        <div class="study-subject-chips" role="tablist" aria-label="תחומי לימוד">
          ${STUDY_HELP_SUBJECTS.map(subj => `
            <button type="button" class="study-subject-chip ${subj === currentSubject ? 'active' : ''}" data-subject="${subj}">
              <span>${subj}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Quick Prompt Starters -->
      <div class="study-help-section">
        <h4 class="study-help-subheadline">💡 פתיחה מהירה — לחץ על בקשה מוכנה או כתוב שאלה משלך למטה:</h4>
        <div class="study-starter-grid">
          ${STUDY_HELP_STARTERS.map(starter => `
            <button type="button" class="study-starter-btn" data-starter="${starter.replace(/"/g, '&quot;')}">
              <span>✨ ${starter}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Recent Sessions Bar (if more than 1 session) -->
      ${sessions.length > 1 ? `
        <div class="study-sessions-bar">
          <span class="study-sessions-label">📂 שיחות אחרונות:</span>
          <div class="study-sessions-list">
            ${sessions.slice(0, 5).map(s => `
              <button type="button" class="study-session-pill ${s.id === activeSession.id ? 'active' : ''}" data-session-id="${s.id}">
                <span>${s.title || s.subject || 'שיחה'} (${(s.messages || []).length})</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Interactive Conversation Area -->
      <div class="study-chat-feed" id="study-chat-feed">
        ${messages.length === 0 ? `
          <div class="study-welcome-empty">
            <div class="study-welcome-icon">🎓</div>
            <h4>שלום דניאל! אני כאן כדי לעזור לך בכל שאלה או שיעורי בית</h4>
            <p>אפשר להעתיק לכאן שאלה מתרגיל, לבקש הסבר פשוט למושג שלא היה ברור, או לבקש תרגול מונחה צעד אחר צעד בנושא <strong>${currentSubject}</strong>.</p>
          </div>
        ` : messages.map((msg, mIdx) => `
          <div class="study-msg-bubble ${msg.role === 'user' ? 'user-msg' : 'assistant-msg'}" data-msg-idx="${mIdx}">
            <div class="study-msg-header">
              <span class="study-msg-author">
                ${msg.role === 'user' ? '👤 דניאל' : '🤖 מאמן הלמידה האישי'}
              </span>
              ${msg.role !== 'user' ? `
                <button type="button" class="study-tts-msg-btn" data-tts-idx="${mIdx}" title="הקרא תשובה זו">
                  🔊 הקרא לי
                </button>
              ` : ''}
            </div>
            <div class="study-msg-content">${formatStudyMessageHtml(msg.text)}</div>
          </div>
        `).join('')}
      </div>

      <!-- Question Input & Submit -->
      <div class="study-input-panel">
        <label for="study-help-textarea" class="study-input-label">
          ✍️ כתוב כאן את השאלה או התרגיל שלך (תחום פעיל: <strong>${currentSubject}</strong>):
        </label>
        <textarea
          id="study-help-textarea"
          class="styled-textarea study-help-textarea"
          rows="3"
          placeholder="לדוגמה: איך רושמים פקודת יומן כשקונים סחורה מספק עם מע״מ?"
        ></textarea>
        <div class="study-input-actions">
          <span class="study-input-hint">טיפ: אפשר לבקש "תסביר לי ב-3 צעדים פשוטים" או "תן לי דוגמה עם מספרים" 🌟</span>
          <button type="button" id="study-help-submit-btn" class="primary-btn study-submit-btn">
            <span>שלח שאלה למאמן ה-AI 🚀</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Wire Subject Selector Chips
  container.querySelectorAll('.study-subject-chip').forEach(chip => {
    chip.onclick = () => {
      const chosenSubj = chip.getAttribute('data-subject') || STUDY_HELP_SUBJECTS[0];
      activeSession.subject = chosenSubj;
      activeSession.title = `עזרה בלימודים: ${chosenSubj}`;
      saveAppState();
      renderStudyHelpWorkspace(container);
    };
  });

  // Wire New Session Button
  const newSessionBtn = container.querySelector('#study-new-session-btn');
  if (newSessionBtn) {
    newSessionBtn.onclick = () => {
      const now = new Date().toISOString();
      const freshSession = {
        id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: `עזרה בלימודים: ${currentSubject}`,
        subject: currentSubject,
        createdAt: now,
        updatedAt: now,
        messages: []
      };
      appState.studyHelp.sessions.unshift(freshSession);
      appState.studyHelp.activeSessionId = freshSession.id;
      saveAppState();
      showToast('נפתחה שיחת למידה חדשה ונקייה! ✨');
      renderStudyHelpWorkspace(container);
    };
  }

  // Wire Recent Session Pills
  container.querySelectorAll('.study-session-pill').forEach(pill => {
    pill.onclick = () => {
      const sid = pill.getAttribute('data-session-id');
      if (sid && sid !== activeSession.id) {
        appState.studyHelp.activeSessionId = sid;
        saveAppState();
        renderStudyHelpWorkspace(container);
      }
    };
  });

  // Wire Quick Prompt Starters
  const textarea = container.querySelector('#study-help-textarea');
  container.querySelectorAll('.study-starter-btn').forEach(btn => {
    btn.onclick = () => {
      const starterText = btn.getAttribute('data-starter') || '';
      if (textarea) {
        textarea.value = starterText;
        textarea.focus();
      }
    };
  });

  // Wire TTS buttons on assistant messages
  container.querySelectorAll('.study-tts-msg-btn').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.getAttribute('data-tts-idx'));
      const msg = messages[idx];
      if (msg && msg.text && typeof SoundService !== 'undefined') {
        SoundService.speakText(msg.text.replace(/[*#]/g, ''));
      }
    };
  });

  // Wire Submit Button
  const submitBtn = container.querySelector('#study-help-submit-btn');
  const chatFeed = container.querySelector('#study-chat-feed');

  const handleSendQuestion = async () => {
    if (!textarea || !submitBtn) return;
    const qText = textarea.value.trim();
    if (!qText) {
      showToast('דניאל, כתוב שאלה או בחר אחת מהבקשות המוכנות למעלה ✍️');
      textarea.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>המאמן מכין הסבר... ⏳</span>';
    textarea.disabled = true;

    saveStudyMessage(activeSession.id, 'user', qText, { subject: currentSubject });

    if (chatFeed) {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'study-msg-bubble assistant-msg loading';
      loadingDiv.innerHTML = `
        <div class="study-msg-header">
          <span class="study-msg-author">🤖 מאמן הלמידה האישי</span>
        </div>
        <div class="study-msg-content">מעבד את השאלה שלך ומכין הסבר פשוט וברור צעד אחר צעד... ⏳</div>
      `;
      chatFeed.appendChild(loadingDiv);
      chatFeed.scrollTop = chatFeed.scrollHeight;
    }

    try {
      const historyPrior = activeSession.messages.slice(0, -1);
      const res = await AIService.askStudyHelper({
        subject: currentSubject,
        question: qText,
        conversationHistory: historyPrior
      });

      saveStudyMessage(activeSession.id, 'assistant', res.reply, {
        subject: currentSubject,
        provider: res.provider,
        isFallback: res.isFallback
      });

      if (typeof SoundService !== 'undefined') {
        SoundService.playSuccessSound();
      }
    } catch (err) {
      console.error('[StudyHelp] Unexpected error:', err);
      saveStudyMessage(
        activeSession.id,
        'assistant',
        'שלום דניאל! בוא נפרק את השאלה יחד לצעדים פשוטים: קודם נזהה את הנתונים בשאלה, ולאחר מכן נבדוק מה הפעולה הנדרשת.',
        { subject: currentSubject, provider: 'offline', isFallback: true }
      );
    }

    const unitsText = document.getElementById('units-stat-text');
    if (unitsText) {
      unitsText.textContent = `${appState.studyHelp.totalQuestionsAsked || 0} שאלות שנשאלו`;
    }

    renderStudyHelpWorkspace(container);
    const updatedFeed = container.querySelector('#study-chat-feed');
    if (updatedFeed) {
      updatedFeed.scrollTop = updatedFeed.scrollHeight;
    }
  };

  if (submitBtn) {
    submitBtn.onclick = handleSendQuestion;
  }
  if (textarea) {
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSendQuestion();
      }
    });
  }
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
    if (subEl) subEl.textContent = 'הסבר מושגים בגובה העיניים, פתרון תרגילים צעד אחר צעד ותרגול מונחה בקצב שלך';

    const totalAsked = appState.studyHelp?.totalQuestionsAsked || 0;
    const unitsText = document.getElementById('units-stat-text');
    if (unitsText) unitsText.textContent = `${totalAsked} שאלות שנשאלו`;

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

    // כרטיס מבחן מסכם אוטומטי בהנהלת חשבונות
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

    container.appendChild(examCard);

    const unitsText = document.getElementById('units-stat-text');
    if (unitsText) unitsText.textContent = `${completedCount} מתוך ${units.length} יחידות`;

    const bar = document.getElementById('weekly-progress-bar');
    if (bar) bar.style.width = `${(completedCount / Math.max(1, units.length)) * 100}%`;
  }
}

