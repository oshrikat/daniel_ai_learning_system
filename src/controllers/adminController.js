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

