exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { frontB64, backB64 } = JSON.parse(event.body);
    if (!frontB64 || !backB64) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing images' }) };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured on server.' }) };

    const prompt = `You are a printer hardware expert. Look carefully at both images (front and top of the same printer) and read every label, sticker and marking visible.

Extract only what you can actually see. Return ONLY this JSON — no markdown, no code fences, nothing else:
{
  "brand": "brand name e.g. Canon, HP, Brother, Epson",
  "model": "full model name exactly as printed e.g. PIXMA TS3722",
  "model_number": "alphanumeric product code from label e.g. TS3722",
  "manufacturer": "full company name",
  "serial_number": "serial number exactly as shown on label, or null if not visible",
  "printer_type": "e.g. Inkjet All-in-One, Laser, Label Printer",
  "condition_notes": "any visible damage, error lights or issues — or: No issues visible"
}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frontB64 } },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: backB64  } }
          ]
        }]
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = (data.error && data.error.message) || resp.statusText;
      if (resp.status === 401) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid Anthropic API key.' }) };
      if (resp.status === 429) return { statusCode: 429, headers, body: JSON.stringify({ error: 'Rate limit hit. Wait a moment and try again.' }) };
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: msg }) };
    }

    const raw   = data.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI did not return valid JSON.' }) };
    const parsed = JSON.parse(match[0]);

    return { statusCode: 200, headers, body: JSON.stringify({
      brand:         parsed.brand         || '',
      model:         parsed.model         || '',
      model_number:  parsed.model_number  || '',
      manufacturer:  parsed.manufacturer  || '',
      serial_number: parsed.serial_number || null,
      printer_type:  parsed.printer_type  || '',
      condition_notes: parsed.condition_notes || 'No issues visible'
    })};

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
