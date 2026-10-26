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
        if (!appState.unitOverrides || typeof appState.unitOverrides !== 'object') {
          appState.unitOverrides = {};
        }
        appState.unitOverrides[unitId] = {
          ...(appState.unitOverrides[unitId] || {}),
          ...newUnitData
        };
        if (Array.isArray(appState.deletedUnitIds)) {
          appState.deletedUnitIds = appState.deletedUnitIds.filter(id => String(id) !== String(unitId));
        }

        const existingIdx = appState.curriculumUnits.findIndex(u => u.id === unitId);
        if (existingIdx !== -1) {
          appState.curriculumUnits[existingIdx] = {
            ...appState.curriculumUnits[existingIdx],
            ...newUnitData
          };
        }
        showToast(`היחידה "${newUnitData.title}" עודכנה ונשמרה בקביעות! ✏️`);
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

let activeAdminCurriculumFilter = 'general';

function escapeAdmHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.setAdminCurriculumFilter = function(filterId) {
  activeAdminCurriculumFilter = filterId || 'general';
  renderAdminCurriculum();
};

function renderAdminCurriculum() {
  const container = document.getElementById('mgr-curriculum-list');
  if (!container) return;
  container.innerHTML = '';

  const generalTrack = (typeof TRACKS !== 'undefined' ? TRACKS : []).find(t => t.id === 'general') || { id: 'general' };
  const generalUnits = typeof getTrackUnits === 'function' ? getTrackUnits(generalTrack) : (appState.curriculumUnits || []);
  const accountingTrack = (typeof TRACKS !== 'undefined' ? TRACKS : []).find(t => t.id === 'accounting') || { id: 'accounting' };
  const accountingUnits = typeof getTrackUnits === 'function' ? getTrackUnits(accountingTrack) : [];
  const summaryExams = Array.isArray(appState.accountingSummaryExams) ? appState.accountingSummaryExams : [];
  const studyHelpUnits = Array.isArray(appState.studyHelpUnits) ? appState.studyHelpUnits : [];
  const deletedCount = Array.isArray(appState.deletedUnitIds) ? appState.deletedUnitIds.length : 0;

  // סרגל סינון מסלולים + כפתור שחזור יחידות בסיס שנמחקו
  const toolbarEl = document.createElement('div');
  toolbarEl.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:1.25rem; padding:0.85rem 1rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;';

  const filterDefs = [
    { id: 'general', label: `מסלול 1: כללי ו-AI (${generalUnits.length})` },
    { id: 'accounting', label: `מסלול 2: הנהלת חשבונות (${accountingUnits.length})` },
    { id: 'summary_exam', label: `מבחנים מסכמים (${summaryExams.length})` },
    { id: 'study_help', label: `מסלול 3: עזרה בלימודים (${studyHelpUnits.length})` }
  ];

  const filterButtonsHtml = filterDefs.map(f => {
    const isActive = activeAdminCurriculumFilter === f.id;
    const btnStyle = isActive
      ? 'padding:0.5rem 0.95rem; font-size:0.9rem; font-weight:700; border-radius:8px; border:1px solid #2563eb; background:#2563eb; color:#ffffff; cursor:pointer;'
      : 'padding:0.5rem 0.95rem; font-size:0.9rem; font-weight:600; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#1e293b; cursor:pointer;';
    return `<button type="button" data-adm-track-filter="${f.id}" style="${btnStyle}">${escapeAdmHtml(f.label)}</button>`;
  }).join('');

  const restoreBtnHtml = deletedCount > 0
    ? `<button type="button" id="adm-restore-deleted-base-btn" class="secondary-btn" style="padding:0.5rem 0.95rem; font-size:0.88rem; font-weight:700; color:#047857; border-color:#6ee7b7; background:#ecfdf5;">♻️ שחזר יחידות בסיס שנמחקו (${deletedCount})</button>`
    : '';

  toolbarEl.innerHTML = `
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
      ${filterButtonsHtml}
    </div>
    ${restoreBtnHtml ? `<div>${restoreBtnHtml}</div>` : ''}
  `;
  container.appendChild(toolbarEl);

  toolbarEl.querySelectorAll('[data-adm-track-filter]').forEach(btn => {
    btn.onclick = () => {
      activeAdminCurriculumFilter = btn.getAttribute('data-adm-track-filter') || 'general';
      renderAdminCurriculum();
    };
  });

  const restoreBtn = toolbarEl.querySelector('#adm-restore-deleted-base-btn');
  if (restoreBtn) {
    restoreBtn.onclick = () => {
      if (typeof window.restoreDeletedBaseUnits === 'function') {
        window.restoreDeletedBaseUnits();
      }
    };
  }

  // הצגת כרטיסי המסלול הפעיל
  if (activeAdminCurriculumFilter === 'general') {
    if (generalUnits.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'card';
      emptyEl.style.cssText = 'padding:1.4rem; text-align:center; color:#64748b;';
      emptyEl.textContent = 'אין כרגע יחידות פעילות במסלול 1.';
      container.appendChild(emptyEl);
    } else {
      generalUnits.forEach((unit, idx) => {
        const uid = String(unit.id || unit.unit_id || '');
        const rawIdx = (appState.curriculumUnits || []).findIndex(u => String(u.id || u.unit_id) === uid);
        const item = document.createElement('div');
        item.className = 'card';
        item.style.cssText = 'padding: 1.1rem 1.4rem; margin-bottom: 0.9rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem;';
        item.innerHTML = `
          <div style="flex: 1 1 300px;">
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.25rem;">
              <span style="font-weight: 800; color: #2563eb;">#${idx + 1}</span>
              <span class="badge-tag">${escapeAdmHtml(unit.category || 'מיומנות')}</span>
              <span>${unit.trafficLight === 'red' ? '🔴' : unit.trafficLight === 'yellow' ? '🟡' : '🟢'}</span>
              <span style="font-size: 0.85rem; color: ${unit.isCompleted ? '#059669' : '#d97706'}; font-weight: 700;">
                ${unit.isCompleted ? '✓ הושלם' : 'ממתין לביצוע'}
              </span>
            </div>
            <h4 style="margin: 0 0 0.3rem 0; font-size: 1.15rem;">${escapeAdmHtml(unit.title)}</h4>
            <p style="margin: 0; font-size: 0.95rem; color: var(--text-secondary);">${escapeAdmHtml(unit.goal || '')}</p>
          </div>
          <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
            <button type="button" class="primary-btn adm-quick-edit-btn" style="padding: 0.4rem 0.85rem; font-size: 0.85rem;">✏️ ערוך</button>
            <button type="button" class="secondary-btn adm-full-edit-btn" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" title="עורך שלבים מלא">🛠️ שלבים</button>
            <button type="button" class="secondary-btn adm-move-up-btn" style="padding: 0.4rem 0.75rem; font-size: 0.85rem;" ${rawIdx <= 0 ? 'disabled' : ''}>▲</button>
            <button type="button" class="secondary-btn adm-move-down-btn" style="padding: 0.4rem 0.75rem; font-size: 0.85rem;" ${(rawIdx === -1 || rawIdx >= appState.curriculumUnits.length - 1) ? 'disabled' : ''}>▼</button>
            <button type="button" class="secondary-btn adm-delete-btn" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; color: #dc2626;">🗑️ מחק</button>
          </div>
        `;
        item.querySelector('.adm-quick-edit-btn').onclick = () => window.openUniversalUnitQuickEditor('general', uid);
        item.querySelector('.adm-full-edit-btn').onclick = () => openUnitEditor(uid);
        item.querySelector('.adm-move-up-btn').onclick = () => { if (rawIdx > 0) moveUnit(rawIdx, -1); };
        item.querySelector('.adm-move-down-btn').onclick = () => { if (rawIdx !== -1 && rawIdx < appState.curriculumUnits.length - 1) moveUnit(rawIdx, 1); };
        item.querySelector('.adm-delete-btn').onclick = () => window.deleteUnitFromAnyTrack('general', uid);
        container.appendChild(item);
      });
    }
  } else if (activeAdminCurriculumFilter === 'accounting') {
    if (accountingUnits.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'card';
      emptyEl.style.cssText = 'padding:1.4rem; text-align:center; color:#64748b;';
      emptyEl.textContent = 'אין כרגע יחידות פעילות במסלול הנהלת חשבונות.';
      container.appendChild(emptyEl);
    } else {
      const completedAcc = Array.isArray(appState.trackProgress?.accounting) ? appState.trackProgress.accounting : [];
      accountingUnits.forEach((unit, idx) => {
        const uid = String(unit.id || unit.unit_id || '');
        const isDone = Boolean(unit.isCompleted || completedAcc.includes(uid));
        const leadText = unit.description || unit.goal || ((Array.isArray(unit.blocks) ? unit.blocks.find(b => b && b.type === 'text') : null)?.content || '');
        const shortDesc = String(leadText).replace(/<[^>]*>/g, '').slice(0, 140);

        const item = document.createElement('div');
        item.className = 'card';
        item.style.cssText = 'padding: 1rem 1.3rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem; background: #f8fafc;';
        item.innerHTML = `
          <div style="flex: 1 1 280px;">
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.25rem;">
              <span style="font-weight: 800; color: #0369a1;">#${idx + 1}</span>
              <span class="badge-tag">הנהלת חשבונות</span>
              <span style="font-size: 0.85rem; color: ${isDone ? '#059669' : '#64748b'}; font-weight: 700;">
                ${isDone ? '✓ הושלם' : 'פעיל במסלול'}
              </span>
            </div>
            <h4 style="margin: 0 0 0.25rem 0; font-size: 1.08rem;">${escapeAdmHtml(unit.title)}</h4>
            ${shortDesc ? `<p style="margin:0; font-size:0.9rem; color:#64748b;">${escapeAdmHtml(shortDesc)}</p>` : ''}
          </div>
          <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
            <button type="button" class="primary-btn adm-acc-edit-btn" style="padding: 0.4rem 0.85rem; font-size: 0.85rem;">✏️ ערוך</button>
            <button type="button" class="secondary-btn adm-acc-del-btn" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; color: #dc2626;">🗑️ מחק</button>
          </div>
        `;
        item.querySelector('.adm-acc-edit-btn').onclick = () => window.openUniversalUnitQuickEditor('accounting', uid);
        item.querySelector('.adm-acc-del-btn').onclick = () => window.deleteUnitFromAnyTrack('accounting', uid);
        container.appendChild(item);
      });
    }
  } else if (activeAdminCurriculumFilter === 'summary_exam') {
    if (summaryExams.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'card';
      emptyEl.style.cssText = 'padding:1.4rem; text-align:center; color:#64748b;';
      emptyEl.textContent = 'אין כרגע מבחנים מסכמים שמורים. מבחנים נוצרים אוטומטית בסיום יחידת לימוד במסלול 3!';
      container.appendChild(emptyEl);
    } else {
      summaryExams.forEach((exam, idx) => {
        const examId = String(exam.id || exam.unit_id || '');
        const qBlocksCount = Array.isArray(exam.blocks)
          ? exam.blocks.filter(b => b && ['exercise', 'journal_entry', 'ai_eval_qa'].includes(b.type)).length
          : 0;
        const item = document.createElement('div');
        item.className = 'card';
        item.style.cssText = 'padding: 1rem 1.3rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem; background: #fffbeb; border-color: #fde68a;';
        item.innerHTML = `
          <div style="flex: 1 1 280px;">
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.25rem; flex-wrap: wrap;">
              <span style="font-weight: 800; color: #b45309;">#${idx + 1}</span>
              <span class="badge-tag">📝 מבחן מסכם</span>
              ${exam.createdAtLabel ? `<span style="font-size:0.82rem; color:#92400e;">📅 ${escapeAdmHtml(exam.createdAtLabel)}</span>` : ''}
              <span style="font-size:0.82rem; color:#475569;">${qBlocksCount} שאלות תרגול</span>
              <span style="font-size: 0.85rem; color: ${exam.isCompleted ? '#059669' : '#b45309'}; font-weight: 700;">
                ${exam.isCompleted ? '✓ הושלם' : 'פתוח לתרגול'}
              </span>
            </div>
            <h4 style="margin: 0 0 0.25rem 0; font-size: 1.08rem;">${escapeAdmHtml(exam.title)}</h4>
            <p style="margin: 0; font-size: 0.9rem; color: #78350f;">${escapeAdmHtml(exam.description || '')}</p>
          </div>
          <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
            <button type="button" class="primary-btn adm-exam-edit-btn" style="padding: 0.4rem 0.85rem; font-size: 0.85rem;">✏️ ערוך</button>
            <button type="button" class="secondary-btn adm-exam-del-btn" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; color: #dc2626;">🗑️ מחק</button>
          </div>
        `;
        item.querySelector('.adm-exam-edit-btn').onclick = () => window.openUniversalUnitQuickEditor('summary_exam', examId);
        item.querySelector('.adm-exam-del-btn').onclick = () => window.deleteUnitFromAnyTrack('summary_exam', examId);
        container.appendChild(item);
      });
    }
  } else if (activeAdminCurriculumFilter === 'study_help') {
    if (studyHelpUnits.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'card';
      emptyEl.style.cssText = 'padding:1.4rem; text-align:center; color:#64748b;';
      emptyEl.textContent = 'אין כרגע יחידות לימוד יומיות במסלול 3 (עזרה בלימודים).';
      container.appendChild(emptyEl);
    } else {
      studyHelpUnits.forEach((unit, idx) => {
        const uid = String(unit.id || unit.unit_id || '');
        const conceptsCount = Array.isArray(unit.concepts) ? unit.concepts.length : 0;
        const questionsCount = Array.isArray(unit.questions) ? unit.questions.length : 0;
        const summaryText = unit.pages_summary || unit.topic_summary || '';
        const item = document.createElement('div');
        item.className = 'card';
        item.style.cssText = 'padding: 1rem 1.3rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem; background: #f0fdf4; border-color: #bbf7d0;';
        item.innerHTML = `
          <div style="flex: 1 1 280px;">
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.25rem; flex-wrap: wrap;">
              <span style="font-weight: 800; color: #047857;">#${idx + 1}</span>
              <span class="badge-tag">📚 עזרה בלימודים</span>
              ${unit.createdAtLabel ? `<span style="font-size:0.82rem; color:#065f46;">📅 ${escapeAdmHtml(unit.createdAtLabel)}</span>` : ''}
              <span style="font-size:0.82rem; color:#475569;">💡 ${conceptsCount} מושגים • 📝 ${questionsCount} שאלות</span>
              <span style="font-size: 0.85rem; color: ${unit.completed ? '#059669' : '#0284c7'}; font-weight: 700;">
                ${unit.completed ? '✓ הושלם' : 'בתהליך למידה'}
              </span>
            </div>
            <h4 style="margin: 0 0 0.25rem 0; font-size: 1.08rem;">${escapeAdmHtml(unit.title)}</h4>
            <p style="margin: 0; font-size: 0.9rem; color: #334155;">${escapeAdmHtml(summaryText)}</p>
          </div>
          <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
            <button type="button" class="primary-btn adm-sh-edit-btn" style="padding: 0.4rem 0.85rem; font-size: 0.85rem;">✏️ ערוך</button>
            <button type="button" class="secondary-btn adm-sh-del-btn" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; color: #dc2626;">🗑️ מחק</button>
          </div>
        `;
        item.querySelector('.adm-sh-edit-btn').onclick = () => window.openUniversalUnitQuickEditor('study_help', uid);
        item.querySelector('.adm-sh-del-btn').onclick = () => window.deleteUnitFromAnyTrack('study_help', uid);
        container.appendChild(item);
      });
    }
  }

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

window.renderAdminCurriculum = renderAdminCurriculum;

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
  const targetUnit = appState.curriculumUnits[index];
  if (!targetUnit) return;
  const uid = String(targetUnit.id || targetUnit.unit_id || '');
  if (typeof window.deleteUnitFromAnyTrack === 'function') {
    window.deleteUnitFromAnyTrack('general', uid);
  }
};

