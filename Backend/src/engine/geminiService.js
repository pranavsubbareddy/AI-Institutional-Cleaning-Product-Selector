const { ChatOpenAI } = require('@langchain/openai');
const { z } = require('zod');

// ── Zod schema for structured output ──────────────────────────────────
const RecommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        productId: z.string().describe('Unique product ID (generate your own, e.g., AI-PROD-001)'),
        sku: z.string().describe('Product SKU code (generate your own)'),
        name: z.string().describe('Real institutional cleaning product name with brand'),
        recommended_dilution: z.string().describe('Dilution ratio or "Ready to use"'),
        estimated_monthly_qty_units: z.number().describe('Estimated monthly quantity in units'),
        calculated_cost: z.number().describe('Calculated monthly cost in INR'),
        usage_guidance: z.string().describe('How to use the product'),
        safety_notes: z.string().describe('Safety precautions'),
      })
    )
    .describe('Array of recommended products — recommend the right number of products (typically 4-10 depending on facility complexity and needs)'),
  summary: z.object({
    grossAggregatedCost: z.number().describe('Total monthly cost of all recommended products in INR'),
    financialStatusAlert: z.string().nullable().describe('Budget/financial alert message or null'),
  }),
});

// ── Key validation ────────────────────────────────────────────────────
function isValidGroqKey(apiKey) {
  return typeof apiKey === 'string' && apiKey.trim().startsWith('gsk_');
}

function splitKeyList(value) {
  if (!value) return [];
  return String(value)
    .split(/[\s,;]+/)
    .map(key => key.trim())
    .filter(Boolean);
}

// ── Key discovery ─────────────────────────────────────────────────────
function getGroqKeyCandidates() {
  const keys = [
    ...splitKeyList(process.env.GROQ_API_KEYS),
    ...splitKeyList(process.env.GROQ_API_KEY),
  ];

  Object.keys(process.env)
    .filter(name => /^GROQ_(?:API_)?KEY_\d+$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .forEach(name => keys.push(...splitKeyList(process.env[name])));

  return [...new Set(keys.filter(isValidGroqKey))];
}

// ── Model cache ───────────────────────────────────────────────────────
const modelCache = new Map();

function getStructuredModel(key, provider) {
  const cacheKey = `${provider}:${key}`;
  if (modelCache.has(cacheKey)) return modelCache.get(cacheKey);

  let model;
  if (provider === 'groq') {
    const chatModel = new ChatOpenAI({
      apiKey: key,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.3,
      maxTokens: 3000,
      timeout: 10000,
      maxRetries: 0,
      configuration: {
        baseURL: "https://api.groq.com/openai/v1"
      }
    });
    model = chatModel.withStructuredOutput(RecommendationSchema, {
      name: 'recommendation',
      method: 'jsonMode',
    });
  }

  modelCache.set(cacheKey, model);
  return model;
}

/**
 * Generate recommendations using LangChain (Groq).
 * Returns null if no API key is configured or all providers fail.
 * @param {Object} params - { institution_type, area_size, surface_types, hygiene_standard, budget, metadata }
 * @returns {Object|null} { recommendations: [...], summary: {...} } or null
 */
async function generateRecommendations(params) {
  const groqKeys = getGroqKeyCandidates();

  if (groqKeys.length === 0) {
    console.log('  No valid Groq API key found. Returning null — AI-only recommendation route will return 503.');
    return null;
  }

  const catalog = getCatalogForPrompt();
  const prompt = buildPrompt(params, catalog);

  console.log(`  Using LangChain Groq with ${groqKeys.length} configured key(s)...`);
  console.log('  Groq model:', process.env.GROQ_MODEL || 'llama-3.3-70b-versatile');

  for (let index = 0; index < groqKeys.length; index += 1) {
    try {
      console.log(`  Trying Groq API key ${index + 1}/${groqKeys.length}...`);
      const structuredModel = getStructuredModel(groqKeys[index], 'groq');
      const result = await Promise.race([
        structuredModel.invoke(prompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 30000))
      ]);

      if (result && result.recommendations && result.recommendations.length > 0 && result.summary) {
        console.log('  Groq success —', result.recommendations.length, 'products recommended');
        return result;
      }

      console.warn('  Groq returned invalid/malformed response.');
    } catch (error) {
      if (error.message === 'TIMEOUT') {
        console.warn(`  ⛔ TIMEOUT on Groq key ${index + 1}/${groqKeys.length}. Moving to next key...`);
      } else {
        const status = error.status || error.code || 'unknown';
        if (status === 429) {
          console.warn(`  ⛔ RATE LIMIT on Groq key ${index + 1}/${groqKeys.length}. Rotating to next key...`);
        } else {
          console.warn(`  Groq key ${index + 1}/${groqKeys.length} failed (${status}):`, error.message);
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
  const equipment = (meta.equipment || []).join(', ') || 'None';
  const area = params.area_size ? `${params.area_size} sq ft` : 'Unknown';
  const surfaces = (params.surface_types || []).join(', ') || 'Various';
  const hygiene = params.hygiene_standard || 'Standard';
  const budget = params.budget || 'Medium';
  const instType = params.institution_type || 'Facility';
  const occupants = meta.occupants || 'Unknown';
  const floors = meta.floors || 1;
  const frequency = meta.cleaning_frequency || 'daily';
  const preferences = (meta.preferences || []).join(', ') || 'None';

  return `You are a cleaning product procurement expert for India. Recommend cleaning products for this specific facility.

FACILITY DETAILS:
- Type: ${instType}
- Area: ${area}
- Surfaces to clean: ${surfaces}
- Hygiene standard required: ${hygiene}
- Budget level: ${budget}
- Occupants: ${occupants}
- Floors: ${floors}
- Cleaning frequency: ${frequency}
- Available equipment: ${equipment}
- Product preferences: ${preferences}

INSTRUCTIONS:
1. Recommend an appropriate number of products based on the facility's needs (typically 4-10 products depending on size, surface types, and complexity)
2. Products MUST match the specific surfaces listed above — recommend at least one product for each surface type
3. Match products to the institution type (e.g., hospital needs disinfectants, school needs general cleaners, restaurant needs degreasers)
4. Price products according to the budget level: low = economical brands (₹100-300/unit), medium = standard brands (₹150-500/unit), high = premium brands (₹300-800/unit)
5. Calculate quantities based on area size — larger areas need more quantity
6. Do NOT just recommend top brands — choose products that are appropriate for this specific facility's requirements and budget
7. Set calculated_cost as (estimated_monthly_qty_units × unit_price)
8. Set financialStatusAlert if total cost seems too high for the facility size/budget

For each product: productId (e.g. REC-001), sku, name (use realistic Indian brands: low budget = local brands; medium = Savo, Vim, Lizol, Domex, Colin; high = Diversey, 3M, SC Johnson), recommended_dilution, estimated_monthly_qty_units, calculated_cost (INR total monthly), usage_guidance, safety_notes

Respond ONLY with valid JSON matching this schema:
{"recommendations":[{"productId":"","sku":"","name":"","recommended_dilution":"","estimated_monthly_qty_units":0,"calculated_cost":0,"usage_guidance":"","safety_notes":""}],"summary":{"grossAggregatedCost":0,"financialStatusAlert":null}}`;
}

function getCatalogForPrompt() {
  // No hardcoded catalog — the AI generates products from its own knowledge
  return [];
}

module.exports = {
  generateRecommendations,
  getGroqKeyCandidates,
  extractJSON,
  getStructuredModel,
};
