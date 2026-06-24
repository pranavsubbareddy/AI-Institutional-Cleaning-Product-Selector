const { ChatOpenAI } = require('@langchain/openai');
const { z } = require('zod');

// ── Zod schema for structured output ──────────────────────────────────
const RecommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        productId: z.string().describe('Unique product ID'),
        sku: z.string().describe('Product SKU'),
        name: z.string().describe('Product name with brand'),
        category: z.string().optional().default('General').describe('Product category'),
        recommended_dilution: z.string().describe('Dilution ratio or Ready to use'),
        estimated_monthly_qty_units: z.number().describe('Monthly qty in litres/kg'),
        unit_price: z.number().optional().default(0).describe('Price per unit in INR'),
        calculated_cost: z.number().describe('Monthly cost = unit_price x qty'),
        coverage_per_unit: z.number().optional().default(0).describe('Coverage in sq.ft per unit'),
        usage_guidance: z.string().describe('Usage instructions'),
        safety_notes: z.string().describe('Safety precautions'),
        alerts: z.array(z.string()).optional().default([]).describe('Safety/usage alerts (e.g., Requires PPE, Flammable, Corrosive)'),
      })
    )
    .describe('Array of 4-10 recommended products'),
  summary: z.object({
    grossAggregatedCost: z.number().describe('Total monthly cost in INR'),
    financialStatusAlert: z.string().nullable().describe('Budget/financial alert or null'),
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
  const frequency = meta.cleaning_frequency || 'daily';
  const preferences = (meta.preferences || []).join(', ') || 'None';
  const specialReqs = meta.special_requirements || 'None';

  return `You are an expert institutional cleaning consultant for India. Based on the facility details below, recommend 4-8 most suitable cleaning products with correct pricing.

FACILITY: ${instType}
AREA: ${area}
SURFACES: ${surfaces}
HYGIENE: ${hygiene}
BUDGET: ${budget}
OCCUPANTS: ${occupants}
FREQUENCY: ${frequency}
EQUIPMENT: ${equipment}
PREFERENCES: ${preferences}
SPECIAL: ${specialReqs}

Calculate CORRECTLY:
- Quantity: based on area, frequency, and surface type
- Price: realistic Indian market rate for the product type
- Monthly Cost = Unit Price x Quantity (must be exact!)
- Coverage: sq.ft per unit based on product type

Use real Indian brands (e.g., Diversey, Savo, Vim, Lizol, Domex, Colin, Harpic, Mr. Muscle, Pril, Jyothy Labs, Godrej, Cif, Exo).

Products should match the facility type (${instType}), budget (${budget}), hygiene level (${hygiene}), and surfaces (${surfaces}).

IMPORTANT: For each product, generate relevant safety alerts/warnings based on its chemical properties (e.g., "Requires gloves", "Use in ventilated area", "Corrosive", "Flammable", "Avoid skin contact", "Keep sealed when not in use").

Respond ONLY with valid JSON matching this exact schema:
{"recommendations":[{"productId":"","sku":"","name":"","category":"","recommended_dilution":"","estimated_monthly_qty_units":0,"unit_price":0,"calculated_cost":0,"coverage_per_unit":0,"usage_guidance":"","safety_notes":"","alerts":["Alert 1","Alert 2"]}],"summary":{"grossAggregatedCost":0,"financialStatusAlert":null}}`;
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
