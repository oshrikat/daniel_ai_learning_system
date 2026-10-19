function renderUnitPlayer(unitId) {
  const activeTrack = getActiveTrack();
  const legacyWrapper = document.getElementById('unit-steps-wrapper');
  const blocksWrapper = document.getElementById('unit-blocks-wrapper');

  if (activeTrack.engine === 'blocks') {
    // ========================================================================
    // מנוע הבלוקים הדינמי (Dynamic Block Engine - Track 2: Accounting)
    // ========================================================================
    if (legacyWrapper) legacyWrapper.style.display = 'none';
    if (blocksWrapper) {
      blocksWrapper.style.display = 'flex';
      blocksWrapper.innerHTML = '';
    }

    const units = getTrackUnits(activeTrack);
    const unit = units.find(u => u.id === unitId || u.unit_id === unitId);
    if (!unit) return;

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

          if (!appState.trackProgress[activeTrack.id]) {
            appState.trackProgress[activeTrack.id] = [];
          }
          if (!appState.trackProgress[activeTrack.id].includes(unit.id)) {
            appState.trackProgress[activeTrack.id].push(unit.id);
          }
          unit.isCompleted = true;
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

