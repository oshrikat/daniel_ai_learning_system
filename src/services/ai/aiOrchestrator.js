/**
 * Unified sequential multi-tier AI fallback.
 * Tier 1 (Primary): Google Gemini -> Tier 2 (Secondary): Groq / Grok -> Tier 3 (Backup): OpenRouter -> Tier 4: Offline Fallback.
 * @param {string} prompt
 * @param {object} options
 * @returns {Promise<string>}
 */
async function callMultiTierAI(prompt, options = {}) {
  let savedState = {};
  try {
    savedState = JSON.parse(localStorage.getItem('DANIEL_AI_V3_CLEAN') || '{}');
  } catch (e) {}
  const cfg = { ...(savedState.apiConfig || {}), ...(appState?.apiConfig || {}) };

  const geminiKey = cleanApiKey(
    localStorage.getItem('gemini_api_key') ||
    cfg.geminiKey ||
    ''
  );
  const grokKey = cleanApiKey(
    localStorage.getItem('xai_api_key') ||
    localStorage.getItem('groq_api_key') ||
    cfg.xaiKey ||
    cfg.groqKey ||
    ''
  );
  const orKey = cleanApiKey(
    localStorage.getItem('openrouter_api_key') ||
    cfg.openrouterKey ||
    ''
  );

  const errors = [];
  const hasImages = Array.isArray(options.images) && options.images.length > 0;

  // TIER 1 (PRIMARY — Google Gemini First)
  if (geminiKey) {
    const baseGemini = (typeof AIService !== 'undefined' && Array.isArray(AIService.geminiModels))
      ? AIService.geminiModels
      : ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-lite-latest'];
    const geminiModelsToTry = [...new Set([
      localStorage.getItem('verified_gemini_model'),
      cfg.verifiedGeminiModel,
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      ...baseGemini
    ].filter(Boolean))];

    for (const model of geminiModelsToTry) {
      try {
        const reply = await callGeminiAPI(model, geminiKey, prompt, options);
        if (appState?.apiConfig) {
          appState.apiConfig.verifiedGeminiModel = model;
        }
        localStorage.setItem('verified_gemini_model', model);
        return reply;
      } catch (e) {
        errors.push(`Gemini (${model}): ${e.message}`);
        console.warn(`[AI Tier 1] Gemini (${model}) failed, trying next Gemini candidate…`, e);
      }
    }
  }

  // TIER 2 (SECONDARY — Groq / Grok Second)
  if (grokKey) {
    const isGroq = grokKey.startsWith('gsk_');
    let groqModelsToTry = [];
    if (hasImages && isGroq) {
      groqModelsToTry = [
        cfg.verifiedGroqVisionModel,
        'meta-llama/llama-4-scout-17b-16e-instruct'
      ].filter(Boolean);
    } else if (isGroq) {
      groqModelsToTry = [...new Set([
        cfg.verifiedGroqModel,
        'qwen/qwen3.8-27b',
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant'
      ].filter(Boolean))];
    } else {
      groqModelsToTry = ['grok-2-latest'];
    }

    for (const model of groqModelsToTry) {
      try {
        const reply = await callGrokAPI(grokKey, prompt, model, options);
        if (isGroq && !hasImages && appState?.apiConfig) {
          appState.apiConfig.verifiedGroqModel = model;
        }
        return reply;
      } catch (e) {
        errors.push(`Groq/Grok (${model}): ${e.message}`);
        console.warn(`[AI Tier 2] Groq/Grok (${model}) failed, trying next…`, e);
      }
    }
  }

  // TIER 3 (FINAL BACKUP — OpenRouter Third)
  if (orKey && !hasImages) {
    const orModels = [...new Set([
      cfg.verifiedOpenRouterModel,
      'openai/gpt-4o-mini',
      'openai/gpt-3.5-turbo'
    ].filter(Boolean))];

    for (const model of orModels) {
      try {
        const reply = await callOpenRouterAPI(orKey, prompt, model);
        if (appState?.apiConfig) {
          appState.apiConfig.verifiedOpenRouterModel = model;
        }
        return reply;
      } catch (e) {
        errors.push(`OpenRouter (${model}): ${e.message}`);
        console.warn(`[AI Tier 3] OpenRouter (${model}) failed, trying next…`, e);
      }
    }
  }

  // TIER 4: All Failed -> Console Error + Toast Error + Offline Fallback
  console.error('[callMultiTierAI] All AI providers failed:', errors);
  showToast('שגיאת AI: כל ספקי ה-AI נכשלו. מופעל משוב אופליין מקומי (בדוק קונסול).', 'error');
  return '';
}




// ============================================================================
// 9. שירותי בינה מלאכותית (AIService - Multi-Model Fallback & Generator)
// ============================================================================

