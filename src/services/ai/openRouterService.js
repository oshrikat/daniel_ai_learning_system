/**
 * Tier 2/3 (Backup + Multimodal): OpenRouter API
 * Supports both text prompts and multimodal `inlineImages` / `images` via OpenAI-compatible `image_url` parts.
 * @param {string} apiKey
 * @param {string} prompt
 * @param {string} explicitModel
 * @param {object} [options]
 * @returns {Promise<string>}
 */
async function callOpenRouterAPI(apiKey, prompt, explicitModel = '', options = {}) {
  const key = cleanApiKey(apiKey);
  const model = explicitModel || appState?.apiConfig?.verifiedOpenRouterModel || 'openai/gpt-4o-mini';
  const rawImages = Array.isArray(options.inlineImages) && options.inlineImages.length > 0
    ? options.inlineImages
    : (Array.isArray(options.images) ? options.images : []);
  const imageList = rawImages.filter(img => img && (img.data || img.dataUrl) && !img.isNativePdf && img.mimeType !== 'application/pdf');

  const messages = [];
  if (options.systemInstruction && typeof options.systemInstruction === 'string' && options.systemInstruction.trim()) {
    messages.push({ role: 'system', content: options.systemInstruction.trim() });
  }

  const userContent = imageList.length > 0
    ? [
        { type: 'text', text: prompt },
        ...imageList.map(img => {
          const rawStr = String(img.dataUrl || img.data || '');
          const mime = img.mimeType || img.mime_type || 'image/jpeg';
          const url = rawStr.startsWith('data:') ? rawStr : `data:${mime};base64,${rawStr}`;
          return { type: 'image_url', image_url: { url } };
        })
      ]
    : prompt;
  messages.push({ role: 'user', content: userContent });

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, messages })
  });
  if (!res.ok) throw new Error(`OpenRouter (${model}) HTTP ${res.status}`);
  const data = await res.json();
  const choice = data?.choices?.[0]?.message;
  const text = stripThinkTags(choice?.content || choice?.reasoning_content || choice?.reasoning || '');
  if (!text) throw new Error(`OpenRouter (${model}) returned empty content`);
  return text;
}
