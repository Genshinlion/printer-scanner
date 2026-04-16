exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { frontB64, backB64, apiKey } = JSON.parse(event.body);
    if (!frontB64 || !backB64) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing images' }) };
    if (!apiKey)               return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing API key' }) };

    const prompt = `You are an expert at identifying office printers. Examine BOTH images (front and top of the same printer) and extract every detail visible. Return ONLY a raw JSON object — no markdown, no code fences, no explanation:
{"brand":"","model":"","model_number":"","manufacturer":"","serial_number":"","ink_type":"Ink or Toner","ink_cartridge_numbers":"","connectivity":"","printer_type":"","color_support":"Color or Mono","condition_notes":"","additional_notes":""}`;

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + frontB64 } },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + backB64  } }
          ]
        }]
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      const msg = (data.error && data.error.message) || resp.statusText;
      if (resp.status === 401) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid Groq API key. Get a free one at console.groq.com' }) };
      if (resp.status === 429) return { statusCode: 429, headers, body: JSON.stringify({ error: 'Groq rate limit hit. Wait a moment and try again.' }) };
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: msg }) };
    }

    const raw   = data.choices[0].message.content;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI did not return valid JSON. Raw: ' + raw.slice(0, 200) }) };
    const clean = match[0];
    try { JSON.parse(clean); } catch(e) { return { statusCode: 500, headers, body: JSON.stringify({ error: 'JSON parse failed: ' + e.message }) }; }

    return { statusCode: 200, headers, body: clean };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