const AIService = {
  geminiModels: [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-flash-lite-latest'
  ],

  groqModels: [
    'qwen/qwen3.8-27b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'allam-2-7b'
  ],

  openrouterModels: [
    'openai/gpt-4o-mini',
    'openai/gpt-3.5-turbo'
  ],

  async testGroq(rawKey, progressCb) {
    const key = cleanApiKey(rawKey);
    if (!key) return { success: false, error: 'לא הוזן מפתח API של Groq.' };
    const t0 = performance.now();

    let candidateModels = [...this.groqModels];
    try {
      if (progressCb) progressCb('מגלה מודלים פעילים ב-Groq...');
      const modelsResp = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${key}` }
      });
      if (modelsResp.ok) {
        const modelsData = await modelsResp.json();
        const availableIds = (modelsData?.data || [])
          .map(m => m.id)
          .filter(id => id && !/whisper|tts|guard|embed/i.test(id));
        if (availableIds.includes('meta-llama/llama-4-scout-17b-16e-instruct')) {
          appState.apiConfig.verifiedGroqVisionModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
        }
        if (availableIds.length > 0) {
          const prioritized = this.groqModels.filter(m => availableIds.includes(m));
          const others = availableIds.filter(m => !prioritized.includes(m));
          const combined = [...new Set([...prioritized, ...others, ...this.groqModels])];
          const nonReasoning = combined.filter(id => !/gpt-oss|deepseek-r1|qwq/i.test(id));
          const reasoning = combined.filter(id => /gpt-oss|deepseek-r1|qwq/i.test(id));
          candidateModels = [...nonReasoning, ...reasoning];
        }
      }
    } catch (e) {
      console.warn('Groq model discovery fallback:', e);
    }

    let lastStatus = '';
    for (const model of candidateModels) {
      if (progressCb) progressCb(`בודק מודל ${model}...`);
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'שלום! ענה במילה אחת: "פעיל".' }],
            max_tokens: 150
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const choice = data?.choices?.[0]?.message;
          const rawText = stripThinkTags(choice?.content || choice?.reasoning_content || choice?.reasoning || '');
          if (!rawText) {
            lastStatus = `Empty reply from ${model}`;
            continue;
          }
          const latency = Math.round(performance.now() - t0);
          appState.apiConfig.groqKey = key;
          appState.apiConfig.verifiedGroqModel = model;
          localStorage.setItem('groq_api_key', key);
          saveAppState();
          return { success: true, model, latency, reply: rawText };
        } else {
          lastStatus = `HTTP ${resp.status}`;
        }
      } catch (e) {
        lastStatus = e.message;
        console.warn(`Groq test failed for ${model}:`, e);
      }
    }
    return { success: false, error: `כל מודלי Groq נכשלו (${lastStatus || 'מפתח לא תקין'}).` };
  },

  async testGemini(rawKey, progressCb) {
    const key = cleanApiKey(rawKey);
    if (!key) return { success: false, error: 'לא הוזן מפתח API של Gemini.' };
    const t0 = performance.now();

    let candidateModels = [...this.geminiModels];
    try {
      if (progressCb) progressCb('מגלה מודלים פעילים ב-Google Gemini...');
      const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (listResp.ok) {
        const listData = await listResp.json();
        const availableIds = (listData?.models || [])
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => (m.name || '').replace(/^models\//, ''))
          .filter(id => id && /gemini/i.test(id) && !/embedding|vision-pro|aqa|tts|image|robotics|computer-use|transcribe|lyria|banana|argon/i.test(id));

        if (availableIds.length > 0) {
          const preferredOrder = [
            'gemini-3.6-flash',
            'gemini-3.5-flash',
            'gemini-flash-latest',
            'gemini-3.1-flash-lite',
            'gemini-3.8-flash',
            'gemini-3.7-flash',
            'gemini-flash-lite-latest'
          ];
          const prioritized = preferredOrder.filter(m => availableIds.includes(m));
          const others = availableIds.filter(m => !prioritized.includes(m));
          candidateModels = [...new Set([...prioritized, ...others, ...this.geminiModels])];
        }
      }
    } catch (e) {
      console.warn('Gemini model discovery fallback:', e);
    }

    let lastStatus = '';
    for (const model of candidateModels) {
      if (progressCb) progressCb(`בודק מודל ${model}...`);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'שלום! ענה במילה אחת בלבד: "פעיל".' }] }]
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const rawText = stripThinkTags(data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
          if (!rawText) {
            lastStatus = `Empty reply from ${model}`;
            continue;
          }
          const latency = Math.round(performance.now() - t0);
          appState.apiConfig.geminiKey = key;
          appState.apiConfig.verifiedGeminiModel = model;
          localStorage.setItem('gemini_api_key', key);
          localStorage.setItem('verified_gemini_model', model);
          saveAppState();
          return { success: true, model, latency, reply: rawText };
        } else {
          lastStatus = `HTTP ${resp.status}`;
        }
      } catch (e) {
        lastStatus = e.message;
        console.warn(`Gemini test failed for ${model}:`, e);
      }
    }
    return { success: false, error: `כל מודלי Gemini נכשלו (${lastStatus || 'מפתח לא תקין או חסום'}).` };
  },

  async testOpenRouter(rawKey, progressCb) {
    const key = cleanApiKey(rawKey);
    if (!key) return { success: false, error: 'לא הוזן מפתח API של OpenRouter.' };
    const t0 = performance.now();

    let lastStatus = '';
    for (const model of this.openrouterModels) {
      if (progressCb) progressCb(`בודק מודל ${model}...`);
      try {
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'שלום! ענה במילה אחת: "פעיל".' }],
            max_tokens: 100
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const choice = data?.choices?.[0]?.message;
          const reply = stripThinkTags(choice?.content || choice?.reasoning_content || 'פעיל') || 'פעיל';
          const latency = Math.round(performance.now() - t0);
          appState.apiConfig.openrouterKey = key;
          appState.apiConfig.verifiedOpenRouterModel = model;
          localStorage.setItem('openrouter_api_key', key);
          saveAppState();
          return { success: true, model, latency, reply };
        } else {
          lastStatus = `HTTP ${resp.status}`;
        }
      } catch (e) {
        lastStatus = e.message;
        console.warn(`OpenRouter test failed for ${model}:`, e);
      }
    }
    return { success: false, error: `בדיקת OpenRouter נכשלה (${lastStatus || 'מפתח לא תקין'}).` };
  },

  async generateLessonWithFallback(topicPrompt, progressCb) {
    const systemInstruction = `אתה מומחה לפדגוגיה ונגישות קוגניטיבית עבור דניאל (בן 28).
עליך לייצר יחידת לימוד מעשית, מעצימה ומכבדת במבנה JSON תקני לחלוטין.
חובה להחזיר רק אובייקט JSON תקני בין סוגריים מסולסלים { ... }, ללא טקסט מקדים וללא תגיות markdown.
מבנה ה-JSON הנדרש במדויק:
{
  "title": "שם היחידה בעברית",
  "category": "קטגוריה (למשל: עבודה ותקשורת / כישורי חיים / יצירה)",
  "goal": "מטרת היחידה במשפט אחד פשוט",
  "trafficLight": "green",
  "trafficLightDesc": "ירוק: אפשר להשתמש לבד. / צהוב: בודקים במקור שני / אדום: חובה אדם",
  "step1_demo": {
    "badPrompt": "דוגמה לבקשה כללית או לא טובה",
    "badResult": "תשובה ארוכה, מסובכת או מבלבלת שה-AI נותן",
    "goodPrompt": "דוגמה לבקשה מדויקת ופשוטה",
    "goodResult": "תשובה קצרה, נעימה וממוקדת בדיוק במה שרצינו"
  },
  "step2_takeaway": "הסבר תמציתי ומאיר עיניים של 1-2 משפטים מדוע הבקשה הטובה הצליחה",
  "step3_strategy": {
    "question": "שאלת בחירה ואסטרטגיה לפני ביצוע",
    "options": [
      { "text": "התשובה הנכונה", "isCorrect": true, "explanation": "הסבר מעודד" },
      { "text": "התשובה השגויה", "isCorrect": false, "explanation": "הסבר עדין" }
    ]
  },
  "step4_mission": {
    "executePrompt": "משפט מוכן להעתקה ולתרגול",
    "doText": "הוראה קצרה ומעשית מה לעשות",
    "comprehensionQ": "מה ביקשת מה-AI לעשות?",
    "comprehensionOpts": [
      { "text": "תשובה נכונה", "isCorrect": true },
      { "text": "תשובה שגויה", "isCorrect": false }
    ],
    "transferPrompt": "משימת העברה: שנה מילה אחת ובדוק מה השתנה",
    "teachBackText": "היום למדתי ש..."
  }
}`;

    if (progressCb) progressCb('מייצר יחידה בשרשרת ה-AI (Groq -> Gemini -> OpenRouter)...');
    const rawReply = await callMultiTierAI(`${systemInstruction}\n\nהנושא המבוקש ליחידה הוא: ${topicPrompt}`, {
      systemInstruction,
      maxTokens: 1500
    });

    if (rawReply) {
      const parsed = this.cleanAndParseJSON(rawReply);
      if (parsed) {
        const activeProvider = appState.apiConfig.verifiedGroqModel
          ? `Groq (${appState.apiConfig.verifiedGroqModel})`
          : (appState.apiConfig.verifiedGeminiModel ? `Gemini (${appState.apiConfig.verifiedGeminiModel})` : 'AI Cloud');
        return { unit: parsed, provider: activeProvider };
      }
    }

    if (progressCb) progressCb('מייצר יחידה מובנית במנוע המקומי...');
    const localUnit = this.synthesizeLocalUnit(topicPrompt);
    return { unit: localUnit, provider: 'מנוע למידה פנימי' };
  },

  cleanAndParseJSON(text) {
    try {
      let clean = text.trim();
      if (clean.includes('```')) {
        clean = clean.replace(/```json/gi, '').replace(/```/g, '').trim();
      }
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        clean = clean.substring(start, end + 1);
        return JSON.parse(clean);
      }
    } catch (e) {
      console.warn('JSON parse error:', e);
    }
    return null;
  },

  synthesizeLocalUnit(topic) {
    return {
      title: `${topic} - צעד אחר צעד`,
      category: 'מיומנות אישית',
      goal: `ללמוד איך להיעזר ב-AI בצורה פשוטה, ממוקדת וברורה בנושא: ${topic}.`,
      trafficLight: 'green',
      trafficLightDesc: 'ירוק: אפשר להשתמש לבד. רעיונות ופשטות.',
      step1_demo: {
        badPrompt: `ספר לי על ${topic}`,
        badResult: `נושא ה-${topic} הינו תחום נרחב הכולל שלל נדבכים מתקדמים ותהליכים תאורטיים מורכבים...`,
        goodPrompt: `תסביר לי ב-2 משפטים פשוטים ובמילים קצרות: מה הכי חשוב לדעת על ${topic}?`,
        goodResult: `${topic} הוא נושא מעשי ושימושי. כשמבקשים הסבר פשוט, אפשר להבין אותו מיד ולהשתמש בו ביום-יום בקלות.`
      },
      step2_takeaway: `כשמבקשים מה-AI להתמקד ב-"2 משפטים פשוטים" לגבי ${topic}, מקבלים את השורה התחתונה מיד!`,
      step3_strategy: {
        question: `מה הדרך הטובה ביותר ללמוד על ${topic} בלי להתבלבל?`,
        options: [
          { text: 'לבקש הסבר קצר של 2 משפטים עם דוגמה פשוטה', isCorrect: true, explanation: 'נכון מאוד! זה מאפשר הבנה הדרגתית ונעימה.' },
          { text: 'לקרוא מאמר אקדמי ארוך ומעייף', isCorrect: false, explanation: 'זה עלול להציף ולעייף.' }
        ]
      },
      step4_mission: {
        executePrompt: `תסביר לי ב-2 משפטים קצרים ובמילים פשוטות: איך ${topic} עוזר לי בחיים?`,
        doText: `העתק את הפרומפט והתנסה בבקשה ברורה על ${topic}:`,
        comprehensionQ: 'איך ביקשנו מה-AI להסביר?',
        comprehensionOpts: [
          { text: 'ב-2 משפטים קצרים ובמילים פשוטות', isCorrect: true },
          { text: 'במגילה ארוכה של 50 עמודים', isCorrect: false }
        ],
        transferPrompt: `עכשיו שנה מילה אחת ובקש דוגמה נוספת הקשורה ל-${topic}!`,
        teachBackText: `היום למדתי שכשמבקשים הסבר קצר על ${topic}, קל מאוד להבין וליישם.`
      }
    };
  },

  /**
   * מסלול 3: עזרה בלימודים - מענה פדגוגי אישי, סבלני ומובנה לדניאל
   * @param {object} params
   * @param {string} [params.subject]
   * @param {string} params.question
   * @param {Array} [params.conversationHistory]
   * @returns {Promise<{reply: string, provider: string, isFallback: boolean}>}
   */
  async askStudyHelper({ subject = 'כללי', question = '', conversationHistory = [] } = {}) {
    const cleanQ = (question || '').trim();
    const cleanSubj = (subject || 'כללי').trim();
    if (!cleanQ) {
      return {
        reply: 'שלום דניאל! כתוב לי איזו שאלה או מושג תרצה שנלמד יחד, ואסביר לך צעד אחר צעד בשמחה 🌟',
        provider: 'local',
        isFallback: true
      };
    }

    const systemInstruction = `אתה החונך האישי והמאמן הפדגוגי של דניאל (בן 28) במסלול "עזרה בלימודים".
ענה תמיד בעברית פשוטה, נעימה, מכבדת ומעצימה.
פעל תמיד לפי 4 הצעדים הבאים:
1. פתיחה חמה שמחזקת את דניאל על השאלה הטובה.
2. הסבר קצר ופשוט של המושג או הפתרון בשפה יומיומית ברורה.
3. דוגמה מוחשית ומעשית (מספרית או מחיי היומיום) שממחישה את העיקרון.
4. שאלת בדיקת הבנה קצרה או טיפ מעשי אחד להמשך.`;

    const recentTurns = Array.isArray(conversationHistory)
      ? conversationHistory.slice(-6).map(m => `${m.role === 'user' ? 'דניאל' : 'מאמן ה-AI'}: ${m.text}`).join('\n')
      : '';

    const fullPrompt = `${recentTurns ? `הקשר שיחה קודם:\n${recentTurns}\n\n` : ''}נושא לימוד: ${cleanSubj}
השאלה של דניאל: "${cleanQ}"

אנא השב לדניאל בצורה מסודרת, בהירה ומעצימה לפי 4 הצעדים.`;

    try {
      const aiReply = await callMultiTierAI(fullPrompt, {
        systemInstruction,
        maxTokens: 1200
      });
      if (aiReply && aiReply.trim()) {
        return {
          reply: aiReply.trim(),
          provider: 'ai',
          isFallback: false
        };
      }
    } catch (e) {
      console.warn('[askStudyHelper] AI call failed, using pedagogical fallback:', e);
    }

    // Deterministic offline pedagogical fallback tailored to subject/question keywords
    let conceptExplanation = `כדי לפתור או להבין את "${cleanQ}" בנושא ${cleanSubj}, נפרק את השאלה ל-2 חלקים פשוטים: קודם נזהה מה הנתון המרכזי בשאלה, ואז נבדוק מה הפעולה הנדרשת.`;
    let exampleText = `למשל, אם מבקשים מאיתנו לבדוק פעולה כספית או מושג מקצועי, נשאל תמיד: מה נכנס (חובה) ומה יצא (זכות), ונרשום את הנתונים בצורה מסודרת בשורות נפרדות.`;

    if (/חובה|זכות|פקודת יומן|כרטסת/i.test(cleanQ + ' ' + cleanSubj)) {
      conceptExplanation = `בהנהלת חשבונות כפולה, כל אירוע נרשם בשני צדדים מאוזנים: צד **חובה** (מה שנכנס לעסק או שימוש בכסף, כמו קופה/בנק או הוצאה) וצד **זכות** (מקור הכסף או מה שיצא, כמו הכנסות או ספקים).`;
      exampleText = `דוגמה מוחשית: אם לקוח שילם לנו 500 ₪ במזומן עבור שירות — לחשבון "קופה" נכנס כסף ולכן נחייב אותו ב-500 ₪ (חובה), וחשבון "הכנסות" הוא מקור העסקה ולכן נזכה אותו ב-500 ₪ (זכות).`;
    } else if (/מע"מ|מעמ|חשבונית/i.test(cleanQ + ' ' + cleanSubj)) {
      conceptExplanation = `מע"מ (מס ערך מוסף) בשיעור 18% מתווסף למחיר העסקה לפני מע"מ. במכירה ללקוח זהו "מע"מ עסקאות" (זכות), ובקנייה מספק זהו "מע"מ תשומות" (חובה).`;
      exampleText = `דוגמה מוחשית: עסקה בסך 1,000 ₪ לפני מע"מ — המע"מ הוא 180 ₪ (1,000 כפול 18%), והסכום הכולל לתשלום בחשבונית הוא 1,180 ₪.`;
    } else if (/מאזן|רווח והפסד|דוח/i.test(cleanQ + ' ' + cleanSubj)) {
      conceptExplanation = `דוח רווח והפסד מציג את ההכנסות פחות ההוצאות לתקופה (כדי לדעת אם העסק הרוויח), ואילו המאזן מציג תמונת מצב של נכסים מול התחייבויות והון עצמי.`;
      exampleText = `דוגמה מוחשית: אם לעסק היו הכנסות של 10,000 ₪ והוצאות של 6,000 ₪, הרווח הנקי בדוח רווח והפסד הוא 4,000 ₪.`;
    }

    const fallbackReply = `🌟 **שאלה מצוינת דניאל!** כל הכבוד על הסקרנות בנושא **${cleanSubj}**.

📘 **הסבר פשוט בגובה העיניים:**
${conceptExplanation}

💡 **דוגמה מוחשית:**
${exampleText}

🎯 **צעד קטן לבדיקת הבנה:**
נסה לכתוב לי במילים שלך: מה החלק המרכזי שהכי עזר לך בהסבר הזה, או שלח לי תרגיל נוסף ונפתור אותו יחד!`;

    return {
      reply: fallbackReply,
      provider: 'offline',
      isFallback: true
    };
  },

  /**
   * מאגר שאלות מובנה למבחן המסכם בהנהלת חשבונות (גיבוי מלא ואמין)
   * @returns {Array}
   */
  getFallbackAccountingExamQuestions() {
    return [
      {
        id: 'acc_exam_q1',
        type: 'multiple_choice',
        topic: 'חובה וזכות ופקודות יומן',
        points: 16,
        question: 'העסק רכש מחשב משרדי חדש בסך 3,500 ₪ ושילם עליו מיד בהעברה בנקאית מחשבון העו"ש. כיצד תירשם הפעולה?',
        options: [
          'חובה: ציוד משרדי (3,500 ₪) | זכות: עו"ש בנק (3,500 ₪)',
          'חובה: עו"ש בנק (3,500 ₪) | זכות: ציוד משרדי (3,500 ₪)',
          'חובה: הכנסות (3,500 ₪) | זכות: ספקים (3,500 ₪)',
          'חובה: קופה (3,500 ₪) | זכות: הון עצמי (3,500 ₪)'
        ],
        correctIndex: 0,
        explanation: 'המחשב (רכוש/ציוד) נכנס לעסק ולכן הוא בחובה, והכסף יצא מחשבון העו"ש בבנק ולכן הבנק בזכות.'
      },
      {
        id: 'acc_exam_q2',
        type: 'multiple_choice',
        topic: 'מאזן בוחן ואיזון חשבונאי',
        points: 16,
        question: 'מהו הכלל החשבונאי המרכזי שחייב להתקיים בכל פקודת יומן תקנית ובמאזן הבוחן?',
        options: [
          'סך כל הסכומים בצד החובה חייב להיות שווה בדיוק לסך כל הסכומים בצד הזכות',
          'סך החובה חייב להיות תמיד כפול מסך הזכות',
          'מותר לרשום רק צד אחד בפקודת היומן ללא צד נגדי',
          'יתרת הבנק חייבת להיות תמיד שווה לאפס בסוף כל יום'
        ],
        correctIndex: 0,
        explanation: 'שיטת הנהלת החשבונות הכפולה מבוססת על עיקרון האיזון: סך חובה = סך זכות תמיד.'
      },
      {
        id: 'acc_exam_q3',
        type: 'calculation',
        topic: 'חישוב מע"מ עסקאות וחשבונית מס',
        points: 17,
        question: 'עוסק מורשה הפיק חשבונית מס עבור שירותי הנהלת חשבונות בסך 2,000 ₪ לפני מע"מ. אם שיעור המע"מ הוא 18%, מהו סכום המע"מ בשקלים (מספר בלבד)?',
        expectedAnswer: 360,
        explanation: 'חישוב המע"מ: 2,000 ₪ כפול 18% (0.18) = 360 ₪ (והסכום הכולל לתשלום הוא 2,360 ₪).'
      },
      {
        id: 'acc_exam_q4',
        type: 'calculation',
        topic: 'דוח רווח והפסד',
        points: 17,
        question: 'בחודש אוקטובר סך ההכנסות של העסק ממכירות עמד על 15,000 ₪, וסך ההוצאות התפעוליות עמד על 9,200 ₪. מהו הרווח הנקי לפני מס של העסק בחודש זה (בשקלים)?',
        expectedAnswer: 5800,
        explanation: 'רווח נקי לפני מס מחושב כהכנסות (15,000 ₪) פחות הוצאות (9,200 ₪) = 5,800 ₪.'
      },
      {
        id: 'acc_exam_q5',
        type: 'open_journal_or_case',
        topic: 'רישום פקודת יומן - תקבול מלקוח',
        points: 17,
        question: 'אירוע: העסק העניק שירות ללקוח וקיבל ממנו 1,200 ₪ במזומן ישירות לקופה (ללא מע"מ לשם פשטות). כתוב במילים שלך: איזה חשבון נמצא בחובה, איזה חשבון נמצא בזכות, ומדוע?',
        rubric: {
          coreConcept: 'חובה קופה (1,200 ₪) כי נכנס מזומן לעסק, וזכות הכנסות ממכירות/שירותים (1,200 ₪) כי ההכנסה היא מקור העסקה.',
          keywords: ['חובה', 'זכות', 'קופה', 'מזומן', 'הכנסות', '1200', '1,200'],
          sampleSolution: 'חובה: קופה – 1,200 ₪ (נכנס כסף מזומן לקופה) | זכות: הכנסות משירותים – 1,200 ₪ (רישום ההכנסה).'
        },
        explanation: 'הקופה קיבלה את הכסף ולכן היא בחובה, וחשבון ההכנסות משקף את מקור העסקה ולכן הוא בזכות.'
      },
      {
        id: 'acc_exam_q6',
        type: 'open_journal_or_case',
        topic: 'התאמת כרטיסים ורכישה מספק בהקפה',
        points: 17,
        question: 'אירוע: העסק קנה סחורה מספק בסך 4,000 ₪ באשראי (בהקפה - התשלום יבוצע בחודש הבא). הסבר אילו שני חשבונות משתתפים בפקודת היומן ומי מהם בחובה ומי בזכות.',
        rubric: {
          coreConcept: 'חובה קניות סחורה / מלאי (4,000 ₪) כי הסחורה נכנסה לעסק, וזכות ספקים (4,000 ₪) כי נוצרה התחייבות לספק.',
          keywords: ['חובה', 'זכות', 'קניות', 'סחורה', 'מלאי', 'ספק', 'ספקים', '4000', '4,000'],
          sampleSolution: 'חובה: קניות סחורה – 4,000 ₪ | זכות: ספקים – 4,000 ₪ (התחייבות לתשלום בעתיד).'
        },
        explanation: 'קניית הסחורה מגדילה את ההוצאה/המלאי (חובה), והחוב לספק מגדיל את ההתחייבויות של העסק (זכות).'
      }
    ];
  },

  /**
   * יצירת מבחן מסכם אוטומטי במסלול הנהלת חשבונות (AI + גיבוי מובנה)
   * @param {object} [params]
   * @param {Array<string>} [params.completedUnitTitles]
   * @param {number} [params.questionCount]
   * @returns {Promise<{id: string, generatedAt: string, provider: string, questions: Array}>}
   */
  async generateAccountingSummaryExam({ completedUnitTitles = [], questionCount = 6 } = {}) {
    const count = Math.max(3, Math.min(10, Number(questionCount) || 6));
    const fallbackBank = this.getFallbackAccountingExamQuestions();

    const topicsSummary = Array.isArray(completedUnitTitles) && completedUnitTitles.length > 0
      ? completedUnitTitles.join(', ')
      : 'חובה וזכות, פקודות יומן, מאזן בוחן, דוח רווח והפסד ומאזן, חישובי מע"מ (18%), והתאמות בנקים וכרטיסים';

    const prompt = `אתה בוחן פדגוגי מעצים בהנהלת חשבונות עבור דניאל (בן 28).
צור מבחן מסכם מעשי בעברית הכולל בדיוק ${count} שאלות על הנושאים: ${topicsSummary}.
שלב בין 3 סוגי שאלות:
1. "multiple_choice" (4 אפשרויות בעברית, אינדקס תשובה נכונה correctIndex בין 0 ל-3).
2. "calculation" (שאלת חישוב חשבונאית עם תשובה מספרית מדויקת ב-expectedAnswer).
3. "open_journal_or_case" (שאלת מקרה/פקודת יומן פתוחה קצרה עם rubric הכולל coreConcept, keywords, sampleSolution).

החזר אך ורק אובייקט JSON תקני (ללא markdown) במבנה הבא:
{
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "topic": "שם הנושא",
      "points": 16,
      "question": "נוסח השאלה",
      "options": ["אפשרות 1", "אפשרות 2", "אפשרות 3", "אפשרות 4"],
      "correctIndex": 0,
      "explanation": "הסבר קצר וברור"
    },
    {
      "id": "q2",
      "type": "calculation",
      "topic": "חישוב מע\\"מ",
      "points": 17,
      "question": "נוסח שאלת חישוב",
      "expectedAnswer": 180,
      "explanation": "הסבר החישוב"
    },
    {
      "id": "q3",
      "type": "open_journal_or_case",
      "topic": "פקודת יומן",
      "points": 17,
      "question": "נוסח אירוע לרישום והסבר",
      "rubric": {
        "coreConcept": "העיקרון המרכזי לבדיקה",
        "keywords": ["חובה", "זכות", "קופה"],
        "sampleSolution": "פתרון מלא לדוגמה"
      },
      "explanation": "הסבר הפתרון"
    }
  ]
}`;

    try {
      const raw = await callMultiTierAI(prompt, { maxTokens: 2000 });
      const parsed = raw ? this.cleanAndParseJSON(raw) : null;
      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 3) {
        const defaultPts = Math.round(100 / parsed.questions.length);
        const normalized = parsed.questions.slice(0, count).map((q, idx) => ({
          id: q.id || `acc_exam_q_${idx + 1}`,
          type: ['multiple_choice', 'calculation', 'open_journal_or_case'].includes(q.type) ? q.type : 'multiple_choice',
          topic: q.topic || 'הנהלת חשבונות',
          points: Number(q.points) || defaultPts,
          question: q.question || fallbackBank[idx % fallbackBank.length].question,
          options: Array.isArray(q.options) ? q.options : fallbackBank[0].options,
          correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
          expectedAnswer: q.expectedAnswer !== undefined ? q.expectedAnswer : 0,
          rubric: q.rubric || fallbackBank[4].rubric,
          explanation: q.explanation || ''
        }));
        return {
          id: `exam_${Date.now()}`,
          generatedAt: new Date().toISOString(),
          provider: 'ai',
          questions: normalized
        };
      }
    } catch (e) {
      console.warn('[generateAccountingSummaryExam] Falling back to built-in exam bank:', e);
    }

    return {
      id: `exam_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      provider: 'fallback',
      questions: fallbackBank.slice(0, count)
    };
  },

  /**
   * בדיקה וציינון אוטומטי של המבחן המסכם בהנהלת חשבונות
   * @param {object} params
   * @param {Array} params.questions
   * @param {object} params.userAnswers
   * @returns {Promise<{totalScore: number, maxScore: number, percentage: number, passed: boolean, perQuestionResults: Array, overallFeedback: string}>}
   */
  async evaluateAccountingExam({ questions = [], userAnswers = {} } = {}) {
    const perQuestionResults = [];
    let totalScore = 0;
    let maxScore = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qId = q.id || `q_${i + 1}`;
      const maxPoints = Number(q.points) || Math.round(100 / Math.max(questions.length, 1));
      maxScore += maxPoints;
      const rawAns = userAnswers && userAnswers[qId] !== undefined ? userAnswers[qId] : userAnswers[i];

      if (q.type === 'multiple_choice') {
        const chosenIdx = (rawAns !== undefined && rawAns !== '' && rawAns !== null) ? Number(rawAns) : -1;
        const isCorrect = chosenIdx === Number(q.correctIndex);
        const score = isCorrect ? maxPoints : 0;
        totalScore += score;
        const correctOptionText = Array.isArray(q.options) ? q.options[q.correctIndex] : '';
        perQuestionResults.push({
          questionId: qId,
          isCorrect,
          score,
          maxPoints,
          feedback: isCorrect
            ? `מצוין דניאל! בחירה מדויקת. ${q.explanation || ''}`.trim()
            : `לא בדיוק. ${q.explanation || 'כדאי לחזור על כיוון החובה והזכות בשאלה זו.'}`.trim(),
          correctSolution: correctOptionText || q.explanation || ''
        });
      } else if (q.type === 'calculation') {
        const cleanedNum = Number(String(rawAns ?? '').replace(/[^\d.-]/g, ''));
        const expectedNum = Number(String(q.expectedAnswer ?? '0').replace(/[^\d.-]/g, ''));
        const hasInput = String(rawAns ?? '').trim().length > 0;
        const isCorrect = hasInput && !Number.isNaN(cleanedNum) && Math.abs(cleanedNum - expectedNum) < 0.01;
        const score = isCorrect ? maxPoints : 0;
        totalScore += score;
        perQuestionResults.push({
          questionId: qId,
          isCorrect,
          score,
          maxPoints,
          feedback: isCorrect
            ? `כל הכבוד! חישוב מדויק (${expectedNum.toLocaleString()} ₪). ${q.explanation || ''}`.trim()
            : `התשובה המדויקת היא ${expectedNum.toLocaleString()} ₪. ${q.explanation || ''}`.trim(),
          correctSolution: `${expectedNum.toLocaleString()} ₪`
        });
      } else {
        // open_journal_or_case
        const textAns = String(rawAns ?? '').trim();
        const correctSolution = q.rubric?.sampleSolution || q.rubric?.coreConcept || q.explanation || '';
        if (!textAns) {
          perQuestionResults.push({
            questionId: qId,
            isCorrect: false,
            score: 0,
            maxPoints,
            feedback: 'לא הוזנה תשובה בשאלה פתוחה זו. עיין בפתרון לדוגמה למטה.',
            correctSolution
          });
          continue;
        }

        let evaluatedByAI = false;
        try {
          const evalPrompt = `אתה בודק מבחן בהנהלת חשבונות עבור דניאל.
שאלה: "${q.question}"
תשובת דניאל: "${textAns}"
מחוון ופתרון נדרש: "${q.rubric?.coreConcept || correctSolution}"

החזר אך ורק JSON תקני במבנה:
{
  "isCorrect": true,
  "scoreRatio": 1.0,
  "feedback": "משוב קצר, חם ומדויק בעברית (1-2 משפטים)"
}
(scoreRatio יכול להיות בין 0 ל-1 בהתאם לדיוק התשובה).`;
          const aiRaw = await callMultiTierAI(evalPrompt, { maxTokens: 400 });
          const parsedEval = aiRaw ? this.cleanAndParseJSON(aiRaw) : null;
          if (parsedEval && typeof parsedEval.scoreRatio === 'number') {
            const ratio = Math.max(0, Math.min(1, parsedEval.scoreRatio));
            const score = Math.round(maxPoints * ratio);
            const isCorrect = Boolean(parsedEval.isCorrect || ratio >= 0.7);
            totalScore += score;
            perQuestionResults.push({
              questionId: qId,
              isCorrect,
              score,
              maxPoints,
              feedback: parsedEval.feedback || (isCorrect ? 'תשובה טובה ומדויקת!' : 'התשובה חלקית, עיין בפתרון המלא לדיוק.'),
              correctSolution
            });
            evaluatedByAI = true;
          }
        } catch (e) {
          console.warn('[evaluateAccountingExam] Open question AI eval fallback:', e);
        }

        if (!evaluatedByAI) {
          const keywords = Array.isArray(q.rubric?.keywords) && q.rubric.keywords.length > 0
            ? q.rubric.keywords
            : ['חובה', 'זכות'];
          const matched = keywords.filter(kw => textAns.includes(kw));
          const ratio = matched.length >= 2 ? 1 : (matched.length === 1 || textAns.length >= 12 ? 0.75 : 0.4);
          const score = Math.round(maxPoints * ratio);
          const isCorrect = ratio >= 0.7;
          totalScore += score;
          perQuestionResults.push({
            questionId: qId,
            isCorrect,
            score,
            maxPoints,
            feedback: isCorrect
              ? `יפה מאוד דניאל! זיהית נכון את עקרונות הפקודה (${q.explanation || ''}).`
              : `תודה על הניסיון! כדאי לציין במפורש אילו חשבונות בחובה ואילו בזכות.`,
            correctSolution
          });
        }
      }
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const passed = percentage >= 75;
    const overallFeedback = passed
      ? `כל הכבוד דניאל! עברת בהצלחה את המבחן המסכם בהנהלת חשבונות בציון ${percentage}! הפגנת שליטה מעולה בחובה וזכות, פקודות יומן וחישובים חשבונאיים 🏆`
      : `קיבלת ציון ${percentage} במבחן המסכם. כל ניסיון מחזק את ההבנה! עבור בנחת על ההסברים של השאלות ונסה שוב כשתרגיש מוכן 💪`;

    return {
      totalScore,
      maxScore,
      percentage,
      passed,
      perQuestionResults,
      overallFeedback
    };
  }
};

