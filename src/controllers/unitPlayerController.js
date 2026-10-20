function renderUnitPlayer(unitId) {
  const activeTrack = getActiveTrack();
  const legacyWrapper = document.getElementById('unit-steps-wrapper');
  const blocksWrapper = document.getElementById('unit-blocks-wrapper');

  const summaryExams = Array.isArray(appState.accountingSummaryExams) ? appState.accountingSummaryExams : [];
  const matchedSummaryExam = summaryExams.find(u => u && (u.unit_id === unitId || u.id === unitId));

  if (activeTrack.engine === 'blocks' || matchedSummaryExam) {
    // ========================================================================
    // מנוע הבלוקים הדינמי (Dynamic Block Engine - Track 2: Accounting & Summary Exams)
    // ========================================================================
    if (legacyWrapper) legacyWrapper.style.display = 'none';
    if (blocksWrapper) {
      blocksWrapper.style.display = 'flex';
      blocksWrapper.innerHTML = '';
    }

    const units = getTrackUnits(activeTrack);
    let unit = units.find(u => u.id === unitId || u.unit_id === unitId) || matchedSummaryExam;
    if (!unit && typeof ACCOUNTING_CURRICULUM !== 'undefined') {
      const rawAccList = Array.isArray(ACCOUNTING_CURRICULUM)
        ? ACCOUNTING_CURRICULUM
        : (Array.isArray(ACCOUNTING_CURRICULUM.units) ? ACCOUNTING_CURRICULUM.units : []);
      unit = rawAccList.find(u => u && (u.unit_id === unitId || u.id === unitId));
    }
    if (!unit) return;
    if (!unit.id) unit.id = unit.unit_id;
    if (unit.isSummaryExam) {
      unit.isNewExam = false;
      saveAppState();
    }

    const titleEl = document.getElementById('unit-view-title');
    if (titleEl) titleEl.textContent = unit.title;
    const mainTitleEl = document.getElementById('unit-main-title');
    if (mainTitleEl) mainTitleEl.textContent = unit.title;
    const badgeEl = document.getElementById('unit-topic-badge');
    if (badgeEl) badgeEl.textContent = activeTrack.shortLabel || 'הנהלת חשבונות';
    const goalEl = document.getElementById('unit-goal-desc');
    if (goalEl) goalEl.textContent = `⏱️ זמן מומלץ: ${unit.target_minutes || 5} דקות • למידה מבוססת בלוקים ומשימות מעשיות`;

    const backBtn = document.getElementById('unit-back-btn');
    if (backBtn) {
      backBtn.onclick = () => {
        showView('roadmap');
        renderRoadmap();
      };
    }

    if (blocksWrapper) {
      const allBlocks = unit.blocks || [];
      const exerciseBlocks = allBlocks.filter(b => b.type === 'exercise');
      let stepperInserted = false;

      allBlocks.forEach((block, bIdx) => {
        if (block.type === 'exercise') {
          if (!stepperInserted && exerciseBlocks.length > 0) {
            stepperInserted = true;
            const stepperContainer = document.createElement('div');
            stepperContainer.className = 'lesson-block exercise-stepper-container';
            let currentStep = 0;

            const renderStep = () => {
              const total = exerciseBlocks.length;
              const pct = ((currentStep + 1) / total) * 100;
              const isLast = currentStep === total - 1;

              stepperContainer.innerHTML = `
                <div class="exercise-stepper-header" style="margin-bottom: 1rem;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.45rem; font-weight:700;">
                    <span>שאלה ${currentStep + 1} מתוך ${total}</span>
                    <span>${Math.round(pct)}%</span>
                  </div>
                  <div class="stepper-progress-track" style="width:100%; height:8px; background:rgba(15,118,110,0.12); border-radius:999px; overflow:hidden;">
                    <div class="stepper-progress-fill" style="width: ${pct}%; height:100%; background:#0f766e; transition:width 0.3s ease;"></div>
                  </div>
                </div>
                <div class="exercise-stepper-body"></div>
                <div class="exercise-stepper-footer" style="margin-top: 1rem; display:flex; justify-content:flex-end; align-items:center;">
                  <button type="button" class="primary-btn exercise-next-step-btn" disabled>
                    <span>${isLast ? 'סיום סדרת השאלות בהצלחה! 🏆' : 'המשך לשאלה הבאה ▶'}</span>
                  </button>
                </div>
                <div class="exercise-stepper-complete" style="display:none; margin-top:1rem; padding:1rem; border-radius:12px; background:rgba(16,185,129,0.12); color:#065f46; font-weight:700; text-align:center;">
                  🎉 כל הכבוד דניאל! השלמת בהצלחה את כל ${total} שאלות התרגול ביחידה זו! ⭐
                </div>
              `;

              const bodyEl = stepperContainer.querySelector('.exercise-stepper-body');
              const nextBtn = stepperContainer.querySelector('.exercise-next-step-btn');
              const completeBanner = stepperContainer.querySelector('.exercise-stepper-complete');

              renderExerciseBlock(bodyEl, exerciseBlocks[currentStep], () => {
                if (nextBtn) nextBtn.disabled = false;
              });

              if (nextBtn) {
                nextBtn.onclick = () => {
                  if (currentStep < total - 1) {
                    currentStep++;
                    renderStep();
                  } else {
                    nextBtn.style.display = 'none';
                    if (completeBanner) completeBanner.style.display = 'block';
                    SoundService.playSuccessSound();
                  }
                };
              }
            };

            renderStep();
            blocksWrapper.appendChild(stepperContainer);
          }
          return;
        }

        const blockEl = renderBlock(block, bIdx, unit);
        if (blockEl) blocksWrapper.appendChild(blockEl);
      });

      // כרטיס סיום היחידה ומשוב מעצים
      const finishContainer = document.createElement('div');
      finishContainer.className = 'unit-finish-block-card';
      finishContainer.innerHTML = `
        <div style="text-align: center; margin: 2rem 0 1rem 0;">
          <button class="primary-btn block-finish-btn" type="button" style="min-height: 52px; font-size: 1.15rem; padding: 0.9rem 2.2rem;">
            <span>סיימתי בהצלחה את כל הבלוקים ביחידה! ⭐</span>
          </button>
          <div class="block-completed-box" style="display: ${unit.isCompleted ? 'block' : 'none'}; margin-top: 1.2rem;">
            <div class="completed-ribbon" style="display: flex;">
              <span class="ribbon-icon">⭐</span>
              <span class="ribbon-text">כל הכבוד דניאל! היחידה הושלמה בהצלחה!</span>
            </div>
            <button class="share-whatsapp-btn block-wa-share-btn" style="margin-top: 1rem;">
              <span>שלח עדכון לאבא ב-WhatsApp 📲</span>
            </button>
          </div>
        </div>
      `;

      const finishBtn = finishContainer.querySelector('.block-finish-btn');
      const compBox = finishContainer.querySelector('.block-completed-box');
      const waBtn = finishContainer.querySelector('.block-wa-share-btn');

      if (finishBtn) {
        finishBtn.onclick = () => {
          const evalBlock = allBlocks.find(b => b.type === 'ai_eval_qa');
          if (evalBlock && !evalBlock._isPassed) {
            showToast('לפני סיום היחידה, אנא השלם את השאלה הפתוחה למטה עד לקבלת אישור מהמאמן 🤖', 'warning');
            const evalCard = blocksWrapper.querySelector('.ai-eval-block-card');
            if (evalCard) evalCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }

          const targetTrackId = unit.isSummaryExam ? 'accounting' : activeTrack.id;
          if (!appState.trackProgress[targetTrackId]) {
            appState.trackProgress[targetTrackId] = [];
          }
          const uid = unit.unit_id || unit.id;
          if (!appState.trackProgress[targetTrackId].includes(uid)) {
            appState.trackProgress[targetTrackId].push(uid);
          }
          unit.isCompleted = true;
          unit.completed = true;
          unit.isNewExam = false;
          saveAppState();
          SoundService.playSuccessSound();
          showToast(`כל הכבוד דניאל! יחידה "${unit.title}" הושלמה בהצלחה! 🌟`);
          if (compBox) compBox.style.display = 'block';
          compBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
      }

      if (waBtn) {
        waBtn.onclick = () => {
          const msg = encodeURIComponent(`שלום אבא! סיימתי עכשיו בהצלחה את יחידת "${unit.title}" במסלול ${activeTrack.label}! ⭐`);
          window.open(`https://wa.me/?text=${msg}`, '_blank');
        };
      }

      blocksWrapper.appendChild(finishContainer);
    }

    return;
  }

  // ========================================================================
  // מנוע הלמידה הוותיק ב-4 שלבים (Legacy Engine - Track 1: General & AI)
  // ========================================================================
  if (blocksWrapper) blocksWrapper.style.display = 'none';
  if (legacyWrapper) legacyWrapper.style.display = 'block';

  const unit = appState.curriculumUnits.find(u => u.id === unitId);
  if (!unit) return;

  const titleEl = document.getElementById('unit-view-title');
  if (titleEl) titleEl.textContent = unit.title;
  const mainTitleEl = document.getElementById('unit-main-title');
  if (mainTitleEl) mainTitleEl.textContent = unit.title;
  const badgeEl = document.getElementById('unit-topic-badge');
  if (badgeEl) badgeEl.textContent = unit.category || 'מיומנות מעשית';
  const goalEl = document.getElementById('unit-goal-desc');
  if (goalEl) goalEl.textContent = unit.goal;

  const backBtn = document.getElementById('unit-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };
  }

  // שלב 1: המחשה מוחשית Side-by-Side
  const badPrompt = document.getElementById('demo-bad-prompt');
  if (badPrompt) badPrompt.textContent = `"${unit.step1_demo.badPrompt}"`;
  const badRes = document.getElementById('demo-bad-result');
  if (badRes) badRes.textContent = unit.step1_demo.badResult;
  const goodPrompt = document.getElementById('demo-good-prompt');
  if (goodPrompt) goodPrompt.textContent = `"${unit.step1_demo.goodPrompt}"`;
  const goodRes = document.getElementById('demo-good-result');
  if (goodRes) goodRes.textContent = unit.step1_demo.goodResult;

  const ttsDemoBtn = document.getElementById('tts-demo-btn');
  if (ttsDemoBtn) {
    ttsDemoBtn.onclick = () => {
      SoundService.speakText(`שלב ראשון, המחשה: שים לב להבדל בין שתי הבקשות. כשאומרים: ${unit.step1_demo.badPrompt}, מקבלים תשובה ארוכה ומבלבלת. כשאומרים מדויק: ${unit.step1_demo.goodPrompt}, מקבלים תשובה קצרה ומעולה.`);
    };
  }

  // שלב 2: הסבר קצר + רמזור ה-AI
  const takeawayEl = document.getElementById('unit-takeaway-text');
  if (takeawayEl) takeawayEl.innerHTML = unit.step2_takeaway;
  const ttsExpBtn = document.getElementById('tts-explanation-btn');
  if (ttsExpBtn) {
    ttsExpBtn.onclick = () => SoundService.speakText(unit.step2_takeaway);
  }

  const trafficBox = document.getElementById('traffic-light-container');
  const trafficDesc = document.getElementById('traffic-light-desc');
  if (trafficBox && trafficDesc) {
    const light = unit.trafficLight || 'green';
    trafficBox.className = `traffic-light-box ${light}`;
    trafficDesc.textContent = unit.trafficLightDesc || (light === 'red' ? 'רמזור אדום: חובה להתייעץ עם אדם קרוב!' : light === 'yellow' ? 'רמזור צהוב: בודקים במקור שני!' : 'רמזור ירוק: אפשר להשתמש לבד בכיף!');
  }

  // שלב 3: אסטרטגיה ובחירה לפני ביצוע (Strategy & Choice before execution)
  const quizObj = unit.step3_strategy || unit.step3_quiz;
  const quizQEl = document.getElementById('quiz-question-text');
  if (quizQEl) quizQEl.textContent = quizObj.question;
  const ttsQuizBtn = document.getElementById('tts-quiz-btn');
  if (ttsQuizBtn) {
    ttsQuizBtn.onclick = () => SoundService.speakText(quizObj.question);
  }

  const quizOptionsContainer = document.getElementById('quiz-options-container');
  const quizFeedbackBox = document.getElementById('quiz-feedback-box');
  const actionLockedNotice = document.getElementById('action-locked-notice');
  const actionUnlockedContent = document.getElementById('action-unlocked-content');
  const stepActionBox = document.getElementById('step-action-box');

  if (quizOptionsContainer) quizOptionsContainer.innerHTML = '';
  if (quizFeedbackBox) quizFeedbackBox.style.display = 'none';

  let isStep4Unlocked = unit.isCompleted;
  if (isStep4Unlocked) {
    if (stepActionBox) stepActionBox.classList.remove('locked-step');
    if (actionLockedNotice) actionLockedNotice.style.display = 'none';
    if (actionUnlockedContent) actionUnlockedContent.style.display = 'block';
  } else {
    if (stepActionBox) stepActionBox.classList.add('locked-step');
    if (actionLockedNotice) actionLockedNotice.style.display = 'block';
    if (actionUnlockedContent) actionUnlockedContent.style.display = 'none';
  }

  quizObj.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.innerHTML = `
      <span class="quiz-btn-icon">⚪</span>
      <span class="quiz-btn-text">${opt.text}</span>
    `;

    btn.onclick = () => {
      if (opt.isCorrect) {
        btn.classList.add('correct');
        const icon = btn.querySelector('.quiz-btn-icon');
        if (icon) icon.textContent = '✓';
        SoundService.playSuccessSound();

        if (quizFeedbackBox) {
          quizFeedbackBox.className = 'quiz-feedback-box success';
          quizFeedbackBox.innerHTML = `<span>מעולה דניאל! ${opt.explanation || 'בחירה נכונה של אסטרטגיה!'} משימת הביצוע נפתחה כעת למטה! 🌟</span>`;
          quizFeedbackBox.style.display = 'block';
        }

        if (stepActionBox) stepActionBox.classList.remove('locked-step');
        if (actionLockedNotice) actionLockedNotice.style.display = 'none';
        if (actionUnlockedContent) actionUnlockedContent.style.display = 'block';

        appState.quizHistory.push({
          unitId: unit.id,
          timestamp: new Date().toISOString(),
          isCorrect: true
        });
        saveAppState();
      } else {
        btn.classList.add('incorrect');
        const icon = btn.querySelector('.quiz-btn-icon');
        if (icon) icon.textContent = '✕';
        SoundService.playErrorSound();

        if (quizFeedbackBox) {
          quizFeedbackBox.className = 'quiz-feedback-box error';
          quizFeedbackBox.innerHTML = `<span>לא מדויק: ${opt.explanation || 'חשוב שוב מה הכלל שלמדנו!'} נסה שוב! 💪</span>`;
          quizFeedbackBox.style.display = 'block';
        }

        appState.quizHistory.push({
          unitId: unit.id,
          timestamp: new Date().toISOString(),
          isCorrect: false
        });
        saveAppState();
      }
    };

    if (quizOptionsContainer) quizOptionsContainer.appendChild(btn);
  });

  // שלב 4: משימת 4 החלקים המלאה (ביצוע -> הבנה -> העברה -> שיקוף)
  const missionData = unit.step4_mission || {
    executePrompt: unit.step4_action?.prompt || '',
    doText: unit.step4_action?.doText || 'העתק את הפרומפט והרץ ב-AI:',
    comprehensionQ: 'מה ביקשת מה-AI לעשות?',
    comprehensionOpts: [
      { text: 'לבקש תשובה קצרה ומדויקת', isCorrect: true },
      { text: 'לכתוב ספר ארוך', isCorrect: false }
    ],
    transferPrompt: 'עכשיו שנה מילה אחת בפרומפט ובדוק מה השתנה בתשובה!',
    teachBackText: 'היום למדתי שכשמבקשים מדויק, מקבלים מענה מושלם.'
  };

  const part1 = document.getElementById('mission-part-1');
  const part2 = document.getElementById('mission-part-2');
  const part3 = document.getElementById('mission-part-3');
  const part4 = document.getElementById('mission-part-4');

  // חלק 1: ביצוע
  const promptDisplay = document.getElementById('action-prompt-display');
  if (promptDisplay) promptDisplay.textContent = `"${missionData.executePrompt}"`;
  const doInstruction = document.getElementById('action-do-instruction');
  if (doInstruction) doInstruction.textContent = missionData.doText;

  const copyBtn = document.getElementById('unit-copy-btn');
  if (copyBtn) {
    copyBtn.onclick = () => copyToClipboard(missionData.executePrompt, copyBtn);
  }

  const part1DoneBtn = document.getElementById('part-1-done-btn');
  if (part1DoneBtn) {
    part1DoneBtn.onclick = () => {
      SoundService.playSuccessSound();
      if (part2) {
        part2.style.display = 'block';
        part2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
  }

  // חלק 2: הבנה
  const compQ = document.getElementById('mission-comprehend-q');
  if (compQ) compQ.textContent = missionData.comprehensionQ;
  const compOptions = document.getElementById('mission-comprehend-options');
  const compFeedback = document.getElementById('mission-comprehend-feedback');

  if (compOptions) {
    compOptions.innerHTML = '';
    (missionData.comprehensionOpts || []).forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      btn.innerHTML = `<span class="quiz-btn-icon">⚪</span><span class="quiz-btn-text">${opt.text}</span>`;
      btn.onclick = () => {
        if (opt.isCorrect) {
          btn.classList.add('correct');
          btn.querySelector('.quiz-btn-icon').textContent = '✓';
          SoundService.playSuccessSound();
          if (compFeedback) {
            compFeedback.className = 'quiz-feedback-box success';
            compFeedback.innerHTML = '<span>בול דניאל! הבנת מצוין מה ביקשנו! חלק 3 נפתח כעת! 🎯</span>';
            compFeedback.style.display = 'block';
          }
          if (part3) {
            part3.style.display = 'block';
            part3.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } else {
          btn.classList.add('incorrect');
          btn.querySelector('.quiz-btn-icon').textContent = '✕';
          SoundService.playErrorSound();
          if (compFeedback) {
            compFeedback.className = 'quiz-feedback-box error';
            compFeedback.innerHTML = '<span>לא מדויק, נסה לחשוב שוב מה היה כתוב בפרומפט.</span>';
            compFeedback.style.display = 'block';
          }
        }
      };
      compOptions.appendChild(btn);
    });
  }

  // חלק 3: העברה ("שנה דבר אחד")
  const transferDisplay = document.getElementById('mission-transfer-display');
  if (transferDisplay) transferDisplay.textContent = missionData.transferPrompt;
  const part3DoneBtn = document.getElementById('part-3-done-btn');
  if (part3DoneBtn) {
    part3DoneBtn.onclick = () => {
      SoundService.playSuccessSound();
      if (part4) {
        part4.style.display = 'block';
        part4.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
  }

  // חלק 4: שיקוף אישי
  const teachBackDisplay = document.getElementById('mission-teach-back-display');
  if (teachBackDisplay) teachBackDisplay.textContent = `💡 ${missionData.teachBackText}`;

  // כפתורי סיום, משוב ושיתוף וואטסאפ
  const finishBtn = document.getElementById('unit-finish-btn');
  const feedbackBox = document.getElementById('unit-feedback-box');
  const ribbon = document.getElementById('unit-completed-ribbon');
  const waBtn = document.getElementById('unit-share-wa-btn');

  if (unit.isCompleted) {
    if (part2) part2.style.display = 'block';
    if (part3) part3.style.display = 'block';
    if (part4) part4.style.display = 'block';
    if (finishBtn) finishBtn.style.display = 'none';
    if (feedbackBox) feedbackBox.style.display = 'none';
    if (ribbon) ribbon.style.display = 'flex';
    if (waBtn) {
      waBtn.style.display = 'inline-flex';
      waBtn.onclick = () => {
        shareProgressToWhatsApp(`היי אבא! הרגע סיימתי בהצלחה את יחידה "${unit.title}" במערכת AI! 🎉`);
      };
    }
  } else {
    if (part2) part2.style.display = 'none';
    if (part3) part3.style.display = 'none';
    if (part4) part4.style.display = 'none';
    if (finishBtn) finishBtn.style.display = 'inline-flex';
    if (feedbackBox) feedbackBox.style.display = 'none';
    if (ribbon) ribbon.style.display = 'none';
    if (waBtn) waBtn.style.display = 'none';

    if (finishBtn) {
      finishBtn.onclick = () => {
        finishBtn.style.display = 'none';
        if (feedbackBox) feedbackBox.style.display = 'block';
        feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
    }

    if (feedbackBox) {
      feedbackBox.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.onclick = () => {
          const rating = btn.dataset.rating;
          unit.isCompleted = true;
          unit.feedback = rating;

          appState.feedbackHistory.push({
            unitId: unit.id,
            title: unit.title,
            rating: rating,
            timestamp: new Date().toISOString()
          });

          SoundService.playSuccessSound();
          showToast(`כל הכבוד דניאל! היחידה "${unit.title}" הושלמה! ⭐`);
          saveAppState();
          renderUnitPlayer(unit.id);
        };
      });
    }
  }
}

// ============================================================================
// 8. מנוע מבחני שלב (Checkpoints - Life Scenarios Engine)
// ============================================================================

let currentCheckpoint = null;
let cpQuestions = [];
let cpQuestionIdx = 0;
let cpUserAnswers = [];

function openCheckpointTest(cp) {
  currentCheckpoint = cp;
  
  // הגרלת 4 שאלות מתוך בנק השאלות של מבחן השלב (למניעת שינון עיוור)
  const pool = JSON.parse(JSON.stringify(cp.questionBank || []));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  cpQuestions = pool.slice(0, 4);

  // ערבוב התשובות בכל שאלה שנבחרה
  cpQuestions.forEach(q => {
    for (let i = q.options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
    }
  });

  cpQuestionIdx = 0;
  cpUserAnswers = [];

  showView('checkpoint');
  const header = document.getElementById('checkpoint-view-header');
  if (header) header.textContent = cp.title;

  const backBtn = document.getElementById('checkpoint-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };
  }

  renderCheckpointQuestion();
}

function renderCheckpointQuestion() {
  const total = cpQuestions.length;
  const q = cpQuestions[cpQuestionIdx];

  const stepText = document.getElementById('checkpoint-step-text');
  if (stepText) stepText.textContent = `שאלה ${cpQuestionIdx + 1} מתוך ${total}`;
  const bar = document.getElementById('checkpoint-progress-bar');
  if (bar) bar.style.width = `${((cpQuestionIdx + 1) / total) * 100}%`;

  const area = document.getElementById('checkpoint-content-area');
  if (!area) return;

  area.innerHTML = `
    <div style="margin-top: 1.5rem;">
      <h3 class="question-title" style="font-size: 1.35rem; line-height: 1.4; margin-bottom: 1.5rem;">${q.question}</h3>
      <div class="quiz-options-grid" id="cp-options-container"></div>
    </div>
  `;

  const optContainer = document.getElementById('cp-options-container');
  q.options.forEach((opt, oIdx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.innerHTML = `
      <span class="quiz-btn-icon">⚪</span>
      <span class="quiz-btn-text">${opt.text}</span>
    `;

    btn.onclick = () => {
      optContainer.querySelectorAll('.quiz-option-btn').forEach(b => {
        b.classList.remove('selected');
        const icon = b.querySelector('.quiz-btn-icon');
        if (icon) icon.textContent = '⚪';
      });
      btn.classList.add('selected');
      const icon = btn.querySelector('.quiz-btn-icon');
      if (icon) icon.textContent = '🔘';
      cpUserAnswers[cpQuestionIdx] = oIdx;

      const nextBtn = document.getElementById('checkpoint-next-btn');
      if (nextBtn) nextBtn.disabled = false;
    };

    if (optContainer) optContainer.appendChild(btn);
  });

  const footer = document.getElementById('checkpoint-nav-footer');
  if (footer) {
    footer.innerHTML = `
      <button id="checkpoint-next-btn" class="primary-btn" disabled style="width: 100%;">
        <span>${cpQuestionIdx + 1 < total ? 'המשך לשאלה הבאה ▶' : 'בדוק את תוצאות המבחן! 🏆'}</span>
      </button>
    `;
  }

  const ttsBtn = document.getElementById('tts-checkpoint-q-btn');
  if (ttsBtn) {
    ttsBtn.onclick = () => SoundService.speakText(`שאלה ${cpQuestionIdx + 1}. ${q.question}`);
  }

  const nextBtn = document.getElementById('checkpoint-next-btn');
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (cpQuestionIdx + 1 < total) {
        cpQuestionIdx++;
        renderCheckpointQuestion();
      } else {
        finishCheckpointTest();
      }
    };
  }

  SoundService.speakText(`שאלה ${cpQuestionIdx + 1}. ${q.question}`);
}

