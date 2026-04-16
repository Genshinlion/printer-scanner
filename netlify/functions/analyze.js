exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { frontB64, backB64, apiKey } = JSON.parse(event.body);

    if (!frontB64 || !backB64) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing images' }) };
    }
    if (!apiKey) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing API key' }) };
    }

    const prompt = `You are an expert at identifying office printers. Carefully examine BOTH images (front and back of the same printer) and extract every detail visible on the printer and its labels. Return ONLY a raw JSON object — no markdown, no code fences, no explanation whatsoever:
{
  "brand": "e.g. HP, Canon, Brother, Epson, Xerox",
  "model": "full model name e.g. DeskJet 2710e",
  "model_number": "product/part number from label",
  "manufacturer": "company full name",
  "serial_number": "exactly as shown on label, or null if not visible",
  "ink_type": "Ink or Toner",
  "ink_cartridge_numbers": "e.g. HP 305XL, Canon PG-540/CL-541 — be as specific as possible",
  "connectivity": "e.g. USB, WiFi, Bluetooth, Ethernet",
  "printer_type": "e.g. Inkjet All-in-One, Laser, Photo Printer",
  "color_support": "Color or Mono",
  "condition_notes": "visible damage, error lights, paper jams, low ink warnings — or say: No issues visible",
  "additional_notes": "any other details useful for ordering ink, toner or spare parts"
}`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${apiKey}`,
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

    const geminiData = await geminiResp.json();

    if (!geminiResp.ok) {
      const msg = (geminiData.error && geminiData.error.message) || geminiResp.statusText;
      return { statusCode: geminiResp.status, headers, body: JSON.stringify({ error: msg }) };
    }

    const raw   = geminiData.candidates[0].content.parts[0].text;
    const clean = raw.replace(/```json|```/g, '').trim();

    return { statusCode: 200, headers, body: clean };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
