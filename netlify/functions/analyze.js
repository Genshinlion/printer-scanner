exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  // ── Verified ink lookup table ─────────────────────────────────────────────
  // Format: 'BRAND|MODEL_KEYWORD': { cartridges, ink_type, recommendation }
  const INK_DB = {
    // Canon PIXMA TS series
    'CANON|TS3720': { c: 'PG-275XL, CL-276XL', t: 'Ink', r: 'Order PG-275XL Black and CL-276XL Colour. Multipack (PG-275XL/CL-276XL combo) available on Amazon and saves money. ~300 pages black, ~150 pages colour.' },
    'CANON|TS3722': { c: 'PG-275XL, CL-276XL', t: 'Ink', r: 'Order PG-275XL Black and CL-276XL Colour. Multipack available on Amazon. ~300 pages black, ~150 pages colour.' },
    'CANON|TS3750': { c: 'PG-575XL, CL-576XL', t: 'Ink', r: 'Order PG-575XL Black and CL-576XL Colour. Available on Amazon and Canon store.' },
    'CANON|TS3351': { c: 'PG-575XL, CL-576XL', t: 'Ink', r: 'Order PG-575XL Black and CL-576XL Colour. Available on Amazon and Canon store.' },
    'CANON|TS3450': { c: 'PG-575XL, CL-576XL', t: 'Ink', r: 'Order PG-575XL Black and CL-576XL Colour. Available on Amazon and Canon store.' },
    'CANON|TR4520': { c: 'PG-275XL, CL-276XL', t: 'Ink', r: 'Order PG-275XL Black and CL-276XL Colour. Multipack available on Amazon.' },
    'CANON|TR4527': { c: 'PG-275XL, CL-276XL', t: 'Ink', r: 'Order PG-275XL Black and CL-276XL Colour. Multipack available on Amazon.' },
    'CANON|MG2520': { c: 'PG-245XL, CL-246XL', t: 'Ink', r: 'Order PG-245XL Black and CL-246XL Colour. Combo pack available on Amazon.' },
    'CANON|MG2522': { c: 'PG-245XL, CL-246XL', t: 'Ink', r: 'Order PG-245XL Black and CL-246XL Colour. Combo pack available on Amazon.' },
    'CANON|MG3620': { c: 'PG-245XL, CL-246XL', t: 'Ink', r: 'Order PG-245XL Black and CL-246XL Colour. Combo pack available on Amazon.' },
    // HP DeskJet
    'HP|DESKJET 2710': { c: 'HP 305XL Black, HP 305XL Colour', t: 'Ink', r: 'Order HP 305XL Black (3YM62AE) and HP 305XL Colour (3YM63AE). Combo pack available at HP store and Amazon.' },
    'HP|DESKJET 2720': { c: 'HP 305XL Black, HP 305XL Colour', t: 'Ink', r: 'Order HP 305XL Black (3YM62AE) and HP 305XL Colour (3YM63AE). Combo pack available at HP store and Amazon.' },
    'HP|DESKJET 3760': { c: 'HP 305XL Black, HP 305XL Colour', t: 'Ink', r: 'Order HP 305XL Black (3YM62AE) and HP 305XL Colour (3YM63AE). Combo pack available at HP store and Amazon.' },
    'HP|DESKJET 4120': { c: 'HP 305XL Black, HP 305XL Colour', t: 'Ink', r: 'Order HP 305XL Black (3YM62AE) and HP 305XL Colour (3YM63AE). Combo pack available at HP store and Amazon.' },
    'HP|ENVY 6020':    { c: 'HP 305XL Black, HP 305XL Colour', t: 'Ink', r: 'Order HP 305XL Black (3YM62AE) and HP 305XL Colour (3YM63AE). Available at HP store and Amazon.' },
    'HP|OFFICEJET 3830': { c: 'HP 63XL Black, HP 63XL Colour', t: 'Ink', r: 'Order HP 63XL Black (F6U64AN) and HP 63XL Colour (F6U63AN). Combo pack available on Amazon.' },
    'HP|OFFICEJET 4650': { c: 'HP 63XL Black, HP 63XL Colour', t: 'Ink', r: 'Order HP 63XL Black (F6U64AN) and HP 63XL Colour (F6U63AN). Combo pack available on Amazon.' },
    'HP|LASERJET PRO M404': { c: 'HP 58A (CF258A) or 58X (CF258X) XL', t: 'Toner', r: 'Order HP 58X (CF258X) high yield toner for best value. Available at HP store, Amazon and Staples.' },
    'HP|LASERJET PRO M428': { c: 'HP 58A (CF258A) or 58X (CF258X) XL', t: 'Toner', r: 'Order HP 58X (CF258X) high yield toner. Available at HP store and Amazon.' },
    // Epson
    'EPSON|XP-2100': { c: 'Epson 603XL Black, Colour (C/M/Y)', t: 'Ink', r: 'Order Epson 603XL multipack (C13T03A64010). Available on Amazon and Epson store.' },
    'EPSON|XP-3100': { c: 'Epson 603XL Black, Colour (C/M/Y)', t: 'Ink', r: 'Order Epson 603XL multipack (C13T03A64010). Available on Amazon and Epson store.' },
    'EPSON|XP-4100': { c: 'Epson 603XL Black, Colour (C/M/Y)', t: 'Ink', r: 'Order Epson 603XL multipack (C13T03A64010). Available on Amazon and Epson store.' },
    'EPSON|WORKFORCE WF-2830': { c: 'Epson 232XL (T232XL)', t: 'Ink', r: 'Order Epson 232XL multipack. Available on Amazon and Epson store.' },
    // Brother
    'BROTHER|MFC-J497DW': { c: 'Brother LC3011 or LC3013 XL', t: 'Ink', r: 'Order Brother LC3013 XL combo pack for best value. Available on Amazon and Brother store.' },
    'BROTHER|MFC-J895DW': { c: 'Brother LC3033 or LC3035 XXL', t: 'Ink', r: 'Order Brother LC3035 XXL combo pack. Available on Amazon and Brother store.' },
    'BROTHER|HL-L2350DW': { c: 'Brother TN760 or TN730', t: 'Toner', r: 'Order Brother TN760 high yield toner for best value (~3,000 pages). Available on Amazon and Brother store.' },
    'BROTHER|HL-L2370DW': { c: 'Brother TN760 or TN730', t: 'Toner', r: 'Order Brother TN760 high yield toner (~3,000 pages). Available on Amazon and Brother store.' },
  };

  function lookupInk(brand, model) {
    const b = (brand || '').toUpperCase();
    const m = (model || '').toUpperCase();
    for (const key of Object.keys(INK_DB)) {
      const [kb, km] = key.split('|');
      if (b.includes(kb) && m.includes(km)) return INK_DB[key];
    }
    return null;
  }

  try {
    const { frontB64, backB64 } = JSON.parse(event.body);
    if (!frontB64 || !backB64) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing images' }) };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured on server.' }) };

    const prompt = `You are a printer hardware expert. Look at both images (front and top of the same printer).

Identify the printer and extract label details. Return ONLY this JSON — no markdown, no code fences:
{
  "brand": "e.g. Canon",
  "model": "exact model name e.g. PIXMA TS3722",
  "model_number": "from label",
  "manufacturer": "full company name",
  "serial_number": "from label if visible, otherwise null",
  "printer_type": "e.g. Inkjet All-in-One",
  "condition_notes": "visible issues or: No issues visible"
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
        max_tokens: 800,
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

    // Look up verified ink from database first
    const verified = lookupInk(parsed.brand, parsed.model);

    const result = {
      brand:                parsed.brand          || '',
      model:                parsed.model          || '',
      model_number:         parsed.model_number   || '',
      manufacturer:         parsed.manufacturer   || parsed.brand || '',
      serial_number:        parsed.serial_number  || null,
      ink_type:             verified ? verified.t : 'Ink',
      ink_cartridge_numbers: verified ? verified.c : 'Check ' + (parsed.brand||'manufacturer') + ' website for ' + (parsed.model||'this model'),
      printer_type:         parsed.printer_type   || '',
      condition_notes:      parsed.condition_notes|| 'No issues visible',
      ink_recommendation:   verified ? verified.r : 'Search "' + (parsed.brand||'') + ' ' + (parsed.model||'') + ' ink cartridge" on Amazon or the manufacturer website to find the correct cartridge.',
      verified_from_db:     verified ? true : false
    };

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
