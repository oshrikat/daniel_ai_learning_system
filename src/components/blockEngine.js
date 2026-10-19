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
 * בלוק 4: מאזניים אינטראקטיביים משודרגים (interactive_scale)
 * מציג תרחיש עסקי מעצים, זרוע מאזניים פיזית מוטה ב-12 מעלות, ובחירת משקולת שמאזנת בהצלחה לאופק
 * @param {HTMLElement} container
 * @param {object} block
 */
function renderScaleBlock(container, block) {
  // Defensive fallbacks — never crash on missing data
  const scenario   = block.scenario    || '';
  const options    = Array.isArray(block.options) ? block.options : [];
  const tiltedSide = block.tilted_side || (block.is_balanced === false ? 'credit' : '');

  const isTiltedCredit = tiltedSide === 'credit';
  const isTiltedDebit  = tiltedSide === 'debit';
  const initialRotation = isTiltedCredit ? 12 : (isTiltedDebit ? -12 : 0);
  const hasOptions = options.length > 0;
  const initiallyBalanced = initialRotation === 0;

  const leftWeightText  = block.left_weight  !== undefined ? `${Number(block.left_weight).toLocaleString()} ₪`  : '';
  const rightWeightText = block.right_weight !== undefined ? `${Number(block.right_weight).toLocaleString()} ₪` : '';

  container.innerHTML = `
    <div class="scale-block-card ${initiallyBalanced ? 'balanced' : 'tilted'}">
      ${block.title ? `<h4 class="block-section-title">${block.title}</h4>` : ''}
      
      ${scenario ? `
        <div class="scale-scenario-card">
          <div class="scale-scenario-header">
            <span class="scale-scenario-icon">💼</span>
            <strong class="scale-scenario-badge">סיטואציה עסקית</strong>
          </div>
          <p class="scale-scenario-text">${scenario}</p>
        </div>
      ` : ''}

      <div class="scale-stage-area">
        <div class="scale-fulcrum-post">
          <div class="scale-fulcrum-triangle"></div>
          <div class="scale-fulcrum-base"></div>
        </div>

        <div class="scale-beam-wrapper" style="transform: rotate(${initialRotation}deg);">
          <div class="scale-beam-bar">
            <!-- כף שמאל: חובה -->
            <div class="scale-pan-assembly pan-left">
              <div class="scale-pan-chain"></div>
              <div class="scale-pan-dish">
                <div class="pan-title">${block.left_label || 'חובה (נכנס)'}</div>
                ${leftWeightText ? `<div class="pan-amount">${leftWeightText}</div>` : ''}
              </div>
            </div>

            <div class="scale-pivot-center">⚖️</div>

            <!-- כף ימין: זכות -->
            <div class="scale-pan-assembly pan-right">
              <div class="scale-pan-chain"></div>
              <div class="scale-pan-dish">
                <div class="pan-title">${block.right_label || 'זכות (יצא)'}</div>
                ${rightWeightText ? `<div class="pan-amount">${rightWeightText}</div>` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="scale-status-banner ${initiallyBalanced ? 'balanced' : 'tilted'}">
        <span class="scale-status-icon">${initiallyBalanced ? '✓' : '⚠️'}</span>
        <span class="scale-status-text">
          ${initiallyBalanced ? 'המאזניים מאוזנים לחלוטין (חובה = זכות)' : 'המאזניים נוטים ואינם מאוזנים! יש לבחור פעולה מאזנת.'}
        </span>
      </div>

      ${hasOptions ? `
        <div class="scale-options-section">
          <div class="scale-options-prompt">
            <span class="prompt-icon">⚖️</span>
            <strong>בחר את המשקולת המאזנת להנחה על המאזניים:</strong>
          </div>
          <div class="scale-options-grid">
            ${options.map((opt, oIdx) => `
              <button class="scale-weight-btn" type="button" data-idx="${oIdx}">
                <span class="weight-icon">🪙</span>
                <span class="weight-label">${opt.text || ''}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : '<div class="scale-options-fallback">מאזניים להמחשה — אין אפשרויות בחירה בשלב זה.</div>'}

      <div class="scale-feedback-alert" style="display: none;"></div>
    </div>
  `;

  const beamEl = container.querySelector('.scale-beam-wrapper');
  const cardEl = container.querySelector('.scale-block-card');
  const statusBanner = container.querySelector('.scale-status-banner');
  const statusIcon = container.querySelector('.scale-status-icon');
  const statusText = container.querySelector('.scale-status-text');
  const feedbackEl = container.querySelector('.scale-feedback-alert');
  const weightButtons = container.querySelectorAll('.scale-weight-btn');

  if (hasOptions) {
    weightButtons.forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        const opt = options[idx];
        if (!opt) return;

        weightButtons.forEach(b => b.classList.remove('selected', 'correct', 'wrong'));
        btn.classList.add('selected');
        feedbackEl.style.display = 'block';

        if (opt.is_correct) {
          // אנימציה חלקה לאיזון אופקי (rotate 0deg)
          btn.classList.add('correct');
          if (beamEl) {
            beamEl.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
            beamEl.style.transform = 'rotate(0deg)';
          }
          if (cardEl) {
            cardEl.classList.remove('tilted');
            cardEl.classList.add('balanced');
          }
          if (statusBanner) {
            statusBanner.className = 'scale-status-banner balanced';
            if (statusIcon) statusIcon.textContent = '✓';
            if (statusText) statusText.textContent = 'כל הכבוד! המאזניים מאוזנים בדיוק מושלם (חובה = זכות) ✨';
          }
          feedbackEl.className = 'scale-feedback-alert praise';
          feedbackEl.innerHTML = `
            <div class="fb-header">🌟 איזון מושלם, דניאל!</div>
            <p class="fb-body">${opt.feedback || 'הנחת את המשקולת המדויקת שמאזנת את הפעולה.'}</p>
          `;
          SoundService.playSuccessSound();
          showToast('כל הכבוד דניאל! המאזניים אוזנו בהצלחה! ⚖️✨', 'success');
        } else {
          // שמירה על ההטיה המקורית של 12 מעלות עם משוב מנחה
          btn.classList.add('wrong');
          if (beamEl) {
            beamEl.style.transition = 'transform 0.4s ease';
            beamEl.style.transform = `rotate(${initialRotation}deg)`;
          }
          if (cardEl) {
            cardEl.classList.remove('balanced');
            cardEl.classList.add('tilted');
          }
          feedbackEl.className = 'scale-feedback-alert guiding';
          feedbackEl.innerHTML = `
            <div class="fb-header">💡 בוא נחשוב יחד:</div>
            <p class="fb-body">${opt.feedback || 'המשקולת הזו אינה מאזנת את שני הצדדים. נסה לבחור שוב בנחת.'}</p>
          `;
          showToast('כמעט! קרא את הרמז המנחה ונסה לבחור שוב 💡', 'warning');
        }
      };
    });
  }
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
 * בלוק 6: טבלת פקודת יומן (journal_grid)
 */
