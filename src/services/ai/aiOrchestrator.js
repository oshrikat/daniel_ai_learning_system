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
  }
};

