/**
 * Tier 2 (Fast Primary for Text / Socratic Tutor): Groq / Grok (xAI) API
 * Includes a 25-second AbortController timeout, explicit temperature (0.2 default),
 * JPEG-only Vision filtering with max_tokens <= 4096 cap, and Hebrew-only system guard.
 * @param {string} apiKey
 * @param {string} prompt
 * @param {string} explicitModel
 * @param {object} options
 * @returns {Promise<string>}
 */
async function callGrokAPI(apiKey, prompt, explicitModel = '', options = {}) {
  const key = cleanApiKey(apiKey);
  const isGroq = key.startsWith('gsk_');
  const endpoint = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.x.ai/v1/chat/completions';

  const rawImages = Array.isArray(options.images) && options.images.length > 0
    ? options.images
    : (Array.isArray(options.inlineImages) ? options.inlineImages : []);
  const validJpegImages = rawImages.filter(
    img => img && (img.url || img.data || img.dataUrl) && !img.isNativePdf && img.mimeType !== 'application/pdf'
  );
  const hasVisionImages = validJpegImages.length > 0;

  let model = explicitModel;
  if (!model) {
    if (hasVisionImages && isGroq) {
      model = appState?.apiConfig?.verifiedGroqVisionModel || 'meta-llama/llama-4-scout-17b-16e-instruct';
    } else {
      model = isGroq
        ? (appState?.apiConfig?.verifiedGroqModel || 'llama-3.3-70b-versatile')
        : 'grok-2-latest';
    }
  }

  let userContent = prompt;
  if (hasVisionImages) {
    userContent = [{ type: 'text', text: prompt }];
    validJpegImages.forEach(img => {
      const rawData = img.url || img.dataUrl || img.data;
      if (rawData) {
        const mime = img.mimeType || 'image/jpeg';
        const dataUrl = String(rawData).startsWith('data:') ? rawData : `data:${mime};base64,${rawData}`;
        userContent.push({ type: 'image_url', image_url: { url: dataUrl } });
      }
    });
  }

  const hebrewSystemGuard = options.systemInstruction || 'ענה אך ורק בעברית תקנית, ברורה ושלמה. אל תשתמש בשום מילה בערבית או בשפה זרה, ואל תקטע משפטים באמצע.';
  const messages = [
    { role: 'system', content: hebrewSystemGuard },
    { role: 'user', content: userContent }
  ];

  const temperature = typeof options.temperature === 'number' ? options.temperature : 0.2;
  const requestedTokens = Number(options.maxTokens) || 1500;
  const maxTokens = hasVisionImages ? Math.min(requestedTokens, 4096) : requestedTokens;

  const timeoutMs = options.timeoutMs || 25000;
  const createGroqAbortError = () => {
    if (typeof DOMException !== 'undefined') {
      return new DOMException('הבקשה ל-AI בוטלה על ידי המשתמש', 'AbortError');
    }
    const abortErr = new Error('הבקשה ל-AI בוטלה על ידי המשתמש');
    abortErr.name = 'AbortError';
    return abortErr;
  };

  if (options.abortSignal && options.abortSignal.aborted) {
    throw createGroqAbortError();
  }

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

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(options.jsonMode && !hasVisionImages ? { response_format: { type: 'json_object' } } : {})
      }),
      ...(controller ? { signal: controller.signal } : {})
    });
  } catch (err) {
    if (options.abortSignal && options.abortSignal.aborted) {
      if (err && err.name === 'AbortError') throw err;
      throw createGroqAbortError();
    }
    if (err && err.name === 'AbortError' && timedOut) {
      throw new Error(`Groq/Grok (${model}) timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
    if (onExternalAbort && options.abortSignal && typeof options.abortSignal.removeEventListener === 'function') {
      options.abortSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  if (!res.ok) throw new Error(`Groq/Grok (${model}) HTTP ${res.status}`);
  const data = await res.json();
  const choice = data?.choices?.[0]?.message;
  const rawText = choice?.content || choice?.reasoning_content || choice?.reasoning || '';
  const text = stripThinkTags(rawText);
  if (!text) throw new Error(`Groq/Grok (${model}) returned empty content`);
  return text;
}