function finishCheckpointTest() {
  const total = cpQuestions.length;
  let correct = 0;
  cpQuestions.forEach((q, idx) => {
    const chosen = cpUserAnswers[idx];
    if (chosen !== undefined && q.options[chosen] && q.options[chosen].isCorrect) {
      correct++;
    }
  });

  const finalScore = Math.round((correct / total) * 100);
  const passed = finalScore >= 85;

  currentCheckpoint.lastScore = finalScore;
  if (passed) {
    currentCheckpoint.isPassed = true;
    saveAppState();
    SoundService.playSuccessSound();
  }

  const area = document.getElementById('checkpoint-content-area');
  const footer = document.getElementById('checkpoint-nav-footer');

  if (area) {
    area.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem;">
        <div style="font-size: 3.5rem; margin-bottom: 0.8rem;">${passed ? '🏆 ⭐ 🎉' : '💡 💪'}</div>
        <h2 class="question-title" style="color: ${passed ? 'var(--success)' : 'var(--warning)'}; margin-bottom: 0.6rem;">
          ציון במבחן: ${finalScore}
        </h2>
        <p style="font-size: 1.15rem; color: var(--text-secondary); max-width: 500px; margin: 0 auto 1.5rem auto;">
          ${passed 
            ? 'כל הכבוד דניאל! עברת את מבחן השלב בהצלחה מרובה! השלב הבא במסלול נפתח עבורך כעת.'
            : `קיבלת ציון ${finalScore}. כדי להמשיך לשלב הבא יש לקבל 85 ומעלה. לא נורא, מכל ניסיון לומדים! לחץ למטה ונעשה את המבחן שוב עם סיטואציות חדשות.`}
        </p>

        ${passed ? `
          <div style="margin: 1.5rem 0;">
            <button class="share-whatsapp-btn" onclick="shareProgressToWhatsApp('היי אבא! עברתי בהצלחה את ${currentCheckpoint.title} בציון ${finalScore}! 🏆 השלבים הבאים נפתחו!')">
              <span>שלח עדכון לאבא ב-WhatsApp 📲</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  if (footer) {
    footer.innerHTML = passed
      ? `<button class="primary-btn" onclick="showView('roadmap');renderRoadmap();" style="width: 100%;"><span>מעולה! חזרה למסלול האישי 🌟</span></button>`
      : `<button class="primary-btn" onclick="openCheckpointTest(currentCheckpoint)" style="width: 100%;"><span>נסה שוב עם סיטואציות חדשות 🔄</span></button>`;
  }

  SoundService.speakText(passed 
    ? `כל הכבוד דניאל! קיבלת ציון ${finalScore} ועברת בהצלחה! השלב הבא נפתח כעת.`
    : `קיבלת ציון ${finalScore}. כדי להמשיך צריך 85 ומעלה. ננסה שוב ונעבור יחד!`
  );
}

// ============================================================================
// 9. מנוע מבחן מסכם אוטומטי בהנהלת חשבונות (Accounting Automated Summary Exam)
// ============================================================================

let currentAccountingExamIdx = 0;

async function openAccountingSummaryExam(forceNew = false) {
  showView('checkpoint');

  const header = document.getElementById('checkpoint-view-header');
  if (header) header.textContent = '🏆 מבחן מסכם אוטומטי בהנהלת חשבונות';

  const backBtn = document.getElementById('checkpoint-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };
  }

  const area = document.getElementById('checkpoint-content-area');
  const footer = document.getElementById('checkpoint-nav-footer');
  const stepText = document.getElementById('checkpoint-step-text');
  const bar = document.getElementById('checkpoint-progress-bar');

  if (!appState.accountingExam || typeof appState.accountingExam !== 'object') {
    appState.accountingExam = { activeExam: null, attempts: [], bestScore: 0, lastAttemptAt: null, isPassed: false };
  }

  const hasValidSavedExam = !forceNew &&
    appState.accountingExam.activeExam &&
    Array.isArray(appState.accountingExam.activeExam.questions) &&
    appState.accountingExam.activeExam.questions.length > 0;

  if (!hasValidSavedExam) {
    if (stepText) stepText.textContent = 'מייצר מבחן מותאם אישית... ⏳';
    if (bar) bar.style.width = '15%';
    if (footer) footer.innerHTML = '';
    if (area) {
      area.innerHTML = `
        <div class="accounting-exam-loading">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">🤖 📊</div>
          <h3 style="margin-bottom: 0.5rem;">מנוע ה-AI בונה עבורך מבחן מסכם בהנהלת חשבונות...</h3>
          <p style="color: var(--text-secondary);">המבחן כולל שאלות אמריקאיות, שאלות חישוב (מע"מ והנחות) ואיזון פקודות יומן.</p>
        </div>
      `;
    }

    const accountingTrack = TRACKS.find(t => t.id === 'accounting') || getActiveTrack();
    const allUnits = getTrackUnits(accountingTrack);
    const completedUnits = allUnits.filter(u => u.isCompleted);

    const generated = await AIService.generateAccountingSummaryExam({
      completedUnits: completedUnits.length > 0 ? completedUnits : allUnits
    });

    const activeExamObj = {
      id: `acc_exam_${Date.now()}`,
      title: generated.title || 'מבחן מסכם בהנהלת חשבונות',
      generatedAt: new Date().toISOString(),
      provider: generated.provider || 'local',
      questions: generated.questions || [],
      userAnswers: {}
    };

    saveAccountingExamState(activeExamObj);
    currentAccountingExamIdx = 0;
  } else {
    const questions = appState.accountingExam.activeExam.questions;
    const answers = appState.accountingExam.activeExam.userAnswers || {};
    const firstUnanswered = questions.findIndex((q, idx) => {
      const val = answers[q.id] !== undefined ? answers[q.id] : answers[idx];
      return val === undefined || val === null || String(val).trim() === '';
    });
    currentAccountingExamIdx = firstUnanswered >= 0 ? firstUnanswered : 0;
  }

  renderAccountingExamQuestion();
}

function isAccountingQuestionAnswered(q, idx, userAnswers) {
  if (!userAnswers) return false;
  const raw = userAnswers[q.id] !== undefined ? userAnswers[q.id] : userAnswers[idx];
  return raw !== undefined && raw !== null && String(raw).trim() !== '';
}

function renderAccountingExamQuestion() {
  const activeExam = appState.accountingExam?.activeExam;
  if (!activeExam || !Array.isArray(activeExam.questions) || activeExam.questions.length === 0) return;

  const questions = activeExam.questions;
  const total = questions.length;
  if (currentAccountingExamIdx < 0) currentAccountingExamIdx = 0;
  if (currentAccountingExamIdx >= total) currentAccountingExamIdx = total - 1;

  const q = questions[currentAccountingExamIdx];
  const userAnswers = activeExam.userAnswers || {};
  const currentVal = userAnswers[q.id] !== undefined ? userAnswers[q.id] : (userAnswers[currentAccountingExamIdx] ?? '');

  const answeredCount = questions.filter((item, idx) => isAccountingQuestionAnswered(item, idx, userAnswers)).length;
  const allAnswered = answeredCount === total;

  const stepText = document.getElementById('checkpoint-step-text');
  if (stepText) {
    stepText.textContent = `שאלה ${currentAccountingExamIdx + 1} מתוך ${total} (נענו: ${answeredCount}/${total})`;
  }
  const bar = document.getElementById('checkpoint-progress-bar');
  if (bar) {
    bar.style.width = `${((currentAccountingExamIdx + 1) / total) * 100}%`;
  }

  const area = document.getElementById('checkpoint-content-area');
  const footer = document.getElementById('checkpoint-nav-footer');
  if (!area) return;

  const typeBadgeMap = {
    multiple_choice: 'שאלה אמריקאית 🔘',
    calculation: 'חישוב חשבונאי 🧮',
    open_journal_or_case: 'פקודת יומן / אירוע עסקי 📖'
  };
  const typeLabel = typeBadgeMap[q.type] || 'שאלה מקצועית 📊';

  area.innerHTML = `
    <div class="accounting-exam-player">
      <!-- סרגל ניווט מהיר בין שאלות -->
      <div class="accounting-exam-q-nav" role="tablist" aria-label="מעבר בין שאלות המבחן">
        ${questions.map((item, idx) => {
          const answered = isAccountingQuestionAnswered(item, idx, userAnswers);
          const isCurrent = idx === currentAccountingExamIdx;
          return `
            <button type="button" class="exam-q-pill ${isCurrent ? 'current' : ''} ${answered ? 'answered' : ''}" data-q-idx="${idx}">
              <span>${idx + 1}${answered ? ' ✓' : ''}</span>
            </button>
          `;
        }).join('')}
      </div>

      <div class="accounting-exam-q-card">
        <div class="accounting-exam-q-meta">
          <span class="badge-tag" style="background:#e0f2fe;color:#0369a1;">${typeLabel}</span>
          <span class="badge-tag" style="background:#f1f5f9;color:#334155;">נושא: ${q.topic || 'הנהלת חשבונות'}</span>
          <span class="badge-tag" style="background:#fef3c7;color:#b45309;">ניקוד: ${q.points || 15} נק'</span>
        </div>

        <h3 class="question-title accounting-exam-q-title">${q.question}</h3>

        <div id="accounting-exam-input-zone" class="accounting-exam-input-zone"></div>
      </div>
    </div>
  `;

  // ניווט בין כפתורי השאלות
  area.querySelectorAll('.exam-q-pill').forEach(pill => {
    pill.onclick = () => {
      const targetIdx = Number(pill.getAttribute('data-q-idx'));
      if (!Number.isNaN(targetIdx)) {
        currentAccountingExamIdx = targetIdx;
        renderAccountingExamQuestion();
      }
    };
  });

  const inputZone = area.querySelector('#accounting-exam-input-zone');

  const persistDraftAnswer = (val) => {
    if (!appState.accountingExam.activeExam.userAnswers) {
      appState.accountingExam.activeExam.userAnswers = {};
    }
    appState.accountingExam.activeExam.userAnswers[q.id] = val;
    appState.accountingExam.activeExam.userAnswers[currentAccountingExamIdx] = val;
    saveAccountingExamState(appState.accountingExam.activeExam);
  };

  if (q.type === 'multiple_choice' && Array.isArray(q.options) && q.options.length > 0) {
    const optGrid = document.createElement('div');
    optGrid.className = 'quiz-options-grid';

    q.options.forEach((optText, oIdx) => {
      const isSelected = String(currentVal) === String(oIdx) || String(currentVal).trim() === String(optText).trim();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `quiz-option-btn ${isSelected ? 'selected' : ''}`;
      btn.innerHTML = `
        <span class="quiz-btn-icon">${isSelected ? '🔘' : '⚪'}</span>
        <span class="quiz-btn-text">${optText}</span>
      `;
      btn.onclick = () => {
        persistDraftAnswer(oIdx);
        renderAccountingExamQuestion();
      };
      optGrid.appendChild(btn);
    });

    if (inputZone) inputZone.appendChild(optGrid);
  } else if (q.type === 'calculation') {
    if (inputZone) {
      inputZone.innerHTML = `
        <div class="accounting-exam-calc-box">
          <label for="acc-exam-calc-input" class="study-input-label">🔢 הקלד את התוצאה המספרית (או החישוב):</label>
          <input
            type="text"
            inputmode="decimal"
            id="acc-exam-calc-input"
            class="styled-input accounting-exam-calc-input"
            placeholder="לדוגמה: 180 או 1,180 ש״ח"
            value="${String(currentVal || '').replace(/"/g, '&quot;')}"
          />
          <span class="study-input-hint">💾 התשובה נשמרת אוטומטית תוך כדי הקלדה.</span>
        </div>
      `;
      const calcInput = inputZone.querySelector('#acc-exam-calc-input');
      if (calcInput) {
        calcInput.addEventListener('input', () => {
          persistDraftAnswer(calcInput.value);
          updateAccountingExamFooterState();
        });
      }
    }
  } else {
    if (inputZone) {
      inputZone.innerHTML = `
        <div class="accounting-exam-open-box">
          <label for="acc-exam-open-input" class="study-input-label">✍️ רשום את פקודת היומן (חובה / זכות וסכומים) או את הפתרון המלא:</label>
          <textarea
            id="acc-exam-open-input"
            class="styled-textarea accounting-exam-open-textarea"
            rows="4"
            placeholder="לדוגמה: חובה הוצאות ציוד 1,000 ש״ח, חובה מע״מ תשומות 180 ש״ח — זכות ספקים/עו״ש 1,180 ש״ח"
          >${String(currentVal || '')}</textarea>
          <span class="study-input-hint">💾 הטיוטה נשמרת אוטומטית. הקפד לציין אילו חשבונות בחובה, אילו בזכות ומה הסכום.</span>
        </div>
      `;
      const openInput = inputZone.querySelector('#acc-exam-open-input');
      if (openInput) {
        openInput.addEventListener('input', () => {
          persistDraftAnswer(openInput.value);
          updateAccountingExamFooterState();
        });
      }
    }
  }

  const ttsBtn = document.getElementById('tts-checkpoint-q-btn');
  if (ttsBtn) {
    ttsBtn.onclick = () => SoundService.speakText(`שאלה ${currentAccountingExamIdx + 1}. ${q.question}`);
  }

  updateAccountingExamFooterState();
}

function updateAccountingExamFooterState() {
  const activeExam = appState.accountingExam?.activeExam;
  if (!activeExam || !Array.isArray(activeExam.questions)) return;
  const questions = activeExam.questions;
  const total = questions.length;
  const userAnswers = activeExam.userAnswers || {};
  const answeredCount = questions.filter((item, idx) => isAccountingQuestionAnswered(item, idx, userAnswers)).length;
  const allAnswered = answeredCount === total;

  const stepText = document.getElementById('checkpoint-step-text');
  if (stepText) {
    stepText.textContent = `שאלה ${currentAccountingExamIdx + 1} מתוך ${total} (נענו: ${answeredCount}/${total})`;
  }

  const footer = document.getElementById('checkpoint-nav-footer');
  if (!footer) return;

  const hasPrev = currentAccountingExamIdx > 0;
  const hasNext = currentAccountingExamIdx < total - 1;

  footer.innerHTML = `
    <div class="accounting-exam-footer-bar">
      <div class="accounting-exam-nav-btns">
        <button type="button" id="acc-exam-prev-btn" class="secondary-btn" ${!hasPrev ? 'disabled' : ''}>
          <span>◀ שאלה קודמת</span>
        </button>
        ${hasNext ? `
          <button type="button" id="acc-exam-next-btn" class="primary-btn">
            <span>שאלה הבאה ▶</span>
          </button>
        ` : ''}
      </div>
      <button type="button" id="acc-exam-submit-btn" class="primary-btn acc-exam-submit-btn ${allAnswered ? 'ready' : ''}">
        <span>הגש מבחן לבדיקה 🏆 (${answeredCount}/${total})</span>
      </button>
    </div>
  `;

  const prevBtn = footer.querySelector('#acc-exam-prev-btn');
  const nextBtn = footer.querySelector('#acc-exam-next-btn');
  const submitBtn = footer.querySelector('#acc-exam-submit-btn');

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentAccountingExamIdx > 0) {
        currentAccountingExamIdx--;
        renderAccountingExamQuestion();
      }
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentAccountingExamIdx < total - 1) {
        currentAccountingExamIdx++;
        renderAccountingExamQuestion();
      }
    };
  }
  if (submitBtn) {
    submitBtn.onclick = () => submitAccountingSummaryExam();
  }
}

async function submitAccountingSummaryExam() {
  const activeExam = appState.accountingExam?.activeExam;
  if (!activeExam || !Array.isArray(activeExam.questions)) return;

  const questions = activeExam.questions;
  const userAnswers = activeExam.userAnswers || {};
  const unansweredIdx = questions.findIndex((q, idx) => !isAccountingQuestionAnswered(q, idx, userAnswers));

  if (unansweredIdx !== -1) {
    showToast(`דניאל, נותרה שאלה ${unansweredIdx + 1} ללא תשובה. השלם אותה לפני הגשת המבחן! ✍️`);
    currentAccountingExamIdx = unansweredIdx;
    renderAccountingExamQuestion();
    return;
  }

  const submitBtn = document.getElementById('acc-exam-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>בודק את המבחן ומחשב ציון... ⏳</span>';
  }

  const evaluation = await AIService.evaluateAccountingExam({
    questions,
    userAnswers
  });

  if (activeExam.homeworkExamId && Array.isArray(appState.accountingExam?.homeworkExams)) {
    const hwExam = appState.accountingExam.homeworkExams.find(e => e.id === activeExam.homeworkExamId);
    if (hwExam) {
      hwExam.isNew = false;
      hwExam.status = 'completed';
      if (!Array.isArray(hwExam.attempts)) hwExam.attempts = [];
      hwExam.attempts.unshift({
        id: `hw_attempt_${Date.now()}`,
        score: evaluation.score,
        passed: evaluation.passed,
        completedAt: new Date().toISOString()
      });
      hwExam.bestScore = Math.max(Number(hwExam.bestScore) || 0, Number(evaluation.score) || 0);
      saveAppState();
    }
  }

  recordAccountingExamAttempt({
    score: evaluation.score,
    passed: evaluation.passed,
    totalQuestions: questions.length,
    correctCount: evaluation.correctCount,
    feedback: evaluation.overallFeedback,
    breakdown: evaluation.breakdown
  });

  if (evaluation.passed && typeof SoundService !== 'undefined') {
    SoundService.playSuccessSound();
  }

  renderAccountingExamResults(evaluation, questions, userAnswers, activeExam.title);
}

function renderAccountingExamResults(evaluation, questions, userAnswers, examTitle = '') {
  const area = document.getElementById('checkpoint-content-area');
  const footer = document.getElementById('checkpoint-nav-footer');
  const stepText = document.getElementById('checkpoint-step-text');
  const bar = document.getElementById('checkpoint-progress-bar');

  if (stepText) stepText.textContent = `סיכום תוצאות המבחן המסכם (${evaluation.score}%)`;
  if (bar) bar.style.width = '100%';

  if (area) {
    const passed = !!evaluation.passed;
    const breakdown = Array.isArray(evaluation.breakdown) ? evaluation.breakdown : [];
    const safeExamLabel = String(examTitle || 'מבחן מסכם בהנהלת חשבונות').replace(/['"]/g, '');

    area.innerHTML = `
      <div class="accounting-exam-results">
        <div class="accounting-exam-score-banner ${passed ? 'passed' : 'needs-work'}">
          <div class="exam-score-icon">${passed ? '🏆 ⭐ 🎉' : '💪 📈'}</div>
          <div class="exam-score-badge">${evaluation.score}%</div>
          <h2 class="exam-score-title">
            ${passed ? 'כל הכבוד דניאל! עברת בהצלחה את המבחן המסכם בהנהלת חשבונות!' : 'ניסיון מצוין דניאל! בוא נעבור על הפתרונות וננסה שוב'}
          </h2>
          <p class="exam-score-feedback">${evaluation.overallFeedback || ''}</p>
          <div class="exam-score-stats">
            <span class="badge-tag" style="background:#ffffff;color:#0f172a;">נקודות שצברת: ${evaluation.earnedPoints || 0} מתוך ${evaluation.totalPoints || 100}</span>
            <span class="badge-tag" style="background:#ffffff;color:#0f172a;">תשובות מדויקות: ${evaluation.correctCount || 0} מתוך ${questions.length}</span>
          </div>
          ${passed ? `
            <div style="margin-top: 1.15rem;">
              <button type="button" class="share-whatsapp-btn" onclick="shareProgressToWhatsApp('היי אבא ואושרי! סיימתי בהצלחה את ${safeExamLabel} בציון ${evaluation.score}%! 🏆📊')">
                <span>שלח עדכון משמח לאבא ואושרי ב-WhatsApp 📲</span>
              </button>
            </div>
          ` : ''}
        </div>

        <h3 style="margin: 1.5rem 0 0.85rem 0; font-size: 1.2rem;">📋 פירוט מלא שאלה אחר שאלה:</h3>
        <div class="accounting-exam-review-list">
          ${questions.map((q, idx) => {
            const item = breakdown.find(b => b.questionId === q.id) || breakdown[idx] || {};
            const status = item.status || (item.isCorrect ? 'correct' : 'incorrect');
            const statusLabel = status === 'correct'
              ? '✅ תשובה נכונה'
              : status === 'partial'
                ? '🟡 תשובה חלקית'
                : '❌ דורש חיזוק';

            let formattedUserAns = item.userAnswer;
            if (q.type === 'multiple_choice' && Array.isArray(q.options)) {
              const numIdx = Number(formattedUserAns);
              if (!Number.isNaN(numIdx) && q.options[numIdx] !== undefined) {
                formattedUserAns = q.options[numIdx];
              }
            }

            const correctSolutionText = item.correctAnswer ||
              (q.type === 'multiple_choice' && Array.isArray(q.options) ? q.options[Number(q.correctOptionIndex) || 0] : q.correctAnswer);

            return `
              <div class="exam-review-card status-${status}">
                <div class="exam-review-header">
                  <div>
                    <strong>שאלה ${idx + 1}: ${q.topic || 'הנהלת חשבונות'}</strong>
                  </div>
                  <div style="display:flex; gap:0.5rem; align-items:center;">
                    <span class="badge-tag">${item.earnedPoints ?? 0}/${item.maxPoints ?? q.points ?? 15} נק'</span>
                    <span class="exam-status-pill ${status}">${statusLabel}</span>
                  </div>
                </div>
                <p class="exam-review-q-text">${q.question}</p>
                <div class="exam-review-answers">
                  <div class="exam-review-ans-row">
                    <span class="ans-label">התשובה שלך:</span>
                    <span class="ans-val">${formattedUserAns || 'לא הוזנה תשובה'}</span>
                  </div>
                  <div class="exam-review-ans-row correct-row">
                    <span class="ans-label">הפתרון המדויק:</span>
                    <span class="ans-val"><strong>${correctSolutionText || ''}</strong></span>
                  </div>
                  <div class="exam-review-explanation">
                    💡 <strong>הסבר מקצועי:</strong> ${item.explanation || q.explanation || ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  if (footer) {
    footer.innerHTML = `
      <div class="accounting-exam-footer-bar">
        <button type="button" id="acc-exam-back-roadmap-btn" class="secondary-btn">
          <span>חזור למפת הלמידה 🗺️</span>
        </button>
        <button type="button" id="acc-exam-retry-new-btn" class="primary-btn" style="background: #d97706;">
          <span>נסה מבחן חדש עם שאלות חדשות 🔄</span>
        </button>
      </div>
    `;

    const backRoadmapBtn = footer.querySelector('#acc-exam-back-roadmap-btn');
    const retryNewBtn = footer.querySelector('#acc-exam-retry-new-btn');

    if (backRoadmapBtn) {
      backRoadmapBtn.onclick = () => {
        showView('roadmap');
        renderRoadmap();
      };
    }
    if (retryNewBtn) {
      retryNewBtn.onclick = () => {
        openAccountingSummaryExam(true);
      };
    }
  }
}

// ============================================================================
// 10. נגן כרטיס לימוד יומי ומנטור סוקרטי (Milestone 3 Step 3 — Daily Study Card Player)
// ============================================================================

let currentDailyCardId = null;
let currentDailyQuestionIdx = 0;

function openDailyStudyCard(cardId) {
  const cards = appState.studyHelp?.dailyCards || [];
  const card = cards.find(c => c.id === cardId) || cards[cards.length - 1];
  if (!card) {
    showToast('לא נמצאה יחידת התרגול המבוקשת.', 'warning');
    return null;
  }

  card.isNew = false;
  appState.studyHelp.activeCardId = card.id;
  currentDailyCardId = card.id;

  const questions = Array.isArray(card.questions) ? card.questions : [];
  const firstPending = questions.findIndex(q => !q.isCompleted);
  currentDailyQuestionIdx = firstPending >= 0 ? firstPending : 0;

  saveAppState();
  showView('unit');

  const legacyWrapper = document.getElementById('unit-steps-wrapper');
  const blocksWrapper = document.getElementById('unit-blocks-wrapper');
  if (legacyWrapper) legacyWrapper.style.display = 'none';
  if (blocksWrapper) {
    blocksWrapper.style.display = 'flex';
    blocksWrapper.innerHTML = '';
  }

  const titleEl = document.getElementById('unit-view-title');
  if (titleEl) titleEl.textContent = card.title || 'יחידת תרגול יומית';
  const mainTitleEl = document.getElementById('unit-main-title');
  if (mainTitleEl) mainTitleEl.textContent = card.title || 'יחידת תרגול יומית';
  const badgeEl = document.getElementById('unit-topic-badge');
  if (badgeEl) badgeEl.textContent = `📅 יחידה יומית • ${card.dateLabel || new Date().toLocaleDateString('he-IL')}`;
  const goalEl = document.getElementById('unit-goal-desc');
  if (goalEl) goalEl.textContent = 'כללי אצבע בגובה העיניים + ליווי אישי שאלה אחר שאלה עם מאמן ה-AI';

  const backBtn = document.getElementById('unit-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };
  }

  renderDailyStudyCardView(card);
  return card;
}

const openDailyStudyCardPlayer = openDailyStudyCard;

function renderDailyStudyCardView(card) {
  const blocksWrapper = document.getElementById('unit-blocks-wrapper');
  if (!blocksWrapper || !card) return;

  const rules = Array.isArray(card.introAndRules) && card.introAndRules.length > 0
    ? card.introAndRules
    : ['קרא כל שאלה בנחת, זהה את הנתונים ובדוק מה בחובה ומה בזכות.'];

  const questions = Array.isArray(card.questions) ? card.questions : [];
  const totalQ = questions.length;
  if (currentDailyQuestionIdx < 0) currentDailyQuestionIdx = 0;
  if (currentDailyQuestionIdx >= totalQ && totalQ > 0) currentDailyQuestionIdx = totalQ - 1;

  const currentQ = questions[currentDailyQuestionIdx] || {
    id: 'default_q_1',
    index: 1,
    questionText: 'רשום את השאלה הראשונה מתוך דף העבודה ונפתור אותה יחד.',
    topic: 'תרגול יומי',
    hint: 'זהה תחילה את הנתונים בשאלה.',
    coreConcept: 'פתרון מונחה צעד אחר צעד',
    isCompleted: false,
    chatHistory: []
  };

  if (!Array.isArray(currentQ.chatHistory)) {
    currentQ.chatHistory = [];
  }

  const completedCount = questions.filter(q => q.isCompleted).length;
  const allCompleted = totalQ > 0 && completedCount === totalQ;
  const isLastQuestion = currentDailyQuestionIdx === totalQ - 1;

  blocksWrapper.innerHTML = `
    <div class="daily-card-player-container">
      <!-- b) Top Section: הקדמה וכללי אצבע לחומר של היום -->
      <div class="lesson-block daily-card-rules-box">
        <div class="daily-rules-header">
          <div style="display:flex; align-items:center; gap:0.55rem;">
            <span style="font-size:1.5rem;">🧭</span>
            <h3 class="daily-rules-title">הקדמה וכללי אצבע לחומר של היום</h3>
          </div>
          <button type="button" id="daily-rules-tts-btn" class="study-tts-msg-btn" title="הקרא כללי אצבע">
            🔊 הקרא כללים
          </button>
        </div>
        <ul class="daily-rules-list">
          ${rules.map(rule => `<li class="daily-rule-item">✨ ${rule}</li>`).join('')}
        </ul>
      </div>

      <!-- c) Question Stepper Header -->
      <div class="lesson-block daily-question-stepper-box">
        <div class="daily-stepper-top-row">
          <span class="daily-stepper-counter" id="daily-stepper-counter">
            שאלה ${currentDailyQuestionIdx + 1} מתוך ${totalQ} בדף העבודה
          </span>
          <span class="badge-tag" style="background:#f0fdf4;color:#047857;">
            הושלמו ${completedCount} מתוך ${totalQ} שאלות ✓
          </span>
        </div>

        <div class="daily-q-pills-row" role="tablist" aria-label="שאלות בדף העבודה">
          ${questions.map((qItem, idx) => {
            const isCurr = idx === currentDailyQuestionIdx;
            const isDone = Boolean(qItem.isCompleted);
            return `
              <button
                type="button"
                class="exam-q-pill daily-q-pill ${isCurr ? 'current' : ''} ${isDone ? 'answered' : ''}"
                data-daily-q-idx="${idx}"
              >
                <span>שאלה ${idx + 1}${isDone ? ' ✓' : ''}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- d) Socratic Mentor Chat Area (Question-by-Question) -->
      <div class="lesson-block daily-socratic-mentor-box">
        <!-- Current Homework Question Banner -->
        <div class="daily-current-q-banner">
          <div class="daily-current-q-meta">
            <span class="badge-tag" style="background:#dbeafe;color:#1d4ed8;">📌 שאלה ${currentDailyQuestionIdx + 1} מתוך ${totalQ}</span>
            <span class="badge-tag" style="background:#f1f5f9;color:#334155;">נושא: ${currentQ.topic || 'חומר יומי'}</span>
            ${currentQ.isCompleted ? `<span class="badge-tag" style="background:#dcfce7;color:#15803d;">✅ נפתרה בהצלחה!</span>` : ''}
          </div>
          <div class="daily-current-q-text-row">
            <h4 class="daily-current-q-text" id="daily-current-q-text">${currentQ.questionText}</h4>
            <button type="button" id="daily-current-q-tts-btn" class="study-tts-msg-btn" title="הקרא שאלה">
              🔊 הקרא שאלה
            </button>
          </div>
        </div>

        <!-- Conversation Feed for Current Question -->
        <div class="study-chat-feed daily-question-chat-feed" id="daily-question-chat-feed">
          ${currentQ.chatHistory.length === 0 ? `
            <div class="study-msg-bubble assistant-msg">
              <div class="study-msg-header">
                <span class="study-msg-author">🤖 המאמן הסוקרטי של דניאל</span>
              </div>
              <div class="study-msg-content">
                שלום דניאל! קרא בנחת את <strong>שאלה ${currentDailyQuestionIdx + 1}</strong> למעלה. 
                אפשר לכתוב לי איך אתה חושב שפותרים אותה, או ללחוץ על אחד מכפתורי העזרה המהירה למטה ונתקדם יחד צעד אחר צעד! 🌱
              </div>
            </div>
          ` : currentQ.chatHistory.map((msg, mIdx) => `
            <div class="study-msg-bubble ${msg.role === 'user' ? 'user-msg' : 'assistant-msg'}" data-chat-idx="${mIdx}">
              <div class="study-msg-header">
                <span class="study-msg-author">${msg.role === 'user' ? '👤 דניאל' : '🤖 המאמן הסוקרטי'}</span>
                ${msg.role !== 'user' ? `
                  <button type="button" class="study-tts-msg-btn daily-chat-tts-btn" data-chat-tts-idx="${mIdx}">
                    🔊 הקרא
                  </button>
                ` : ''}
              </div>
              <div class="study-msg-content">${typeof formatStudyMessageHtml === 'function' ? formatStudyMessageHtml(msg.text) : msg.text}</div>
            </div>
          `).join('')}
        </div>

        <!-- 3 Quick Helper Buttons -->
        <div class="daily-quick-helpers-bar">
          <button type="button" class="study-starter-btn daily-helper-btn" data-helper-action="hint">
            <span>💡 תן לי רמז מכוון</span>
          </button>
          <button type="button" class="study-starter-btn daily-helper-btn" data-helper-action="simplify">
            <span>📖 תסביר לי את השאלה בפשטות</span>
          </button>
          <button type="button" class="study-starter-btn daily-helper-btn" data-helper-action="how_to_start">
            <span>🧮 איך מתחילים לפתור?</span>
          </button>
        </div>

        <!-- Answer Input Box & Submit -->
        <div class="study-input-panel daily-answer-input-panel">
          <label for="daily-q-answer-input" class="study-input-label">
            ✍️ כתוב כאן את הפתרון שלך או שאלה למאמן על שאלה ${currentDailyQuestionIdx + 1}:
          </label>
          <textarea
            id="daily-q-answer-input"
            class="styled-textarea study-help-textarea"
            rows="3"
            placeholder="כתוב כאן את החישוב, פקודת היומן או התשובה שלך..."
          ></textarea>
          <div class="study-input-actions">
            <span class="study-input-hint">💡 המאמן יבדוק את התשובה וידריך אותך בעדינות עד לפתרון המלא.</span>
            <button type="button" id="daily-q-submit-btn" class="primary-btn">
              <span>שלח תשובה למאמן ▶</span>
            </button>
          </div>
        </div>

        <!-- Next Question / Sheet Completion Banner when Solved -->
        ${currentQ.isCompleted ? `
          <div class="daily-q-solved-banner" id="daily-q-solved-banner">
            <div class="daily-solved-text">
              🎉 כל הכבוד דניאל! פתרת בהצלחה את שאלה ${currentDailyQuestionIdx + 1}!
            </div>
            ${!isLastQuestion ? `
              <button type="button" id="daily-q-next-btn" class="primary-btn daily-next-q-btn">
                <span>מעולה! עבור לשאלה הבאה בדף ⬅</span>
              </button>
            ` : `
              <button type="button" id="daily-card-finish-btn" class="primary-btn daily-finish-card-btn">
                <span>סיימתי את כל שאלות דף העבודה בהצלחה! 🏆</span>
              </button>
            `}
          </div>
        ` : ''}

        ${allCompleted || card.isCompleted ? `
          <div class="daily-card-all-completed-box" id="daily-card-all-completed-box">
            <h4>🏆 אלוף דניאל! השלמת את כל ${totalQ} השאלות ביחידה היומית הזו! ⭐</h4>
            <p>כל התשובות והשיחות נשמרו בהצלחה בכרטיס היומי שלך.</p>
          </div>
          <div class="homework-completion-modal" id="homework-completion-modal" role="dialog" aria-modal="true" aria-labelledby="hw-completion-modal-title">
            <div class="homework-completion-modal-card">
              <div class="homework-completion-confetti">🎉 🏆 🌟</div>
              <h3 class="homework-completion-title" id="hw-completion-modal-title">
                🎉 כל הכבוד דניאל! סיימת את כל שאלות דף העבודה!
              </h3>
              <p class="homework-completion-desc">
                השלמת בהצלחה את כל השאלות ביחידה <strong>"${card.title}"</strong>!<br>
                מאמן ה-AI יצר עבורך אוטומטית <strong>מבחן מסכם מעשי חדש</strong> על החומר של היום, והוא מחכה לך עכשיו בטאב <strong>"הנהלת חשבונות"</strong> באזור <strong>"🏆 מבחנים מסכמים מתרגול שיעורי הבית"</strong>!
              </p>
              <div class="homework-completion-actions">
                <button type="button" id="hw-modal-go-accounting-btn" class="primary-btn hw-modal-go-btn">
                  <span>🏆 עבור עכשיו למבחן המסכם בהנהלת חשבונות</span>
                </button>
                <button type="button" id="hw-modal-back-study-btn" class="secondary-btn hw-modal-back-btn">
                  <span>חזור לטאב עזרה בלימודים</span>
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Wire Festive Completion Modal Buttons if present
  const goAccountingBtn = blocksWrapper.querySelector('#hw-modal-go-accounting-btn');
  const backStudyBtn = blocksWrapper.querySelector('#hw-modal-back-study-btn');
  if (goAccountingBtn) {
    goAccountingBtn.onclick = () => {
      appState.activeTrackId = 'accounting';
      appState.currentTrack = 'accounting';
      saveAppState();
      showView('roadmap');
      renderTrackTabs();
      renderRoadmap();
      const hwZone = document.getElementById('homework-exams-zone');
      if (hwZone && typeof hwZone.scrollIntoView === 'function') {
        hwZone.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
  }
  if (backStudyBtn) {
    backStudyBtn.onclick = () => {
      appState.activeTrackId = 'study_help';
      appState.currentTrack = 'study_help';
      saveAppState();
      showView('roadmap');
      renderTrackTabs();
      renderRoadmap();
    };
  }

  // Wire TTS for Rules of Thumb
  const rulesTtsBtn = blocksWrapper.querySelector('#daily-rules-tts-btn');
  if (rulesTtsBtn && typeof SoundService !== 'undefined') {
    rulesTtsBtn.onclick = () => SoundService.speakText(`הקדמה וכללי אצבע לחומר של היום. ${rules.join('. ')}`);
  }

  // Wire TTS for Current Question
  const qTtsBtn = blocksWrapper.querySelector('#daily-current-q-tts-btn');
  if (qTtsBtn && typeof SoundService !== 'undefined') {
    qTtsBtn.onclick = () => SoundService.speakText(`שאלה ${currentDailyQuestionIdx + 1}. ${currentQ.questionText}`);
  }

  // Wire TTS on chat messages
  blocksWrapper.querySelectorAll('.daily-chat-tts-btn').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.getAttribute('data-chat-tts-idx'));
      const msg = currentQ.chatHistory[idx];
      if (msg && msg.text && typeof SoundService !== 'undefined') {
        SoundService.speakText(msg.text.replace(/[*#]/g, ''));
      }
    };
  });

  // Wire Question Stepper Pills
  blocksWrapper.querySelectorAll('.daily-q-pill').forEach(pill => {
    pill.onclick = () => {
      const targetIdx = Number(pill.getAttribute('data-daily-q-idx'));
      if (!Number.isNaN(targetIdx)) {
        currentDailyQuestionIdx = targetIdx;
        renderDailyStudyCardView(card);
      }
    };
  });

  // Wire 3 Quick Helper Buttons
  blocksWrapper.querySelectorAll('.daily-helper-btn').forEach(btn => {
    btn.onclick = () => {
      const actionType = btn.getAttribute('data-helper-action') || 'hint';
      handleDailyCardInteraction(card.id, actionType, '');
    };
  });

  // Wire Answer Submit Button
  const answerInput = blocksWrapper.querySelector('#daily-q-answer-input');
  const submitBtn = blocksWrapper.querySelector('#daily-q-submit-btn');
  if (submitBtn && answerInput) {
    submitBtn.onclick = () => {
      const val = answerInput.value.trim();
      if (!val) {
        showToast('דניאל, כתוב את התשובה שלך או לחץ על אחד מכפתורי העזרה למעלה ✍️', 'warning');
        answerInput.focus();
        return;
      }
      handleDailyCardInteraction(card.id, 'answer', val);
    };
  }

  // Wire Next Question Button
  const nextQBtn = blocksWrapper.querySelector('#daily-q-next-btn');
  if (nextQBtn) {
    nextQBtn.onclick = () => advanceDailyCardQuestion(card.id);
  }

  // Wire Finish Card Button
  const finishCardBtn = blocksWrapper.querySelector('#daily-card-finish-btn');
  if (finishCardBtn) {
    finishCardBtn.onclick = async () => {
      card.isCompleted = true;
      await AIService.generateHomeworkSummaryExamFromCard(card);
      saveAppState();
      if (typeof SoundService !== 'undefined') {
        SoundService.playSuccessSound();
      }
      showToast('כל הכבוד דניאל! סיימת את כל שאלות דף העבודה של היום ונוצר עבורך מבחן מסכם! 🏆', 'success');
      renderDailyStudyCardView(card);
    };
  }
}

async function advanceDailyCardQuestion(cardId) {
  const cards = appState.studyHelp?.dailyCards || [];
  const card = cards.find(c => c.id === (cardId || currentDailyCardId));
  if (!card || !Array.isArray(card.questions)) return false;

  if (currentDailyQuestionIdx < card.questions.length - 1) {
    currentDailyQuestionIdx++;
    renderDailyStudyCardView(card);
    return true;
  }
  card.isCompleted = true;
  await AIService.generateHomeworkSummaryExamFromCard(card);
  saveAppState();
  renderDailyStudyCardView(card);
  return false;
}

async function handleDailyCardInteraction(cardId, actionType = 'answer', userText = '') {
  const cards = appState.studyHelp?.dailyCards || [];
  const card = cards.find(c => c.id === (cardId || currentDailyCardId));
  if (!card || !Array.isArray(card.questions)) return null;

  const qObj = card.questions[currentDailyQuestionIdx];
  if (!qObj) return null;
  if (!Array.isArray(qObj.chatHistory)) qObj.chatHistory = [];

  const helperLabels = {
    hint: '💡 אשמח לקבל רמז מכוון לשאלה הזו',
    simplify: '📖 תסביר לי בבקשה את השאלה בפשטות',
    how_to_start: '🧮 איך מתחילים לפתור את השאלה?'
  };

  const displayUserMsg = actionType === 'answer' ? userText : (helperLabels[actionType] || userText);
  if (displayUserMsg) {
    qObj.chatHistory.push({
      role: 'user',
      text: displayUserMsg,
      actionType,
      timestamp: new Date().toISOString()
    });
  }

  const submitBtn = document.getElementById('daily-q-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>המאמן בודק ומכין תגובה... ⏳</span>';
  }

  const result = await AIService.evaluateSocraticHomeworkStep({
    cardTitle: card.title,
    rulesOfThumb: card.introAndRules,
    questionObj: qObj,
    userMessage: displayUserMsg,
    chatHistory: qObj.chatHistory.slice(0, -1),
    actionType
  });

  qObj.chatHistory.push({
    role: 'assistant',
    text: result.reply,
    isQuestionSolved: Boolean(result.isQuestionSolved),
    timestamp: new Date().toISOString()
  });

  if (result.isQuestionSolved) {
    qObj.isCompleted = true;
    const allDone = card.questions.every(q => q.isCompleted);
    if (allDone) {
      card.isCompleted = true;
      await AIService.generateHomeworkSummaryExamFromCard(card);
    }
    if (typeof SoundService !== 'undefined') {
      if (typeof SoundService.playSuccess === 'function') {
        SoundService.playSuccess();
      } else if (typeof SoundService.playSuccessSound === 'function') {
        SoundService.playSuccessSound();
      }
    }
  }

  appState.studyHelp.totalQuestionsAsked = (Number(appState.studyHelp.totalQuestionsAsked) || 0) + 1;
  saveAppState();
  renderDailyStudyCardView(card);

  const feed = document.getElementById('daily-question-chat-feed');
  if (feed) {
    feed.scrollTop = feed.scrollHeight;
  }

  return result;
}

function openHomeworkSummaryExam(examId) {
  const hwExams = Array.isArray(appState.accountingExam?.homeworkExams)
    ? appState.accountingExam.homeworkExams
    : [];
  const hwExam = hwExams.find(e => e.id === examId) || hwExams[hwExams.length - 1];
  if (!hwExam) {
    showToast('לא נמצא המבחן המסכם המבוקש.', 'warning');
    return null;
  }

  hwExam.isNew = false;
  const activeExamObj = {
    id: hwExam.id,
    homeworkExamId: hwExam.id,
    isHomeworkExam: true,
    title: hwExam.title || 'מבחן מסכם מתרגול שיעורי הבית',
    generatedAt: hwExam.createdAt || new Date().toISOString(),
    provider: 'homework_card',
    questions: Array.isArray(hwExam.questions) ? hwExam.questions : [],
    userAnswers: hwExam.userAnswers || {}
  };

  saveAccountingExamState(activeExamObj);
  currentAccountingExamIdx = 0;

  showView('checkpoint');
  const header = document.getElementById('checkpoint-view-header');
  if (header) header.textContent = `🏆 ${activeExamObj.title}`;

  const backBtn = document.getElementById('checkpoint-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };
  }

  renderAccountingExamQuestion();
  return activeExamObj;
}



