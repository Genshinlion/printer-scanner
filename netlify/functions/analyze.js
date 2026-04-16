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
    if (!apiKey) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing API key' }) };

    const prompt = `Identify this printer from both photos. Reply with ONLY a JSON object, nothing else, no markdown:
{"brand":"","model":"","model_number":"","manufacturer":"","serial_number":"","ink_type":"Ink or Toner","ink_cartridge_numbers":"","connectivity":"","printer_type":"","color_support":"Color or Mono","condition_notes":"","additional_notes":""}`;

    // Try models in order until one works
    const models = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    let lastError = '';
    for (const model of models) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: 'image/jpeg', data: frontB64 } },
                  { inline_data: { mime_type: 'image/jpeg', data: backB64  } }
                ]
              }],
              generationConfig: { maxOutputTokens: 1500, temperature: 0.1 }
            })
          }
        );

        const data = await resp.json();

        if (resp.status === 404) {
          lastError = `${model} not found`;
          continue; // try next model
        }

        if (!resp.ok) {
          const msg = (data.error && data.error.message) || resp.statusText;
          return { statusCode: resp.status, headers, body: JSON.stringify({ error: msg }) };
        }

        const raw   = data.candidates[0].content.parts[0].text;
        // Extract JSON object even if Gemini adds extra text around it
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI did not return valid JSON. Raw: ' + raw.slice(0, 200) }) };
        const clean = match[0];
        // Validate it parses correctly before returning
        try { JSON.parse(clean); } catch(e) { return { statusCode: 500, headers, body: JSON.stringify({ error: 'JSON parse failed: ' + e.message + ' Raw: ' + raw.slice(0, 200) }) }; }
        return { statusCode: 200, headers, body: clean };

      } catch (modelErr) {
        lastError = modelErr.message;
        continue;
      }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'No working Gemini model found. Last error: ' + lastError }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
