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
        saveAppState();
        renderTrackTabs();
        renderRoadmap();
      }
    };
    container.appendChild(btn);
  });
}

function renderRoadmap() {
  const container = document.getElementById('units-grid');
  if (!container) return;
  container.innerHTML = '';

  const activeTrack = getActiveTrack();
  const cpBadgeBox = document.getElementById('checkpoints-progress-pill');

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

    const unitsText = document.getElementById('units-stat-text');
    if (unitsText) unitsText.textContent = `${completedCount} מתוך ${units.length} יחידות`;

    const bar = document.getElementById('weekly-progress-bar');
    if (bar) bar.style.width = `${(completedCount / Math.max(1, units.length)) * 100}%`;
  }
}

