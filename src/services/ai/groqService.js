/**
 * Tier 2 (Secondary): Groq / Grok (xAI) API
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

  let model = explicitModel;
  if (!model) {
    if (Array.isArray(options.images) && options.images.length > 0 && isGroq) {
      model = appState?.apiConfig?.verifiedGroqVisionModel || 'meta-llama/llama-4-scout-17b-16e-instruct';
    } else {
      model = isGroq
        ? (appState?.apiConfig?.verifiedGroqModel || 'qwen/qwen3.8-27b')
        : 'grok-2-latest';
    }
  }

  let userContent = prompt;
  if (Array.isArray(options.images) && options.images.length > 0) {
    userContent = [{ type: 'text', text: prompt }];
    options.images.forEach(img => {
      if (img && (img.url || img.data)) {
        const dataUrl = img.url || (img.data.startsWith('data:') ? img.data : `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`);
        userContent.push({ type: 'image_url', image_url: { url: dataUrl } });
      }
    });
  }

  const hebrewSystemGuard = options.systemInstruction || 'ענה אך ורק בעברית תקנית, ברורה ושלמה. אל תשתמש בשום מילה בערבית או בשפה זרה, ואל תקטע משפטים באמצע.';
  const messages = [
    { role: 'system', content: hebrewSystemGuard },
    { role: 'user', content: userContent }
  ];

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, messages, max_tokens: options.maxTokens || 1500 })
  });
  if (!res.ok) throw new Error(`Groq/Grok (${model}) HTTP ${res.status}`);
  const data = await res.json();
  const choice = data?.choices?.[0]?.message;
  const rawText = choice?.content || choice?.reasoning_content || choice?.reasoning || '';
  const text = stripThinkTags(rawText);
  if (!text) throw new Error(`Groq/Grok (${model}) returned empty content`);
  return text;
}

