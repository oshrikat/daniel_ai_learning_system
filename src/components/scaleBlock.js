// LOCKED MODULE: Interactive Balance Scale (DO NOT EDIT)

/**
 * בלוק 4: מאזניים אינטראקטיביים משודרגים (interactive_scale)
 * מציג תרחיש עסקי מעצים, זרוע מאזניים פיזית מוטה ב-12 מעלות, ובחירת משקולת שמאזנת בהצלחה לאופק
 * @param {HTMLElement} container
 * @param {object} block
 */
function renderScaleBlock(container, block) {
  // Defensive fallbacks — never crash on missing data
  const scenario = block.scenario || '';
  const options = Array.isArray(block.options) ? block.options : [];
  const tiltedSide = block.tilted_side || (block.is_balanced === false ? 'credit' : '');

  const isTiltedCredit = tiltedSide === 'credit';
  const isTiltedDebit = tiltedSide === 'debit';
  const initialRotation = isTiltedCredit ? 12 : (isTiltedDebit ? -12 : 0);
  const hasOptions = options.length > 0;
  const initiallyBalanced = initialRotation === 0;

  const leftWeightText = block.left_weight !== undefined ? `${Number(block.left_weight).toLocaleString()} ₪` : '';
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