function renderJournalGridBlock(container, block) {
  const rows = block.expected_rows || [];
  const defaultDistractors = [
    'קופה',
    'עו"ש בנק',
    'עסקה משותפת',
    'מע"מ תשומות',
    'מע"מ עסקאות',
    'הכנסות ממכירות',
    'ספקים',
    'חו"ז שותף ב\''
  ];

  const buildRowOptions = (row, rIdx) => {
    const correctAcc = row.account || '';
    const otherRowAccs = rows
      .map((r, i) => (i !== rIdx ? r.account : null))
      .filter(a => a && a !== correctAcc);
    const pool = [...new Set([...otherRowAccs, ...defaultDistractors])].filter(a => a !== correctAcc);
    const distractors = pool.slice(0, 2);
    const options = [correctAcc, ...distractors];
    // Deterministic rotation based on row index so options aren't always first
    const shift = (rIdx + 1) % options.length;
    return options.slice(shift).concat(options.slice(0, shift));
  };

  const tableHtml = `
    <div class="journal-block-card">
      <div class="journal-instruction">
        <span class="journal-pencil-icon">📝</span>
        <span>${block.instruction || 'ערוך פקודת יומן'}</span>
      </div>
      <div class="journal-table-wrapper">
        <table class="journal-grid-table">
          <thead>
            <tr>
              <th>שם החשבון</th>
              <th style="width: 140px;">חובה (₪)</th>
              <th style="width: 140px;">זכות (₪)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, rIdx) => {
              const opts = buildRowOptions(row, rIdx);
              return `
              <tr class="journal-row" data-row-idx="${rIdx}">
                <td class="journal-acc-cell">
                  <select class="styled-select journal-acc-select">
                    <option value="">-- בחר חשבון (3 אפשרויות) --</option>
                    ${opts.map(opt => `<option value="${opt.replace(/"/g, '&quot;')}">${opt}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <input type="number" class="styled-input journal-debit-input" placeholder="0" value="" />
                </td>
                <td>
                  <input type="number" class="styled-input journal-credit-input" placeholder="0" value="" />
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="journal-total-row">
              <td><strong>סה"כ פקודה:</strong></td>
              <td class="total-debit-cell">0 ₪</td>
              <td class="total-credit-cell">0 ₪</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="journal-actions-row">
        <button class="primary-btn journal-check-btn" type="button">
          <span>בדוק איזון פקודת יומן ⚖️</span>
        </button>
        <div class="journal-feedback-msg" style="display: none;"></div>
      </div>
    </div>
  `;
  container.innerHTML = tableHtml;

  const updateTotals = () => {
    let dSum = 0;
    let cSum = 0;
    container.querySelectorAll('.journal-debit-input').forEach(inp => dSum += Number(inp.value) || 0);
    container.querySelectorAll('.journal-credit-input').forEach(inp => cSum += Number(inp.value) || 0);
    const dCell = container.querySelector('.total-debit-cell');
    const cCell = container.querySelector('.total-credit-cell');
    if (dCell) dCell.textContent = `${dSum.toLocaleString()} ₪`;
    if (cCell) cCell.textContent = `${cSum.toLocaleString()} ₪`;
    return { dSum, cSum };
  };

  container.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateTotals));
  updateTotals();

  const checkBtn = container.querySelector('.journal-check-btn');
  const fbMsg = container.querySelector('.journal-feedback-msg');
  if (checkBtn && fbMsg) {
    checkBtn.onclick = () => {
      const { dSum, cSum } = updateTotals();
      fbMsg.style.display = 'block';

      const trElements = Array.from(container.querySelectorAll('.journal-row'));
      const enteredRows = trElements.map(tr => ({
        tr,
        account: (tr.querySelector('.journal-acc-select')?.value || '').trim(),
        debit: Number(tr.querySelector('.journal-debit-input')?.value) || 0,
        credit: Number(tr.querySelector('.journal-credit-input')?.value) || 0
      }));

      if (enteredRows.some(r => !r.account)) {
        fbMsg.className = 'journal-feedback-msg warning';
        fbMsg.textContent = 'דניאל, אנא בחר שם חשבון מהרשימה עבור כל שורה בטבלה לפני הבדיקה.';
        return;
      }

      const remainingExpected = rows.map(r => ({
        account: (r.account || '').trim(),
        debit: Number(r.debit) || 0,
        credit: Number(r.credit) || 0
      }));

      let allRowsMatch = true;
      enteredRows.forEach(entry => {
        const matchIdx = remainingExpected.findIndex(
          exp => exp.account === entry.account && exp.debit === entry.debit && exp.credit === entry.credit
        );
        if (matchIdx !== -1) {
          remainingExpected.splice(matchIdx, 1);
          entry.tr.classList.remove('row-invalid');
          entry.tr.classList.add('row-valid');
          entry.tr.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
        } else {
          allRowsMatch = false;
          entry.tr.classList.remove('row-valid');
          entry.tr.classList.add('row-invalid');
          entry.tr.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
        }
      });

      if (dSum > 0 && dSum === cSum && allRowsMatch) {
        fbMsg.className = 'journal-feedback-msg success';
        fbMsg.textContent = 'מצוין, דניאל! הפקודה מאוזנת ונכונה לחלוטין! כל החשבונות והסכומים בחובה ובזכות מדויקים ✓';
        SoundService.playSuccessSound();
      } else if (dSum > 0 && dSum === cSum) {
        fbMsg.className = 'journal-feedback-msg warning';
        fbMsg.textContent = 'הפקודה מאוזנת מתמטית (חובה = זכות), אך חלק מהחשבונות או הסכומים בשורות המסומנות אינם תואמים את נתוני האירוע.';
      } else {
        fbMsg.className = 'journal-feedback-msg error';
        fbMsg.textContent = block.validation_error_message || 'הפקודה לא מאוזנת! סך החובה חייב להיות שווה בדיוק לסך הזכות.';
      }
    };
  }
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

/**
 * בלוק 8: שאלת תרגול רב-ברירתית (exercise)
 */
function renderExerciseBlock(container, block, onAnsweredCorrectly) {
  container.innerHTML = `
    <div class="exercise-block-card">
      <div class="exercise-header">
        <span class="exercise-badge">🎯 שאלת בדיקה עצמית</span>
        <h4 class="exercise-question">${block.question || ''}</h4>
        ${block.hint ? `
          <button type="button" class="secondary-btn exercise-hint-btn" style="margin-top:0.6rem;">💡 רמז לדניאל</button>
          <div class="exercise-hint-box" style="display:none; margin-top:0.5rem;">${block.hint}</div>
        ` : ''}
      </div>
      <div class="exercise-options-list">
        ${(block.options || []).map((opt, oIdx) => `
          <button class="exercise-option-btn" type="button" data-idx="${oIdx}">
            <span class="option-marker">${['א', 'ב', 'ג', 'ד'][oIdx] || oIdx + 1}</span>
            <span class="option-text">${opt}</span>
          </button>
        `).join('')}
      </div>
      <div class="exercise-feedback-card" style="display: none;"></div>
    </div>
  `;

  const hintBtn = container.querySelector('.exercise-hint-btn');
  const hintBox = container.querySelector('.exercise-hint-box');
  if (hintBtn && hintBox) {
    hintBtn.onclick = () => {
      hintBox.style.display = hintBox.style.display === 'none' ? 'block' : 'none';
    };
  }

  const buttons = container.querySelectorAll('.exercise-option-btn');
  const fbCard = container.querySelector('.exercise-feedback-card');

  buttons.forEach(btn => {
    btn.onclick = () => {
      const chosen = Number(btn.dataset.idx);
      buttons.forEach(b => b.classList.remove('selected', 'correct', 'wrong'));
      btn.classList.add('selected');

      fbCard.style.display = 'block';
      if (chosen === block.correct_index) {
        btn.classList.add('correct');
        fbCard.className = 'exercise-feedback-card success';
        fbCard.innerHTML = `
          <strong>נכון מאוד! ✨</strong>
          <p>${block.explanation || 'תשובה מדויקת!'}</p>
        `;
        SoundService.playSuccessSound();
        if (typeof onAnsweredCorrectly === 'function') onAnsweredCorrectly();
      } else {
        btn.classList.add('wrong');
        fbCard.className = 'exercise-feedback-card wrong';
        fbCard.innerHTML = `
          <strong>לא בדיוק.</strong>
          <p>חשוב שוב על הכיוון: לאן הכסף נכנס ומאיפה הוא יצא, ונסה לבחור שוב! 💪</p>
        `;
      }
    };
  });
}

/**
 * בלוק 9: שאלה פתוחה עם בדיקת AI מעצימה (ai_eval_qa)
 */
function renderAiEvalBlock(container, block) {
  if (typeof block._isPassed !== 'boolean') {
    block._isPassed = false;
  }

  container.innerHTML = `
    <div class="ai-eval-block-card">
      <div class="ai-eval-header">
        <span class="ai-eval-robot-icon">🤖</span>
        <div>
          <h4 class="ai-eval-title">${block.question_title || 'שאלה למחשבה'}</h4>
          <span class="ai-eval-subtitle">כתוב במילים שלך - המאמן יבדוק וייתן משוב מעצים</span>
        </div>
      </div>
      <div class="ai-eval-body">
        <textarea class="styled-textarea ai-eval-textarea" rows="3" placeholder="${block.placeholder || 'כתוב כאן בנחת...'}"></textarea>
        <div class="ai-eval-actions">
          <button class="primary-btn ai-eval-submit-btn" type="button">
            <span>שלח לבדיקת AI מעצימה ✨</span>
          </button>
        </div>
        <div class="ai-eval-feedback-result" style="display: none;"></div>
      </div>
    </div>
  `;

  const btn = container.querySelector('.ai-eval-submit-btn');
  const textarea = container.querySelector('.ai-eval-textarea');
  const fbResult = container.querySelector('.ai-eval-feedback-result');

  if (btn && textarea && fbResult) {
    btn.onclick = async () => {
      const text = textarea.value.trim();
      if (!text) {
        showToast('אנא כתוב כמה מילים לפני השליחה ✍️');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span>בודק בנחת... ⏳</span>';
      fbResult.style.display = 'block';
      fbResult.className = 'ai-eval-feedback-result loading';
      fbResult.style.cssText = 'display: block;';
      fbResult.innerHTML = '<p>המאמן של דניאל מעבד את התשובה שלך... 🤖</p>';

      const evalPrompt = `אתה מאמן למידה פדגוגי, חם ומדויק עבור דניאל (בן 28).
השאלה שנשאלה: "${block.question_title}"
תשובת דניאל: "${text}"
מושג הליבה והתשובה הנדרשת: "${block.rubric_for_ai?.core_concept || ''}"
כללי הערכה: ${JSON.stringify(block.rubric_for_ai?.evaluation_rules || [])}

עליך להעריך באמת האם תשובתו של דניאל נכונה ומדויקת לפי מושג הליבה, או שהיא שגויה / חלקית / לא מדויקת.
החזר אך ורק אובייקט JSON תקני (ללא markdown וללא טקסט מחוץ ל-JSON) במבנה הבא:
{
  "is_accurate": true,
  "opening_quote": "משפט פתיחה חם ומכבד שמצטט ישירות מילים מתוך מה שדניאל כתב",
  "explanation": "אם is_accurate הוא false: הסבר ברור ופשוט למה התשובה עדיין לא מדויקת ומה התבלבל. אם is_accurate הוא true: חיזוק ממוקד שמסביר למה ההיגיון של דניאל מדויק.",
  "next_step_or_recap": "אם is_accurate הוא false: רמז מכוון ושאלה מנחה שמזמינה את דניאל לנסות שוב. אם is_accurate הוא true: סיכום קצר ומזוקק (משפט אחד) של הכלל שלמדנו."
}`;

      let raw = '';
      try {
        raw = await callMultiTierAI(evalPrompt);
      } catch (e) {
        console.error('[ai_eval_qa] Multi-tier AI fallback threw unexpectedly:', e);
      }

      const parsed = raw ? AIService.cleanAndParseJSON(raw) : null;
      btn.disabled = false;

      if (parsed && parsed.is_accurate === false) {
        block._isPassed = false;
        fbResult.className = 'ai-eval-feedback-result warning';
        fbResult.style.cssText = 'display: block; border-right: 4px solid #d97706; background: #fffbeb; color: #92400e; padding: 1rem; border-radius: 12px; margin-top: 0.8rem;';
        fbResult.innerHTML = `
          <div style="margin-bottom: 0.45rem;">🔍 <strong>בוא נדייק יחד, דניאל:</strong></div>
          <p style="margin: 0.35rem 0;">${parsed.opening_quote || ''}</p>
          <p style="margin: 0.35rem 0;"><strong>למה זה עדיין לא מדויק?</strong> ${parsed.explanation || ''}</p>
          <p style="margin: 0.35rem 0;"><strong>💡 כיוון לניסיון הבא:</strong> ${parsed.next_step_or_recap || ''}</p>
        `;
        btn.innerHTML = '<span>נסה לענות שוב לפי ההכוונה ✍️</span>';
        textarea.focus();
      } else {
        block._isPassed = true;
        const words = text.split(/\s+/).slice(0, 4).join(' ');
        const fallbackText = raw || `כל הכבוד דניאל! נהדר לראות שכתבת "${words}...". ההסבר שלך נוגע בדיוק בעניין המרכזי.`;
        const mainParagraph = parsed
          ? `${parsed.opening_quote || ''} ${parsed.explanation || ''}`.trim()
          : fallbackText;
        const recapText = parsed
          ? (parsed.next_step_or_recap || block.rubric_for_ai?.core_concept || '')
          : (block.rubric_for_ai?.core_concept || 'הבנת את העיקרון המרכזי של היחידה');

        fbResult.className = 'ai-eval-feedback-result success';
        fbResult.style.cssText = 'display: block;';
        fbResult.innerHTML = `
          <div class="ai-coach-bubble">
            <div class="ai-bubble-badge">🌟 <strong>תשובה מדויקת ומעולה, דניאל!</strong></div>
            <p class="ai-bubble-content">${mainParagraph}</p>
            <div style="margin-top:0.6rem; padding:0.6rem 0.9rem; background:rgba(16,185,129,0.12); border-radius:8px;">
              <strong>📌 סיכום העיקרון שפיצחת:</strong> ${recapText}
            </div>
          </div>
        `;
        btn.innerHTML = '<span>התשובה אושרה בהצלחה! ✅</span>';
        SoundService.playSuccessSound();
      }
    };
  }
}


