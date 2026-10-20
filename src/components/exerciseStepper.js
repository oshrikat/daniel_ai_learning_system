/**
 * Exercise Stepper Block Component - Daniel AI Learning System
 */

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
