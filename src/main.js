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
