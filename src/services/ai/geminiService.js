// ============================================================================
// 6b. Multi-Tier AI Fallback Helpers (client-side only — GitHub Pages safe)
// ============================================================================

function stripThinkTags(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Tier 1 (Primary): Gemini REST API
 * Supports `application/pdf` and `image/jpeg` / `image/png` inline parts,
 * 8192 token output budget, and automatic retry if `responseMimeType` is rejected with HTTP 400.
 * @param {string} model - e.g. 'gemini-3.6-flash'
 * @param {string} apiKey
 * @param {string} prompt
 * @param {object} options
 * @returns {Promise<string>}
 */
async function callGeminiAPI(model, apiKey, prompt, options = {}) {
  const key = cleanApiKey(apiKey);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const fullPrompt = (options.systemInstruction && !prompt.includes(options.systemInstruction))
    ? `${options.systemInstruction}\n\n${prompt}`
    : prompt;

  const parts = [{ text: fullPrompt }];

  if (options.rawPdfPart && options.rawPdfPart.data) {
    parts.push({
      inline_data: {
        mime_type: options.rawPdfPart.mimeType || 'application/pdf',
        data: String(options.rawPdfPart.data).replace(/^data:[^;]+;base64,/, '')
      }
    });
  }

  const imageList = Array.isArray(options.inlineImages) && options.inlineImages.length > 0
    ? options.inlineImages
    : (Array.isArray(options.images) ? options.images : []);

  if (imageList.length > 0) {
    imageList.forEach(img => {
      if (img && img.data) {
        if (options.rawPdfPart && img.isNativePdf && img.data === options.rawPdfPart.data) {
          return;
        }
        parts.push({
          inline_data: {
            mime_type: img.mimeType || img.mime_type || 'image/jpeg',
            data: String(img.data).replace(/^data:[^;]+;base64,/, '')
          }
        });
      }
    });
  }

  const generationConfig = {
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.2,
    maxOutputTokens: options.maxTokens || 8192
  };
  if (options.jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  let res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig })
  });

  if (res.status === 400 && generationConfig.responseMimeType) {
    const fallbackConfig = {
      temperature: generationConfig.temperature,
      maxOutputTokens: generationConfig.maxOutputTokens
    };
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: fallbackConfig })
    });
  }

  if (!res.ok) throw new Error(`Gemini ${model} HTTP ${res.status}`);
  const data = await res.json();
  const text = stripThinkTags(data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
  if (!text) throw new Error(`Gemini ${model} returned empty content`);
  return text;
}
