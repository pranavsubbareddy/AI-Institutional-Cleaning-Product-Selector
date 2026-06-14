const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');

const aiClients = new Map();
const geminiClients = new Map();

function isValidOpenAIKey(apiKey) {
  return typeof apiKey === 'string' && apiKey.trim().startsWith('sk-');
}

function isValidGeminiKey(apiKey) {
  if (typeof apiKey !== 'string') return false;
  const key = apiKey.trim();
  return key.length > 20 && !key.startsWith('sk-') && !key.includes('your_');
}

function splitKeyList(value) {
  if (!value) return [];
  return String(value)
    .split(/[\s,;]+/)
    .map(key => key.trim())
    .filter(Boolean);
}

function getOpenAIKeyCandidates() {
  const keys = [
    ...splitKeyList(process.env.OPENAI_API_KEYS),
    ...splitKeyList(process.env.OPENAI_API_KEY),
    ...splitKeyList(process.env.OPENAI_KEY),
  ];

  Object.keys(process.env)
    .filter(name => /^OPENAI_(?:API_)?KEY_\d+$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .forEach(name => keys.push(...splitKeyList(process.env[name])));

  // Some deployments used Gemini variable names while pasting OpenAI keys.
  // Accept those only when the value is clearly an OpenAI key.
  [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEYS,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_AI_API_KEY,
  ].forEach(value => keys.push(...splitKeyList(value)));

  return [...new Set(keys.filter(isValidOpenAIKey))];
}

function getGeminiKeyCandidates() {
  const keys = [
    ...splitKeyList(process.env.GEMINI_API_KEYS),
    ...splitKeyList(process.env.GEMINI_API_KEY),
    ...splitKeyList(process.env.GOOGLE_API_KEY),
    ...splitKeyList(process.env.GOOGLE_AI_API_KEY),
  ];

  Object.keys(process.env)
    .filter(name => /^(?:GEMINI|GOOGLE(?:_AI)?)_(?:API_)?KEY_\d+$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .forEach(name => keys.push(...splitKeyList(process.env[name])));

  return [...new Set(keys.filter(isValidGeminiKey))];
}

function getAIClient(apiKey) {
  const keys = apiKey ? [apiKey] : getOpenAIKeyCandidates();
  const selectedKey = keys[0];

  if (!selectedKey) {
    return null;
  }

  if (!aiClients.has(selectedKey)) {
    aiClients.set(selectedKey, new OpenAI({ apiKey: selectedKey, dangerouslyAllowBrowser: true }));
  }

  return aiClients.get(selectedKey);
}

function getGeminiClient(apiKey) {
  if (!apiKey) {
    return null;
  }

  if (!geminiClients.has(apiKey)) {
    geminiClients.set(apiKey, new GoogleGenAI({ apiKey }));
  }

  return geminiClients.get(apiKey);
}

/**
 * Generate recommendations using OpenAI.
 * Returns null if the AI call fails or is not configured — never falls back silently.
 * @param {Object} params - { institution_type, area_size, surface_types, hygiene_standard, budget, metadata }
 * @returns {Object|null} { recommendations: [...], summary: {...} } or null
 */
async function generateRecommendations(params) {
  const apiKeys = getOpenAIKeyCandidates();
  const geminiKeys = getGeminiKeyCandidates();

  if (apiKeys.length === 0 && geminiKeys.length === 0) {
    console.log('  No valid OpenAI or Gemini API key found. Returning null — AI-only recommendation route will return 503.');
    return null;
  }

  const catalog = getCatalogForPrompt();
  const prompt = buildPrompt(params, catalog);
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (apiKeys.length > 0) {
    console.log(`  Using OpenAI for recommendations with ${apiKeys.length} configured key(s)...`);
    console.log('  OpenAI model:', model);
  }

  for (let index = 0; index < apiKeys.length; index += 1) {
    const client = getAIClient(apiKeys[index]);

    try {
      console.log(`  Trying OpenAI API key ${index + 1}/${apiKeys.length}...`);

      const result = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are an expert Industrial Chemist and Procurement Auditor for institutional cleaning products. You must respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      });

      const text = result?.choices?.[0]?.message?.content;

      if (!text) {
        console.warn('  OpenAI returned empty response. Finish reason:', result?.choices?.[0]?.finish_reason || 'unknown');
        continue;
      }

      const parsed = extractJSON(text);
      if (parsed && parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0 && parsed.summary) {
        console.log('  OpenAI success —', parsed.recommendations.length, 'products recommended');
        return parsed;
      }

      console.warn('  OpenAI returned invalid/malformed JSON. Raw response (first 500 chars):', text.substring(0, 500));
    } catch (error) {
      const status = error.status || error.code || 'unknown';
      if (status === 429) {
        console.warn(`  ⛔ RATE LIMIT on OpenAI key ${index + 1}/${apiKeys.length}. Rotating to next key...`);
      } else {
        console.warn(`  OpenAI key ${index + 1}/${apiKeys.length} failed (${status}):`, error.message);
      }
      if (error.stack && index === apiKeys.length - 1) {
        console.warn('  Stack:', error.stack.split('\n').slice(0, 4).join('\n'));
      }
    }
  }

  const geminiModels = [
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ].filter(Boolean);
  const uniqueGeminiModels = [...new Set(geminiModels)];
  if (geminiKeys.length > 0) {
    console.log(`  Using Gemini for recommendations with ${geminiKeys.length} configured key(s)...`);
    console.log('  Gemini models:', uniqueGeminiModels.join(', '));
  }

  for (let index = 0; index < geminiKeys.length; index += 1) {
    const client = getGeminiClient(geminiKeys[index]);

    for (const geminiModel of uniqueGeminiModels) {
      try {
        console.log(`  Trying Gemini API key ${index + 1}/${geminiKeys.length} with ${geminiModel}...`);

        const result = await client.models.generateContent({
          model: geminiModel,
          contents: prompt,
          config: {
            systemInstruction: 'You are an expert Industrial Chemist and Procurement Auditor for institutional cleaning products. You must respond with valid JSON only.',
            temperature: 0.4,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        });

        const text = result?.text;

        if (!text) {
          console.warn(`  Gemini ${geminiModel} returned empty response.`);
          continue;
        }

        const parsed = extractJSON(text);
        if (parsed && parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0 && parsed.summary) {
          console.log('  Gemini success —', parsed.recommendations.length, 'products recommended');
          return parsed;
        }

        console.warn(`  Gemini ${geminiModel} returned invalid/malformed JSON. Raw response (first 500 chars):`, text.substring(0, 500));
      } catch (error) {
        const status = error.status || error.code || 'unknown';
        if (status === 429) {
          console.warn(`  ⛔ RATE LIMIT on Gemini key ${index + 1}/${geminiKeys.length} with ${geminiModel}. Rotating to next key...`);
        } else {
          console.warn(`  Gemini key ${index + 1}/${geminiKeys.length} with ${geminiModel} failed (${status}):`, error.message);
        }
        if (error.stack && index === geminiKeys.length - 1 && geminiModel === uniqueGeminiModels[uniqueGeminiModels.length - 1]) {
          console.warn('  Stack:', error.stack.split('\n').slice(0, 4).join('\n'));
        }
      }
    }
  }

  return null;
}

/**
 * Safely extract JSON from OpenAI / Gemini response.
 * Handles markdown fences, leading/trailing text, BOM characters, and
 * unescaped raw newlines / tabs / control characters that occasionally
 * appear inside string values (a common Gemini output issue).
 */
function extractJSON(text) {
  if (!text) return null;

  let cleaned = text.trim();

  // Remove BOM character if present
  if (cleaned.charCodeAt(0) === 0xFEFF) {
    cleaned = cleaned.slice(1).trim();
  }

  // Remove ALL markdown code fences (some models emit multiple, e.g. ```json\n```\n{...})
  cleaned = cleaned.replace(/```(?:json|javascript|js)?\s*/gi, '');
  cleaned = cleaned.replace(/```\s*/g, '');
  cleaned = cleaned.trim();

  // If there's still text before the first '{' or '[', remove it
  const firstBrace = cleaned.search(/[\[{]/);
  if (firstBrace > 0) {
    cleaned = cleaned.slice(firstBrace);
  }

  // If there's text after the last '}' or ']', trim to the last one
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (lastBrace > 0 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }

  // First attempt: parse as-is
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // Second attempt: scan char-by-char and escape raw control characters
    // that appear inside JSON string literals.
    try {
      const repaired = escapeControlCharsInStrings(cleaned);
      return JSON.parse(repaired);
    } catch (e2) {
      console.warn('  extractJSON: Failed to parse even after escaping control characters in strings');
      return null;
    }
  }
}

/**
 * Walk through a JSON string and escape raw newline / carriage-return / tab
 * characters that appear inside double-quoted string literals. Outside of
 * string literals (i.e. inside {} [] or between tokens) the text is left
 * untouched. This repairs the common Gemini failure mode where long
 * recommended_dilution or usage_guidance values are returned with literal
 * newlines instead of \\n escapes.
 */
function escapeControlCharsInStrings(input) {
  let out = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (escapeNext) {
      out += ch;
      escapeNext = false;
      continue;
    }

    if (inString) {
      if (ch === '\\') {
        out += ch;
        escapeNext = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      const code = ch.charCodeAt(0);
      // Other unescaped control characters (U+0000–U+001F) are invalid inside
      // a JSON string; replace with a space so parsing can succeed.
      if (code < 0x20) { out += ' '; continue; }
      out += ch;
      continue;
    }

    if (ch === '"') {
      inString = true;
    }
    out += ch;
  }

  return out;
}

function buildPrompt(params, catalog) {
  const meta = params.metadata || {};
  const equipment = (meta.equipment || []).join(', ') || 'None reported';
  const preferences = (meta.preferences || []).join(', ') || 'None specified';
  const certifications = (meta.certifications || []).join(', ') || 'None specified';
  const floors = meta.floors || 1;
  const occupants = meta.occupants || 'Unknown';
  const operatingHours = meta.operating_hours || 'Standard';
  const facilityAge = meta.facility_age || 'Moderate';
  const cleaningFreq = meta.cleaning_frequency || 'Daily';

  const institutionTypeLabels = {
    hospital: 'Hospital / Healthcare',
    school: 'School / Educational',
    hotel: 'Hotel / Hospitality',
    office: 'Office / Corporate',
    restaurant: 'Restaurant / Food Service',
    factory: 'Factory / Industrial',
    warehouse: 'Warehouse / Storage',
    retail: 'Retail / Store',
    gym: 'Gym / Fitness Center',
    laboratory: 'Laboratory / Research Facility',
    pharmacy: 'Pharmacy / Medical Store',
    airport: 'Airport / Transportation Hub',
    shopping_mall: 'Shopping Mall / Complex',
    cinema: 'Cinema / Theater',
    library: 'Library / Study Center',
    community_center: 'Community Center / Auditorium'
  };

  const instLabel = institutionTypeLabels[params.institution_type] || params.institution_type;

  return `You are an "Industrial Chemist and Procurement Auditor" with 20+ years of experience in institutional cleaning.

Analyze the following facility and recommend the MOST SUITABLE cleaning products from the provided catalog. Your recommendations MUST be TAILORED to the specific institution type — different facility types need different products.

=== FACILITY DETAILS ===
- Institution Type: ${instLabel} (${params.institution_type})
- Area Size: ${params.area_size} sq ft
- Surface Types: ${(params.surface_types || []).join(', ')}
- Number of Floors: ${floors}
- Approx. Occupants/Capacity: ${occupants}
- Operating Hours: ${operatingHours}
- Facility Age/Condition: ${facilityAge}
- Current Cleaning Frequency: ${cleaningFreq}

=== REQUIREMENTS ===
- Hygiene Standard: ${params.hygiene_standard}
- Budget: ${params.budget}

=== AVAILABLE EQUIPMENT ===
${equipment}

=== PRODUCT PREFERENCES ===
${preferences}

=== CERTIFICATIONS REQUIRED ===
${certifications}

=== AVAILABLE PRODUCTS (Catalog) ===
${JSON.stringify(catalog, null, 2)}

=== RECOMMENDATION RULES (CRITICAL — follow these strictly) ===
1. Select ONLY the 3-8 products that are MOST RELEVANT to ${instLabel}. DO NOT recommend the same products for every institution type.
2. HOSPITALS: Disinfectant, Hand Sanitizer, Floor Cleaner, Toilet Cleaner, General Purpose Cleaner
3. SCHOOLS: Disinfectant, Hand Sanitizer, Multi-Purpose Cleaner, Floor Cleaner, Glass Cleaner
4. HOTELS: Glass Cleaner, Carpet Cleaner, Toilet Cleaner, Air Freshener, Multi-Purpose Cleaner, Floor Cleaner
5. OFFICES: Multi-Purpose Cleaner, Glass Cleaner, Hand Sanitizer, Air Freshener, Floor Cleaner
6. RESTAURANTS: Heavy Duty Degreaser, Disinfectant, Floor Cleaner, Toilet Cleaner, General Purpose Cleaner
7. FACTORIES: Heavy Duty Degreaser, Floor Cleaner, Hand Sanitizer, Drain Cleaner, General Purpose Cleaner
8. WAREHOUSES: Floor Cleaner, Multi-Purpose Cleaner, Heavy Duty Degreaser
9. RETAIL: Glass Cleaner, Floor Cleaner, Multi-Purpose Cleaner, Air Freshener
10. GYMS: Disinfectant, Multi-Purpose Cleaner, Floor Cleaner, Hand Sanitizer, Heavy Duty Degreaser
11. LABORATORIES: Disinfectant, Floor Cleaner, Glass Cleaner, General Purpose Cleaner, Hand Sanitizer
12. PHARMACIES: Disinfectant, Glass Cleaner, Floor Cleaner, Hand Sanitizer, General Purpose Cleaner
13. AIRPORTS: Floor Cleaner, Glass Cleaner, Multi-Purpose Cleaner, Disinfectant, Air Freshener, Heavy Duty Degreaser
14. SHOPPING MALLS: Floor Cleaner, Glass Cleaner, Multi-Purpose Cleaner, Air Freshener, Toilet Cleaner
15. CINEMAS: Carpet Cleaner, Floor Cleaner, Multi-Purpose Cleaner, Air Freshener, Toilet Cleaner
16. LIBRARIES: Multi-Purpose Cleaner, Floor Cleaner, Glass Cleaner, Air Freshener
17. COMMUNITY CENTERS: Floor Cleaner, Multi-Purpose Cleaner, Disinfectant, Glass Cleaner, Hand Sanitizer
18. Calculate quantities based on area size (${params.area_size} sq ft), surface types, hygiene level, and budget.
19. Calculate cost as: quantity × unit price. Use the prices listed in the catalog.
20. IMPORTANT: Use the EXACT product names from the catalog (without any brand prefixes).

Respond with ONLY valid JSON in the following format:
{
  "recommendations": [
    {
      "productId": "string (must match one of the catalog product IDs exactly)",
      "sku": "string",
      "name": "string (exact catalog name)",
      "recommended_dilution": "string",
      "estimated_monthly_qty_units": 0,
      "calculated_cost": 0,
      "usage_guidance": "string",
      "safety_notes": "string"
    }
  ],
  "summary": {
    "grossAggregatedCost": 0,
    "financialStatusAlert": "string or null"
  }
}`;
}

function getCatalogForPrompt() {
  return [
    { id: 'prod-gpc-001', sku: 'GPC-5L-001', name: 'Multi-Purpose Cleaner', price: 180, unit: '5L', surfaces: ['hard_floor', 'tile', 'countertop'], category: 'General Purpose Cleaner', hygiene_level: 'standard', tags: ['eco_friendly', 'concentrated', 'fragrance_free'] },
    { id: 'prod-dsf-002', sku: 'HDS-5L-002', name: 'Hospital-Grade Disinfectant', price: 350, unit: '5L', surfaces: ['hard_floor', 'tile', 'stainless_steel', 'countertop'], category: 'Disinfectant', hygiene_level: 'medical_grade', tags: ['concentrated', 'industrial_grade'] },
    { id: 'prod-gls-003', sku: 'GLS-5L-003', name: 'Glass & Surface Shine', price: 220, unit: '5L', surfaces: ['glass', 'mirror', 'stainless_steel'], category: 'Glass Cleaner', hygiene_level: 'standard', tags: ['ready_to_use', 'fragrance_free', 'hypoallergenic'] },
    { id: 'prod-flr-004', sku: 'FLR-5L-004', name: 'Floor Shine Pro', price: 280, unit: '5L', surfaces: ['hard_floor', 'tile', 'marble'], category: 'Floor Cleaner', hygiene_level: 'high', tags: ['concentrated', 'eco_friendly'] },
    { id: 'prod-crp-005', sku: 'CRP-5L-005', name: 'Carpet Cleaner Pro', price: 420, unit: '5L', surfaces: ['carpet'], category: 'Carpet Cleaner', hygiene_level: 'standard', tags: ['concentrated', 'fragrance_free'] },
    { id: 'prod-stl-006', sku: 'STL-5L-006', name: 'Stainless Steel Polish', price: 380, unit: '5L', surfaces: ['stainless_steel'], category: 'Stainless Steel Polish', hygiene_level: 'standard', tags: ['ready_to_use', 'fragrance_free'] },
    { id: 'prod-wpd-007', sku: 'WPD-5L-007', name: 'Wood Polish Premium', price: 450, unit: '5L', surfaces: ['wood'], category: 'Wood Polish', hygiene_level: 'standard', tags: ['ready_to_use', 'eco_friendly'] },
    { id: 'prod-tlt-008', sku: 'TLT-5L-008', name: 'Toilet & Restroom Cleaner', price: 200, unit: '5L', surfaces: ['tile', 'porcelain'], category: 'Toilet Cleaner', hygiene_level: 'standard', tags: ['ready_to_use', 'fragrance_free'] },
    { id: 'prod-hnd-009', sku: 'HND-5L-009', name: 'Hand Sanitizer Gel', price: 160, unit: '5L', surfaces: ['skin'], category: 'Hand Sanitizer', hygiene_level: 'high', tags: ['ready_to_use', 'fragrance_free', 'hypoallergenic'] },
    { id: 'prod-hdd-010', sku: 'HDD-5L-010', name: 'Heavy Duty Degreaser', price: 320, unit: '5L', surfaces: ['hard_floor', 'stainless_steel', 'tile', 'countertop'], category: 'Heavy Duty Degreaser', hygiene_level: 'standard', tags: ['concentrated', 'industrial_grade'] },
    { id: 'prod-bio-011', sku: 'BIO-5L-011', name: 'Bio-Enzymatic Drain Cleaner', price: 290, unit: '5L', surfaces: ['drain'], category: 'Drain Cleaner', hygiene_level: 'standard', tags: ['eco_friendly', 'ready_to_use', 'hypoallergenic'] },
    { id: 'prod-air-012', sku: 'AIR-5L-012', name: 'Air Freshener Mist', price: 190, unit: '5L', surfaces: ['air'], category: 'Air Freshener', hygiene_level: 'standard', tags: ['ready_to_use', 'fragrance_free'] }
  ];
}

module.exports = {
  generateRecommendations,
  getAIClient,
  getGeminiClient,
  getOpenAIKeyCandidates,
  getGeminiKeyCandidates,
  extractJSON,
};
