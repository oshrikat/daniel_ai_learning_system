// ============================================================================
// 3. שירותי קול, צלילים ושיתוף וואטסאפ (Sound & Sharing Services)
// ============================================================================

const SoundService = {
  synth: window.speechSynthesis,
  currentUtterance: null,

  speakText(text) {
    if (!this.synth) return;
    try {
      this.synth.cancel();
      const clean = text.replace(/[*_#`~[\]]/g, '').trim();
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'he-IL';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;

      const voices = this.synth.getVoices();
      const heVoice = voices.find(v => v.lang.includes('he') || v.lang.includes('IL'));
      if (heVoice) utterance.voice = heVoice;

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    } catch (e) {
      console.warn('TTS playback error:', e);
    }
  },

  stopSpeaking() {
    if (this.synth) this.synth.cancel();
  },

  playSuccessSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      
      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {}
  },

  playErrorSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(240, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  }
};

function shareProgressToWhatsApp(msgText) {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msgText)}`;
  window.open(url, '_blank');
}

let toastTimer = null;

/**
 * הצגת הודעת טוסט מעוצבת עם משך 6000ms ושיקוף מלא לקונסול
 * @param {string} message - הודעה להצגה
 * @param {'info'|'success'|'error'|'warning'} [type='info'] - סוג ההודעה
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // שיקוף לקונסול לפי דרישות הארכיטקטורה
  if (type === 'error' || type === 'warning') {
    console.error(`[Toast ${type.toUpperCase()}] ${message}`);
  } else {
    console.log(`[Toast ${type.toUpperCase()}] ${message}`);
  }

  // איפוס טיימר קודם אם קיים
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  toast.textContent = message;
  toast.className = `toast toast-${type} show`;

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 6000);
}

function copyToClipboard(text, btnElement) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = btnElement ? btnElement.innerHTML : '';
      if (btnElement) btnElement.innerHTML = '<span>הועתק בהצלחה! ✓</span>';
      showToast('המשפט הועתק! עכשיו אפשר להדביק אותו בצ\'אט 📋');
      setTimeout(() => {
        if (btnElement) btnElement.innerHTML = originalText;
      }, 2000);
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('המשפט הועתק! 📋');
  }
}

// ============================================================================
// 4. נעילת שבת ומצב רגוע (Shabbat Lock & Calm Mode)
// ============================================================================

function isShabbatNow() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeVal = hour + minute / 60;
  if (day === 5 && timeVal >= 16.5) return true;
  if (day === 6 && timeVal < 20.5) return true;
  return false;
}

let shabbatBypassed = false;
function checkAndApplyShabbatLock() {
  const screen = document.getElementById('shabbat-screen');
  if (!screen) return;
  if (isShabbatNow() && !shabbatBypassed) {
    screen.style.display = 'flex';
  } else {
    screen.style.display = 'none';
  }
}

function openCalmModal() {
  const modal = document.getElementById('calm-modal');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function closeCalmModal() {
  const modal = document.getElementById('calm-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

// ============================================================================
// 5. ניהול תצוגות (View Switching)
// ============================================================================

function showView(viewName) {
  SoundService.stopSpeaking();
  appState.currentView = viewName;
  saveAppState();

  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => sec.classList.remove('active'));

  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

