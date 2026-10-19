/**
 * Tier 3 (Backup): OpenRouter API
 * @param {string} apiKey
 * @param {string} prompt
 * @param {string} explicitModel
 * @returns {Promise<string>}
 */
async function callOpenRouterAPI(apiKey, prompt, explicitModel = '') {
  const key = cleanApiKey(apiKey);
  const model = explicitModel || appState?.apiConfig?.verifiedOpenRouterModel || 'openai/gpt-4o-mini';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] })
  });
  if (!res.ok) throw new Error(`OpenRouter (${model}) HTTP ${res.status}`);
  const data = await res.json();
  const choice = data?.choices?.[0]?.message;
  const text = stripThinkTags(choice?.content || choice?.reasoning_content || choice?.reasoning || '');
  if (!text) throw new Error(`OpenRouter (${model}) returned empty content`);
  return text;
}

