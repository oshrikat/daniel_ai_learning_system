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
 * @param {string} model - e.g. 'gemini-2.5-flash-lite'
 * @param {string} apiKey
 * @param {string} prompt
 * @param {object} options
 * @returns {Promise<string>}
 */
async function callGeminiAPI(model, apiKey, prompt, options = {}) {
  const key = cleanApiKey(apiKey);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const fullPrompt = (options.systemInstruction && !prompt.includes(options.systemInstruction))
    ? `${options.systemInstruction}\n\n${prompt}`
    : prompt;

  const parts = [{ text: fullPrompt }];

  const rawImageCandidates = Array.isArray(options.inlineImages) && options.inlineImages.length > 0
    ? options.inlineImages
    : (Array.isArray(options.images) ? options.images : []);
  const imageList = rawImageCandidates.filter(img => img && img.data && !img.isNativePdf && img.mimeType !== 'application/pdf');

  // Prevent duplicate payload inflation:
  // If rendered page JPEG snapshots exist (imageList.length > 0), attach ONLY imageList and do NOT attach rawPdfPart.
  // Attach rawPdfPart ONLY as a fallback when imageList.length === 0.
  if (imageList.length > 0) {
    imageList.forEach(img => {
      parts.push({
        inline_data: {
          mime_type: img.mimeType || img.mime_type || 'image/jpeg',
          data: String(img.data).replace(/^data:[^;]+;base64,/, '')
        }
      });
    });
  } else if (options.rawPdfPart && options.rawPdfPart.data) {
    parts.push({
      inline_data: {
        mime_type: options.rawPdfPart.mimeType || 'application/pdf',
        data: String(options.rawPdfPart.data).replace(/^data:[^;]+;base64,/, '')
      }
    });
  } else if (rawImageCandidates.length > 0) {
    rawImageCandidates.forEach(img => {
      if (img && img.data) {
        parts.push({
          inline_data: {
            mime_type: img.mimeType || img.mime_type || 'application/pdf',
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

  const timeoutMs = options.timeoutMs || 35000;
  const createGeminiAbortError = () => {
    if (typeof DOMException !== 'undefined') {
      return new DOMException('הבקשה ל-AI בוטלה על ידי המשתמש', 'AbortError');
    }
    const abortErr = new Error('הבקשה ל-AI בוטלה על ידי המשתמש');
    abortErr.name = 'AbortError';
    return abortErr;
  };

  if (options.abortSignal && options.abortSignal.aborted) {
    throw createGeminiAbortError();
  }

  const fetchWithTimeout = async (bodyPayload) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timedOut = false;
    let onExternalAbort = null;

    if (controller && options.abortSignal) {
      if (options.abortSignal.aborted) {
        controller.abort();
      } else if (typeof options.abortSignal.addEventListener === 'function') {
        onExternalAbort = () => controller.abort();
        options.abortSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const timer = controller
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

    try {
      if (options.abortSignal && options.abortSignal.aborted) {
        throw createGeminiAbortError();
      }
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify(bodyPayload),
        ...(controller ? { signal: controller.signal } : {})
      });
    } catch (err) {
      if (options.abortSignal && options.abortSignal.aborted) {
        if (err && err.name === 'AbortError') throw err;
        throw createGeminiAbortError();
      }
      if (err && err.name === 'AbortError' && timedOut) {
        throw new Error(`Gemini ${model} timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
      if (onExternalAbort && options.abortSignal && typeof options.abortSignal.removeEventListener === 'function') {
        options.abortSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  };

  let res = await fetchWithTimeout({ contents: [{ parts }], generationConfig });

  if (options.abortSignal && options.abortSignal.aborted) {
    throw createGeminiAbortError();
  }

  if (res.status === 400 && generationConfig.responseMimeType) {
    const fallbackConfig = {
      temperature: generationConfig.temperature,
      maxOutputTokens: generationConfig.maxOutputTokens
    };
    res = await fetchWithTimeout({ contents: [{ parts }], generationConfig: fallbackConfig });
  }

  if (!res.ok) throw new Error(`Gemini ${model} HTTP ${res.status}`);
  const data = await res.json();
  const text = stripThinkTags(data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
  if (!text) throw new Error(`Gemini ${model} returned empty content`);
  return text;
}
