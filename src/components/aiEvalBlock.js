/**
 * AI Eval Block Component - Daniel AI Learning System
 */

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
