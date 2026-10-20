/**
 * Journal Grid Block Component - Daniel AI Learning System
 */

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
