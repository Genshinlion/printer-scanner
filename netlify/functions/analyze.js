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

    const prompt = `You are an expert at identifying office printers. Carefully examine BOTH images (front and back of the same printer) and extract every detail visible. Return ONLY a raw JSON object — no markdown, no code fences, no explanation:
{"brand":"e.g. HP, Canon, Brother, Epson","model":"full model name","model_number":"product number from label","manufacturer":"company name","serial_number":"from label or null","ink_type":"Ink or Toner","ink_cartridge_numbers":"e.g. HP 305XL or Canon PG-540","connectivity":"e.g. USB WiFi Ethernet","printer_type":"e.g. Inkjet All-in-One or Laser","color_support":"Color or Mono","condition_notes":"visible issues or No issues visible","additional_notes":"anything useful for ordering ink or maintenance"}`;

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
              generationConfig: { maxOutputTokens: 800, temperature: 0.1 }
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