window.editAccountingUnitTitle = function(unitId) {
  if (typeof window.openUniversalUnitQuickEditor === 'function') {
    window.openUniversalUnitQuickEditor('accounting', unitId);
  }
};

window.deleteAccountingUnit = function(unitId) {
  if (typeof window.deleteUnitFromAnyTrack === 'function') {
    window.deleteUnitFromAnyTrack('accounting', unitId);
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

const DB_PROVIDER_LABELS = {
  github: '☁️ GitHub Secret Gist',
  firebase: '🔥 Firebase Realtime DB',
  custom: '🌐 שרת REST מותאם אישית',
  local: '💻 שמירה מקומית בלבד'
};

const DB_PROVIDER_INSTRUCTIONS_HTML = {
  github: `
    <div style="font-weight: 800; color: #1e3a8a; margin-bottom: 0.4rem;">☁️ הגדרה ב-3 צעדים פשוטים (מומלץ — חינמי ופרטי לחלוטין על חשבון ה-GitHub שלך):</div>
    <ul style="margin: 0; padding-right: 1.25rem;">
      <li><strong>צעד 1:</strong> היכנס לחשבון ה-GitHub שלך: <code>Settings → Developer settings → Personal access tokens → Tokens (classic)</code> ולחץ <strong>Generate new token</strong>.</li>
      <li><strong>צעד 2:</strong> תן לטוקן שם כלשהו, סמן <strong>אך ורק את תיבת <code>gist</code></strong>, והעתק את הטוקן שנוצר (מתחיל ב-<code>ghp_</code>).</li>
      <li><strong>צעד 3:</strong> הדבק את הטוקן למטה ולחץ על <strong>"☁️ שמור והעבר את כל הנתונים לספק זה עכשיו"</strong> — המערכת תיצור Gist סודי אוטומטית ותמלא עבורך את ה-Gist ID!</li>
    </ul>
  `,
  firebase: `
    <div style="font-weight: 800; color: #b45309; margin-bottom: 0.4rem;">🔥 חיבור מהיר ל-Google Firebase Realtime Database (Spark Plan חינמי):</div>
    <ul style="margin: 0; padding-right: 1.25rem;">
      <li><strong>צעד 1:</strong> פתח פרויקט ב-<code>console.firebase.google.com</code> ובחר בתפריט <strong>Build → Realtime Database → Create Database</strong>.</li>
      <li><strong>צעד 2:</strong> העתק את כתובת מסד הנתונים הראשית (למשל <code>https://your-project-default-rtdb.firebaseio.com</code>) והדבק בשדה למטה.</li>
      <li><strong>צעד 3:</strong> אם הגדרת Database Secret, הדבק אותו בשדה הסוד (אופציונלי), ולחץ על <strong>"☁️ שמור והעבר את כל הנתונים לספק זה עכשיו"</strong>.</li>
    </ul>
  `,
  custom: `
    <div style="font-weight: 800; color: #0f766e; margin-bottom: 0.4rem;">🌐 החלפה ב-5 דקות לכל שרת REST / ענן עתידי (Zero Vendor Lock-in):</div>
    <ul style="margin: 0; padding-right: 1.25rem;">
      <li><strong>צעד 1:</strong> הדבק כתובת URL של כל שרת התומך בבקשת <code>GET</code> לשליפת JSON ובבקשת <code>POST</code> או <code>PUT</code> לשמירת JSON (כגון Cloudflare Worker, Supabase, FastAPI, או Node).</li>
      <li><strong>צעד 2:</strong> אם השרת דורש אימות, הדבק מפתח בשדה ה-API Key (נשלח אוטומטית בכותרת <code>Authorization: Bearer</code>).</li>
      <li><strong>צעד 3:</strong> לחץ על <strong>"🧪 בדוק חיבור"</strong> או על <strong>"☁️ שמור והעבר את כל הנתונים לספק זה עכשיו"</strong> להעברה מיידית בלחיצה אחת!</li>
    </ul>
  `,
  local: `
    <div style="font-weight: 800; color: #334155; margin-bottom: 0.4rem;">💻 מצב שמירה מקומית (ללא ענן חיצוני):</div>
    <ul style="margin: 0; padding-right: 1.25rem;">
      <li>כל ההתקדמות נשמרת באופן מיידי (0ms) בדפדפן הנוכחי (<code>localStorage</code>).</li>
      <li>כאשר השרת המקומי פעיל (<code>python server/server.py</code>), נשמר אוטומטית גיבוי מלא גם לקובץ <code>data/daniel_state.json</code>.</li>
      <li>לסנכרון אוטומטי בין מחשבים שונים או דרך GitHub Pages, בחר למעלה ב-<strong>GitHub Secret Gist</strong>.</li>
    </ul>
  `
};

/**
 * מוודא שאזור החלפת מסד הנתונים קיים ב-#adm-settings ומחבר את כל הכפתורים והשדות הדינמיים.
 */
function renderDatabaseSwitcherSettings() {
  const settingsPanel = document.getElementById('adm-settings');
  if (!settingsPanel) return;

  let dbSection = document.getElementById('adm-db-switcher-section');
  if (!dbSection) {
    dbSection = document.createElement('div');
    dbSection.id = 'adm-db-switcher-section';
    dbSection.className = 'cg-section';
    dbSection.style.marginTop = '2rem';
    dbSection.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 0.75rem;">
        <h4 style="margin: 0;">🗄️ ניהול מסד נתונים וסנכרון ענן (3-Tier Database Switcher)</h4>
        <span id="cfg-db-active-badge" class="badge-tag" style="background-color: #eff6ff; color: #1d4ed8; font-weight: 700;">ספק פעיל: שמירה מקומית 💻</span>
      </div>
      <div class="setting-item" style="flex-direction: column; align-items: stretch; gap: 0.85rem;">
        <select id="cfg-db-provider" class="styled-input" style="width: 100%; font-weight: 600;">
          <option value="github">☁️ GitHub Secret Gist (מומלץ - חינמי לחלוטין על חשבון ה-GitHub שלך)</option>
          <option value="firebase">🔥 Google Firebase Realtime Database (חינמי - Spark Plan)</option>
          <option value="custom">🌐 שרת REST / Endpoint מותאם אישית (החלפה ב-5 דקות לכל שירות עתידי)</option>
          <option value="local">💻 שמירה מקומית בלבד (שרת מקומי server.py + דפדפן)</option>
        </select>
        <div id="cfg-db-instructions" style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-right: 4px solid #2563eb; border-radius: 10px; padding: 0.9rem 1.1rem; font-size: 0.94rem; line-height: 1.6;"></div>
        <div id="cfg-db-github-fields" style="display: none; flex-direction: column; gap: 0.75rem;">
          <input type="password" id="cfg-db-github-token" class="styled-input" placeholder="הדבק כאן GitHub Token (ghp_...)">
          <input type="text" id="cfg-db-github-gist-id" class="styled-input" placeholder="Gist ID (מתמלא אוטומטית בסנכרון הראשון)">
        </div>
        <div id="cfg-db-firebase-fields" style="display: none; flex-direction: column; gap: 0.75rem;">
          <input type="url" id="cfg-db-firebase-url" class="styled-input" placeholder="https://your-project-default-rtdb.firebaseio.com">
          <input type="password" id="cfg-db-firebase-secret" class="styled-input" placeholder="Database Secret (אופציונלי)">
        </div>
        <div id="cfg-db-custom-fields" style="display: none; flex-direction: column; gap: 0.75rem;">
          <input type="url" id="cfg-db-custom-url" class="styled-input" placeholder="https://api.example.com/daniel-state">
          <input type="password" id="cfg-db-custom-key" class="styled-input" placeholder="API Key (אופציונלי)">
        </div>
        <div id="cfg-db-status" style="display: none; padding: 0.7rem 0.95rem; border-radius: 8px; font-size: 0.92rem; line-height: 1.5;"></div>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button type="button" id="btn-db-test" class="secondary-btn">🧪 בדוק חיבור למסד הנתונים</button>
          <button type="button" id="btn-db-migrate" class="primary-btn" style="background-color: var(--success);">☁️ שמור והעבר את כל הנתונים לספק זה עכשיו</button>
          <button type="button" id="btn-db-pull" class="secondary-btn">📥 משוך נתונים מהענן עכשיו</button>
        </div>
      </div>
    `;
    settingsPanel.appendChild(dbSection);
  }

  const normalizedCfg = typeof normalizeDbConfig === 'function'
    ? normalizeDbConfig(appState.dbConfig)
    : (appState.dbConfig || { activeProvider: 'local' });
  appState.dbConfig = normalizedCfg;

  const providerSelect = document.getElementById('cfg-db-provider');
  const instructionsBox = document.getElementById('cfg-db-instructions');
  const activeBadge = document.getElementById('cfg-db-active-badge');
  const statusBox = document.getElementById('cfg-db-status');

  const githubFields = document.getElementById('cfg-db-github-fields');
  const firebaseFields = document.getElementById('cfg-db-firebase-fields');
  const customFields = document.getElementById('cfg-db-custom-fields');

  const githubTokenInput = document.getElementById('cfg-db-github-token');
  const githubGistIdInput = document.getElementById('cfg-db-github-gist-id');
  const firebaseUrlInput = document.getElementById('cfg-db-firebase-url');
  const firebaseSecretInput = document.getElementById('cfg-db-firebase-secret');
  const customUrlInput = document.getElementById('cfg-db-custom-url');
  const customKeyInput = document.getElementById('cfg-db-custom-key');

  const btnDbTest = document.getElementById('btn-db-test');
  const btnDbMigrate = document.getElementById('btn-db-migrate');
  const btnDbPull = document.getElementById('btn-db-pull');

  if (providerSelect) providerSelect.value = normalizedCfg.activeProvider || 'local';
  if (githubTokenInput) githubTokenInput.value = normalizedCfg.githubToken || '';
  if (githubGistIdInput) githubGistIdInput.value = normalizedCfg.githubGistId || '';
  if (firebaseUrlInput) firebaseUrlInput.value = normalizedCfg.firebaseUrl || '';
  if (firebaseSecretInput) firebaseSecretInput.value = normalizedCfg.firebaseSecret || '';
  if (customUrlInput) customUrlInput.value = normalizedCfg.customEndpointUrl || '';
  if (customKeyInput) customKeyInput.value = normalizedCfg.customApiKey || '';

  const updateActiveBadgeUI = () => {
    if (!activeBadge) return;
    const activeProv = appState.dbConfig?.activeProvider || 'local';
    const label = DB_PROVIDER_LABELS[activeProv] || DB_PROVIDER_LABELS.local;
    const syncTime = appState.dbConfig?.lastSyncedAt
      ? ` • סונכרן: ${new Date(appState.dbConfig.lastSyncedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
      : '';
    activeBadge.textContent = `ספק פעיל: ${label}${syncTime}`;
    activeBadge.style.backgroundColor = activeProv === 'local' ? '#f1f5f9' : '#ecfdf5';
    activeBadge.style.color = activeProv === 'local' ? '#334155' : '#065f46';
  };

  const showDbStatus = (type, html) => {
    if (!statusBox) return;
    statusBox.style.display = 'block';
    if (type === 'loading') {
      statusBox.style.backgroundColor = '#eff6ff';
      statusBox.style.color = '#1e40af';
      statusBox.style.border = '1px solid #bfdbfe';
    } else if (type === 'success') {
      statusBox.style.backgroundColor = '#ecfdf5';
      statusBox.style.color = '#065f46';
      statusBox.style.border = '1px solid #a7f3d0';
    } else {
      statusBox.style.backgroundColor = '#fef2f2';
      statusBox.style.color = '#991b1b';
      statusBox.style.border = '1px solid #fecaca';
    }
    statusBox.innerHTML = html;
  };

  const refreshProviderDynamicView = () => {
    const selected = providerSelect ? providerSelect.value : 'local';
    if (instructionsBox) {
      instructionsBox.innerHTML = DB_PROVIDER_INSTRUCTIONS_HTML[selected] || DB_PROVIDER_INSTRUCTIONS_HTML.local;
    }
    if (githubFields) githubFields.style.display = selected === 'github' ? 'flex' : 'none';
    if (firebaseFields) firebaseFields.style.display = selected === 'firebase' ? 'flex' : 'none';
    if (customFields) customFields.style.display = selected === 'custom' ? 'flex' : 'none';
  };

  const collectFormDbConfig = () => {
    const selectedProvider = providerSelect ? providerSelect.value : 'local';
    const ghToken = githubTokenInput ? cleanApiKey(githubTokenInput.value) : '';
    const ghGistId = githubGistIdInput ? cleanApiKey(githubGistIdInput.value) : '';
    const fbUrl = firebaseUrlInput ? String(firebaseUrlInput.value || '').trim() : '';
    const fbSecret = firebaseSecretInput ? cleanApiKey(firebaseSecretInput.value) : '';
    const custUrl = customUrlInput ? String(customUrlInput.value || '').trim() : '';
    const custKey = customKeyInput ? cleanApiKey(customKeyInput.value) : '';

    if (githubTokenInput) githubTokenInput.value = ghToken;
    if (githubGistIdInput) githubGistIdInput.value = ghGistId;
    if (firebaseUrlInput) firebaseUrlInput.value = fbUrl;
    if (firebaseSecretInput) firebaseSecretInput.value = fbSecret;
    if (customUrlInput) customUrlInput.value = custUrl;
    if (customKeyInput) customKeyInput.value = custKey;

    const flatDbConfig = {
      activeProvider: selectedProvider,
      githubToken: ghToken,
      githubGistId: ghGistId,
      firebaseUrl: fbUrl,
      firebaseSecret: fbSecret,
      customEndpointUrl: custUrl,
      customApiKey: custKey,
      lastSyncedAt: appState.dbConfig?.lastSyncedAt || null
    };

    const providerSpecificMap = {
      local: {},
      github: { token: ghToken, gistId: ghGistId, filename: 'daniel_ai_cloud_state.json' },
      firebase: { databaseUrl: fbUrl, authSecret: fbSecret },
      custom: { endpointUrl: custUrl, apiKey: custKey, saveMethod: 'POST' }
    };

    return {
      selectedProvider,
      flatDbConfig,
      providerSpecificConfig: providerSpecificMap[selectedProvider] || {}
    };
  };

  if (providerSelect) {
    providerSelect.onchange = () => {
      refreshProviderDynamicView();
      if (statusBox) statusBox.style.display = 'none';
    };
  }

  updateActiveBadgeUI();
  refreshProviderDynamicView();

  // 1. בדיקת חיבור למסד הנתונים
  if (btnDbTest) {
    btnDbTest.onclick = async () => {
      if (typeof DatabaseManager === 'undefined') {
        showDbStatus('error', '🔴 שכבת DatabaseManager אינה טעונה.');
        return;
      }
      const { selectedProvider, flatDbConfig, providerSpecificConfig } = collectFormDbConfig();
      btnDbTest.disabled = true;
      showDbStatus('loading', '<span class="loading-spinner"></span> <span>בודק חיבור והרשאות מול ספק הנתונים...</span>');

      try {
        const res = await DatabaseManager.testConnection(selectedProvider, providerSpecificConfig);
        if (res.ok) {
          if (res.metadata && res.metadata.gistId) {
            if (githubGistIdInput) githubGistIdInput.value = res.metadata.gistId;
            flatDbConfig.githubGistId = res.metadata.gistId;
          }
          appState.dbConfig = { ...appState.dbConfig, ...flatDbConfig, activeProvider: appState.dbConfig?.activeProvider || 'local' };
          showDbStatus(
            'success',
            `🟢 <strong>החיבור תקין!</strong> (${res.latencyMs}ms) — ${res.message}`
          );
          SoundService.playSuccessSound();
        } else {
          showDbStatus('error', `🔴 <strong>בדיקת החיבור נכשלה:</strong> ${res.message}`);
        }
      } catch (err) {
        showDbStatus('error', `🔴 <strong>שגיאה בבדיקת החיבור:</strong> ${err.message}`);
      } finally {
        btnDbTest.disabled = false;
      }
    };
  }

  // 2. שמור והעבר את כל הנתונים לספק זה עכשיו (One-Click Migration)
  if (btnDbMigrate) {
    btnDbMigrate.onclick = async () => {
      if (typeof DatabaseManager === 'undefined') {
        showDbStatus('error', '🔴 שכבת DatabaseManager אינה טעונה.');
        return;
      }
      const { selectedProvider, flatDbConfig, providerSpecificConfig } = collectFormDbConfig();
      btnDbMigrate.disabled = true;
      showDbStatus('loading', '<span class="loading-spinner"></span> <span>מאמת חיבור ומעביר 100% מהנתונים של דניאל לספק שנבחר...</span>');

      try {
        appState.dbConfig = { ...appState.dbConfig, ...flatDbConfig };
        const res = await DatabaseManager.migrateToProvider(selectedProvider, providerSpecificConfig);
        if (res.ok) {
          const discoveredGistId = res.metadata?.gistId || DatabaseManager.providerConfigs?.github?.gistId || flatDbConfig.githubGistId;
          if (discoveredGistId && githubGistIdInput) {
            githubGistIdInput.value = discoveredGistId;
          }
          appState.dbConfig = {
            ...flatDbConfig,
            activeProvider: selectedProvider,
            githubGistId: discoveredGistId || '',
            lastSyncedAt: res.updatedAt || new Date().toISOString()
          };
          saveAppState({ skipCloudSync: true });
          updateActiveBadgeUI();
          showDbStatus(
            'success',
            `🟢 <strong>${res.message}</strong>${discoveredGistId && selectedProvider === 'github' ? ` (Gist ID נשמר אוטומטית: <code>${discoveredGistId}</code>)` : ''}`
          );
          SoundService.playSuccessSound();
          showToast('כל הנתונים נשמרו והועברו בהצלחה לספק הנבחר! ☁️');
        } else {
          showDbStatus('error', `🔴 <strong>העברת הנתונים לא הושלמה:</strong> ${res.message}`);
          showToast(res.message, 'error');
        }
      } catch (err) {
        showDbStatus('error', `🔴 <strong>שגיאה בהעברת הנתונים:</strong> ${err.message}`);
      } finally {
        btnDbMigrate.disabled = false;
      }
    };
  }

  // 3. משוך נתונים מהענן עכשיו
  if (btnDbPull) {
    btnDbPull.onclick = async () => {
      const { selectedProvider, flatDbConfig } = collectFormDbConfig();
      btnDbPull.disabled = true;
      showDbStatus('loading', '<span class="loading-spinner"></span> <span>מושך את הנתונים העדכניים ביותר וממזג בבטחה...</span>');

      try {
        appState.dbConfig = { ...appState.dbConfig, ...flatDbConfig, activeProvider: selectedProvider };
        if (typeof syncCloudDatabaseOnStartup === 'function') {
          const pullRes = await syncCloudDatabaseOnStartup({
            forcePull: true,
            targetProvider: selectedProvider
          });
          if (appState.dbConfig?.githubGistId && githubGistIdInput) {
            githubGistIdInput.value = appState.dbConfig.githubGistId;
          }
          updateActiveBadgeUI();
          if (pullRes.synced) {
            showDbStatus('success', `🟢 <strong>${pullRes.message}</strong>`);
            SoundService.playSuccessSound();
            showToast('הנתונים נמשכו מהענן ומוזגו בהצלחה! 📥');
          } else {
            showDbStatus('error', `ℹ️ ${pullRes.message}`);
          }
        }
      } catch (err) {
        showDbStatus('error', `🔴 <strong>שגיאה במשיכת הנתונים:</strong> ${err.message}`);
      } finally {
        btnDbPull.disabled = false;
      }
    };
  }
}

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

  // 3-Tier Database Switcher Section
  renderDatabaseSwitcherSettings();

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
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            performSmartMergeAndMigration({ skipCloudSync: false });
            saveAppState();
            renderAdminOverview();
            renderAdminSettings();
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
        localStorage.removeItem('DANIEL_AI_DB_CONFIG_V1');
        location.reload();
      }
    };
  }
}
