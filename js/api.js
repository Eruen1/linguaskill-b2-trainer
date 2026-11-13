const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';

async function callGeminiJson(systemPrompt, userPrompt, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    openModal('apiModal');
    throw new Error('Please enter your free Gemini API Key first.');
  }

  const thinkingBudget = options.thinkingBudget ?? 1024;
  const maxOutputTokens = options.maxOutputTokens ?? 1500;

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
      maxOutputTokens: maxOutputTokens,
      thinkingConfig: {
        thinkingBudget: thinkingBudget
      }
    }
  };

  let response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  // Fallback falls das Modell thinkingConfig ablehnt
  if (response.status === 400) {
    delete requestBody.generationConfig.thinkingConfig;
    response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error (${response.status}): ${errText}`);
  }

const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleanJson);
}