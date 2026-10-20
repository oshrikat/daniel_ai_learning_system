// ============================================================================
// 6.5. מנוע הבלוקים הדינמי - תקן בלוקים (Dynamic Block Engine v1.0)
// ============================================================================

/**
 * דיספצ'ר ראשי לרינדור בלוק לימוד
 * @param {object} block - אובייקט הבלוק לפי מפרט LESSON_ENGINE_SPEC
 * @param {number} index - אינדקס הבלוק ביחידה
 * @param {object} unit - יחידת הלימוד
 * @returns {HTMLElement}
 */
function renderBlock(block, index, unit, exerciseStep = null) {
  const container = document.createElement('div');
  container.className = `lesson-block block-type-${block.type || 'text'}`;

  switch (block.type) {
    case 'text':
      renderTextBlock(container, block);
      break;
    case 'compare':
      renderCompareBlock(container, block);
      break;
    case 'callout':
      renderCalloutBlock(container, block);
      break;
    case 'interactive_scale':
      renderScaleBlock(container, block);
      break;
    case 'checklist_steps':
      renderChecklistBlock(container, block);
      break;
    case 'journal_grid':
      renderJournalGridBlock(container, block);
      break;
    case 'spreadsheet_task':
      renderSpreadsheetBlock(container, block);
      break;
    case 'exercise':
      renderExerciseBlock(container, block, exerciseStep);
      break;
    case 'ai_eval_qa':
      renderAiEvalBlock(container, block);
      break;
    default:
      container.innerHTML = `<p class="block-text-content">${block.content || ''}</p>`;
  }

  return container;
}

/**
 * בלוק 1: כותרת וטקסט (text)
 */
function renderTextBlock(container, block) {
  const p = document.createElement('p');
  p.className = `block-text-content style-${block.style || 'normal'}`;
  p.textContent = block.content || '';
  container.appendChild(p);
}

/**
 * בלוק 2: כרטיס השוואה נכון מול שגוי (compare)
 */
function renderCompareBlock(container, block) {
  const good = block.good || { label: 'נכון', desc: '' };
  const bad = block.bad || { label: 'טעות נפוצה', desc: '' };
  container.innerHTML = `
    ${block.title ? `<h4 class="block-section-title">${block.title}</h4>` : ''}
    <div class="block-compare-grid">
      <div class="compare-card compare-good">
        <div class="compare-badge good-badge">✅ ${good.label}</div>
        <p class="compare-desc">${good.desc}</p>
      </div>
      <div class="compare-card compare-bad">
        <div class="compare-badge bad-badge">❌ ${bad.label}</div>
        <p class="compare-desc">${bad.desc}</p>
      </div>
    </div>
  `;
}

/**
 * בלוק 3: תיבת הדגשה / כלל / טיפ (callout)
 */
function renderCalloutBlock(container, block) {
  const icons = { tip: '💡', rule: '🛡️', warning: '⚠️', info: 'ℹ️' };
  const icon = icons[block.style] || '📌';
  container.innerHTML = `
    <div class="callout-card callout-${block.style || 'info'}">
      <div class="callout-header">
        <span class="callout-icon">${icon}</span>
        <strong class="callout-title">${block.title || 'שים לב'}</strong>
      </div>
      <p class="callout-text">${block.text || ''}</p>
    </div>
  `;
}


/**
 * בלוק 5: צ'ק-ליסט שלבים (checklist_steps)
 */
function renderChecklistBlock(container, block) {
  container.innerHTML = `
    ${block.title ? `<h4 class="block-section-title">${block.title}</h4>` : ''}
    <div class="checklist-items-box">
      ${(block.steps || []).map((step, sIdx) => `
        <label class="checklist-item-row" data-step-idx="${sIdx}">
          <input type="checkbox" class="checklist-checkbox" />
          <span class="checklist-text">${step}</span>
        </label>
      `).join('')}
    </div>
  `;
  container.querySelectorAll('.checklist-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const row = e.target.closest('.checklist-item-row');
      if (row) row.classList.toggle('checked', e.target.checked);
    });
  });
}

/**
 * בלוק 7: משימת גיליון נתונים וחישוב (spreadsheet_task)
 */
function renderSpreadsheetBlock(container, block) {
  const td = block.table_data || { headers: [], rows: [] };
  container.innerHTML = `
    <div class="spreadsheet-block-card">
      <div class="spreadsheet-header">
        <span class="ss-icon">📊</span>
        <div>
          <h4 class="ss-title">${block.title || 'משימת נתונים'}</h4>
          <p class="ss-instructions">${block.instructions || ''}</p>
        </div>
      </div>
      <div class="ss-table-wrapper">
        <table class="spreadsheet-grid-table">
          <thead>
            <tr>
              ${(td.headers || []).map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${(td.rows || []).map(row => `
              <tr>
                ${row.map(cell => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="ss-action-box">
        <label class="ss-prompt-label"><strong>שאלה:</strong> ${block.action_prompt || ''}</label>
        <div class="ss-input-group">
          <input type="number" class="styled-input ss-answer-input" placeholder="הקלד כאן מספר..." />
          <button class="primary-btn ss-check-btn" type="button">בדוק תשובה</button>
          ${block.hint ? `<button class="secondary-btn ss-hint-btn" type="button">💡 רמז</button>` : ''}
        </div>
        ${block.hint ? `<div class="ss-hint-text" style="display: none;">${block.hint}</div>` : ''}
        <div class="ss-feedback-msg" style="display: none;"></div>
      </div>
    </div>
  `;

  const hintBtn = container.querySelector('.ss-hint-btn');
  const hintText = container.querySelector('.ss-hint-text');
  if (hintBtn && hintText) {
    hintBtn.onclick = () => {
      hintText.style.display = hintText.style.display === 'none' ? 'block' : 'none';
    };
  }

  const checkBtn = container.querySelector('.ss-check-btn');
  const input = container.querySelector('.ss-answer-input');
  const fb = container.querySelector('.ss-feedback-msg');
  if (checkBtn && input && fb) {
    checkBtn.onclick = () => {
      const val = Number(input.value);
      const expected = Number(block.expected_numeric_answer);
      fb.style.display = 'block';
      if (val === expected) {
        fb.className = 'ss-feedback-msg success';
        fb.textContent = 'כל הכבוד, דניאל! חישוב מדויק ונכון מאוד 🌟';
        SoundService.playSuccessSound();
      } else {
        fb.className = 'ss-feedback-msg error';
        fb.textContent = `לא בדיוק (קיבלת ${val}). נסה שוב או היעזר ברמז למעלה!`;
      }
    };
  }
}
