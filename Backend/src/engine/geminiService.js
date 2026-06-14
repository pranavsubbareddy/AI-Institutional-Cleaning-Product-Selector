const { ChatOpenAI } = require('@langchain/openai');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
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
    .describe('Array of recommended products — all that are relevant'),
  summary: z.object({
    grossAggregatedCost: z.number().describe('Total monthly cost of all recommended products in INR'),
    financialStatusAlert: z.string().nullable().describe('Budget/financial alert message or null'),
  }),
});

// ── Key validation ────────────────────────────────────────────────────
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

// ── Key discovery ─────────────────────────────────────────────────────
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

  // Accept Gemini env names only when the value is clearly an OpenAI key
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

// ── Model cache ───────────────────────────────────────────────────────
const modelCache = new Map();

function getStructuredModel(key, provider) {
  const cacheKey = `${provider}:${key}`;
  if (modelCache.has(cacheKey)) return modelCache.get(cacheKey);

  let model;
  if (provider === 'openai') {
    const chatModel = new ChatOpenAI({
      apiKey: key,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 4096,
    });
    model = chatModel.withStructuredOutput(RecommendationSchema, {
      name: 'recommendation',
    });
  } else {
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const chatModel = new ChatGoogleGenerativeAI({
      apiKey: key,
      model: geminiModel,
      temperature: 0.3,
      maxOutputTokens: 8192,
    });
    model = chatModel.withStructuredOutput(RecommendationSchema, {
      name: 'recommendation',
    });
  }

  modelCache.set(cacheKey, model);
  return model;
}

/**
 * Generate recommendations using LangChain (OpenAI or Gemini).
 * Returns null if no API key is configured or all providers fail.
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

  // Try OpenAI keys first
  if (apiKeys.length > 0) {
    console.log(`  Using LangChain OpenAI with ${apiKeys.length} configured key(s)...`);
    console.log('  OpenAI model:', process.env.OPENAI_MODEL || 'gpt-4o-mini');

    for (let index = 0; index < apiKeys.length; index += 1) {
      try {
        console.log(`  Trying OpenAI API key ${index + 1}/${apiKeys.length}...`);
        const structuredModel = getStructuredModel(apiKeys[index], 'openai');
        const result = await structuredModel.invoke(prompt);

        if (result && result.recommendations && result.recommendations.length > 0 && result.summary) {
          console.log('  OpenAI success —', result.recommendations.length, 'products recommended');
          return result;
        }

        console.warn('  OpenAI returned invalid/malformed response.');
      } catch (error) {
        const status = error.status || error.code || 'unknown';
        if (status === 429) {
          console.warn(`  ⛔ RATE LIMIT on OpenAI key ${index + 1}/${apiKeys.length}. Rotating to next key...`);
        } else {
          console.warn(`  OpenAI key ${index + 1}/${apiKeys.length} failed (${status}):`, error.message);
        }
      }
    }
  }

  // Fallback to Gemini keys
  if (geminiKeys.length > 0) {
    console.log(`  Using LangChain Gemini with ${geminiKeys.length} configured key(s)...`);
    console.log('  Gemini model:', process.env.GEMINI_MODEL || 'gemini-2.0-flash');

    for (let index = 0; index < geminiKeys.length; index += 1) {
      try {
        console.log(`  Trying Gemini API key ${index + 1}/${geminiKeys.length}...`);
        const structuredModel = getStructuredModel(geminiKeys[index], 'gemini');
        const result = await structuredModel.invoke(prompt);

        if (result && result.recommendations && result.recommendations.length > 0 && result.summary) {
          console.log('  Gemini success —', result.recommendations.length, 'products recommended');
          return result;
        }

        console.warn('  Gemini returned invalid/malformed response.');
      } catch (error) {
        const status = error.status || error.code || 'unknown';
        if (status === 429) {
          console.warn(`  ⛔ RATE LIMIT on Gemini key ${index + 1}/${geminiKeys.length}. Rotating to next key...`);
        } else {
          console.warn(`  Gemini key ${index + 1}/${geminiKeys.length} failed (${status}):`, error.message);
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

  return `You are a cleaning product procurement expert. Based on the request below, recommend specific cleaning products with real brand names and realistic Indian market prices.

REQUEST TYPE: ${instType}
AREA: ${area}
SURFACES: ${surfaces}
HYGIENE LEVEL: ${hygiene}
BUDGET LEVEL: ${budget}

For each product provide:
- productId: unique ID (e.g., REC-001)
- sku: realistic SKU
- name: specific product name with brand (use real brands like Diversey, SC Johnson, 3M, Ecolab, savo, Vim, Lizol, Domex, Colin, or other professional/retail brands available in India)
- recommended_dilution: exact water+product mix (e.g., "Mix 50ml per 1 litre water") or "Ready to use" if no dilution needed
- estimated_monthly_qty_units: realistic monthly usage for given area/size
- calculated_cost: monthly cost in INR
- usage_guidance: clear step-by-step use instructions
- safety_notes: important safety information

Recommend ALL relevant products — no limit. Use your knowledge of real products.

Respond ONLY with valid JSON:
{"recommendations":[{"productId":"","sku":"","name":"","recommended_dilution":"","estimated_monthly_qty_units":0,"calculated_cost":0,"usage_guidance":"","safety_notes":""}],"summary":{"grossAggregatedCost":0,"financialStatusAlert":null}}`;
}

function getCatalogForPrompt() {
  // No hardcoded catalog — the AI generates products from its own knowledge
  return [];
}

module.exports = {
  generateRecommendations,
  getOpenAIKeyCandidates,
  getGeminiKeyCandidates,
  extractJSON,
  getStructuredModel,
};
