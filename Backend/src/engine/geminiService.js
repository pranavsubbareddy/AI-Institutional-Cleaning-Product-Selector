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
      maxTokens: 4000,
      timeout: 15000,
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
 * @param {Array} [products=[]] - Optional array of existing products from DB for the AI to reference
 * @returns {Object|null} { recommendations: [...], summary: {...} } or null
 */
async function generateRecommendations(params, products = []) {
  const groqKeys = getGroqKeyCandidates();

  if (groqKeys.length === 0) {
    console.log('  No valid Groq API key found. Returning null — AI-only recommendation route will return 503.');
    return null;
  }

  const catalogStr = formatCatalogForPrompt(products);
  const prompt = buildPrompt(params, catalogStr);

  console.log(`  Using LangChain Groq with ${groqKeys.length} configured key(s)...`);
  console.log('  Groq model:', process.env.GROQ_MODEL || 'llama-3.3-70b-versatile');
  if (products.length > 0) {
    console.log(`  Including ${products.length} existing product(s) as catalog reference`);
  }

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
        console.warn(`  \u26d4 TIMEOUT on Groq key ${index + 1}/${groqKeys.length}. Moving to next key...`);
      } else {
        const status = error.status || error.code || 'unknown';
        if (status === 429) {
          console.warn(`  \u26d4 RATE LIMIT on Groq key ${index + 1}/${groqKeys.length}. Rotating to next key...`);
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
  const firstBrace = cleaned.search(/[\{\[]/);
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
      // Other unescaped control characters (U+0000\u2013U+001F) are invalid inside
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

/**
 * Format the product catalog into a readable table string for the AI prompt.
 * @param {Array} products - Array of product objects from the database
 * @returns {string} Formatted product catalog string
 */
function formatCatalogForPrompt(products) {
  if (!products || products.length === 0) {
    return '  No catalog products available. Generate products from your knowledge of Indian cleaning brands.';
  }

  const rows = products.map(p => {
    const price = p.unit_price || 0;
    const coverage = p.coverage_per_unit || 0;
    const dilution = p.dilution_ratio || '-';
    const cat = p.category || 'General';
    const name = p.name || 'Unknown';
    return `  - ${name} (SKU: ${p.sku || p.id}) | Category: ${cat} | Unit Price: Rs ${price} | Coverage: ${coverage} sq.ft/unit | Dilution: ${dilution}`;
  }).join('\n');

  return `Available Catalog Products (reference for pricing & product types):\n${rows}\n\nYou may reference these products by SKU/ID. You can also recommend other real Indian brands not in this list.`;
}

/**
 * Build a comprehensive prompt for the AI to generate cleaning product recommendations.
 * @param {Object} params - Facility parameters
 * @param {string} catalogStr - Formatted product catalog string
 * @returns {string} The complete prompt
 */
function buildPrompt(params, catalogStr) {
  const meta = params.metadata || {};
  const equipment = (meta.equipment || []).join(', ') || 'None';
  const area = params.area_size ? Number(params.area_size) : 0;
  const areaStr = area > 0 ? `${area.toLocaleString('en-IN')} sq ft` : 'Unknown';
  const surfaces = (params.surface_types || []).join(', ') || 'Various';
  const hygiene = params.hygiene_standard || 'standard';
  const budget = params.budget || 'medium';
  const instType = params.institution_type || 'Facility';
  const occupants = meta.occupants || 0;
  const frequency = meta.cleaning_frequency || 'daily';
  const floors = meta.floors || 1;
  const operatingHours = meta.operating_hours || 'day';
  const facilityAge = meta.facility_age || 'moderate';
  const preferences = (meta.preferences || []).join(', ') || 'None';
  const specialReqs = meta.special_requirements || 'None';
  const currentProducts = meta.current_products || 'None';
  const facilityDesc = meta.facility_description || 'None';

  // Frequency multiplier for quantity calculations
  const freqMultiplier = { daily: 30, twice_daily: 60, weekly: 4, multiple_weekly: 12, custom: 8 }[frequency] || 30;

  // ── Surface-to-Product mapping guidance ──────────────────────────
  // Each surface type maps to recommended product categories
  const surfaceProductMap = {
    hard_floor: 'Floor Cleaner, Disinfectant, Degreaser',
    tile: 'Floor Cleaner, Tile Cleaner, Disinfectant',
    marble: 'Marble Cleaner, Floor Cleaner (pH-neutral), Disinfectant',
    carpet: 'Carpet Shampoo, Carpet Cleaner, Carpet Deodorizer',
    glass: 'Glass Cleaner, Window Cleaner',
    stainless_steel: 'Stainless Steel Cleaner, Disinfectant Spray',
    wood: 'Wood Floor Cleaner, Furniture Polish, Disinfectant Spray',
    countertop: 'Multi-Surface Cleaner, Disinfectant Spray, Glass Cleaner',
    porcelain: 'Porcelain Cleaner, Toilet Bowl Cleaner, Disinfectant',
    mirror: 'Glass Cleaner, Mirror Cleaner',
    drain: 'Drain Cleaner, Drain Deodorizer',
    air: 'Air Freshener, Odor Eliminator, Disinfectant Spray'
  };

  const surfaceGuides = surfaces.split(', ').map(s => {
    const trimmed = s.trim().toLowerCase();
    const products = surfaceProductMap[trimmed] || 'General Cleaner';
    return `  - ${trimmed}: ${products}`;
  }).join('\n');

  // ── Facility-type-specific guidance ──────────────────────────────
  const facilityTypeGuides = {
    hospital: 'PRIORITIZE: medical-grade disinfectants, hand sanitizers, surface sterilizers, floor disinfectants. HIGH hygiene requirement. Include broad-spectrum disinfectants and anti-bacterial cleaners.',
    school: 'PRIORITIZE: all-purpose cleaners, hand soaps, surface disinfectants, floor cleaners. BALANCE effectiveness with safety around children. Include fragrance-free options.',
    hotel: 'PRIORITIZE: glass cleaners, air fresheners, multi-surface cleaners, carpet shampoos, bathroom cleaners. EMPHASIZE pleasant fragrances and presentable finishes.',
    office: 'PRIORITIZE: floor cleaners, disinfectant sprays, glass cleaners, multi-surface wipes. FOCUS on cost-effective, daily-use products for large open spaces.',
    restaurant: 'PRIORITIZE: kitchen degreasers, floor cleaners, surface disinfectants, stainless steel cleaners. FOOD-SAFE products essential. Include heavy-duty kitchen cleaning.',
    factory: 'PRIORITIZE: industrial degreasers, heavy-duty floor cleaners, hand cleaners, industrial-strength disinfectants. HIGH-STRENGTH formulations needed for grease and grime.',
    warehouse: 'PRIORITIZE: industrial floor cleaners, degreasers, dust control products. LARGE-VOLUME, cost-effective concentrated products preferred.',
    retail: 'PRIORITIZE: floor cleaners (high foot traffic), glass cleaners, multi-surface cleaners, air fresheners. APPEARANCE-focused products for customer-facing areas.',
    gym: 'PRIORITIZE: disinfectant sprays, floor cleaners, equipment wipes, odor eliminators, hand sanitizers. ANTI-BACTERIAL focus on shared equipment surfaces.',
    laboratory: 'PRIORITIZE: laboratory-grade disinfectants, surface sterilizers, glass cleaners. PRECISION cleaning products that leave no residue. High hygiene standard.',
    pharmacy: 'PRIORITIZE: surface disinfectants, glass cleaners, floor cleaners. PHARMACEUTICAL-GRADE cleanliness. Gentle but effective products.',
    airport: 'PRIORITIZE: heavy-duty floor cleaners (vast areas), glass cleaners (large windows), carpet cleaners, multi-surface disinfectants. HIGH-VOLUME, industrial-grade products for 24x7 operation.',
    shopping_mall: 'PRIORITIZE: floor cleaners (high traffic), glass cleaners (storefronts), multi-surface cleaners, restroom cleaners, air fresheners. LARGE-QUANTITY bulk products.',
    cinema: 'PRIORITIZE: carpet cleaners & shampoos, floor cleaners, air fresheners, restroom cleaners. DARK-SPACE cleaning. Focus on carpet care and odor control.',
    library: 'PRIORITIZE: gentle floor cleaners, dust control products, wood cleaners (shelving), air purifiers. QUIET-OPERATION products. Avoid strong fragrances.',
    community_center: 'PRIORITIZE: multi-purpose cleaners, floor cleaners, disinfectants, restroom cleaners. VERSATILE products for varied event spaces.',
  };
  const typeGuide = facilityTypeGuides[instType] || 'PRIORITIZE: general cleaning products suitable for the facility surfaces and hygiene requirements.';

  // ── Pricing tiers per budget level ───────────────────────────────
  const budgetGuides = {
    low: 'Low budget: Use economical brands (Harpic, Lizol, local brands). Target unit prices Rs 50\u2013200/litre. Recommend concentrated products that can be diluted further. Minimize total products to 4\u20136 essentials.',
    medium: 'Medium budget: Mix of value and premium brands (Colin, Domex, Savo, Vim). Target unit prices Rs 150\u2013500/litre. Balance cost with quality. Recommend 5\u20138 products.',
    high: 'High budget: Premium brands (Diversey, Godrej, Jyothy Labs professional range). Target unit prices Rs 300\u2013900/litre. Include specialized products for each surface type. Recommend 6\u201310 products with professional-grade formulations.',
  };
  const budgetGuide = budgetGuides[budget] || budgetGuides.medium;

  // ── Operating hours adjustment ───────────────────────────────────
  const hoursDesc = {
    '24x7': 'This facility operates 24/7 so cleaning must be scheduled during low-traffic periods. Products with quick drying times and low odor are preferred.',
    'day': 'Daytime operation (6AM\u20136PM). Cleaning likely done after hours. Standard products work well.',
    'night': 'Nighttime operation (6PM\u20136AM). Similar to daytime, cleaning in off-hours.',
    'business': 'Business hours (9\u20135). Cleaning before/after hours. Standard commercial products.',
  };
  const hoursGuidance = hoursDesc[operatingHours] || 'Standard operating hours assumed.';

  // ── Facility age impact ──────────────────────────────────────────
  const ageDesc = {
    new: 'New facility. Focus on maintenance cleaning products. Gentle pH-neutral cleaners recommended to preserve modern surfaces.',
    moderate: 'Moderate age. Standard cleaning products suitable for all surfaces.',
    old: 'Older facility. May require stronger formulations for aged, porous surfaces. Include descaling products for mineral buildup.',
    vintage: 'Vintage facility. Specialized gentle cleaners for delicate/antique surfaces. Avoid acidic or abrasive products.',
  };
  const ageGuidance = ageDesc[facilityAge] || 'Standard cleaning products suitable.';

  // ── Equipment compatibility ──────────────────────────────────────
  const equipmentStr = equipment !== 'None'
    ? `Available equipment: ${equipment}. Recommend products compatible with these tools (e.g., scrubber-compatible floor cleaners, carpet extractor-compatible shampoos, microfiber-safe sprays).`
    : 'No specialized equipment available. Recommend manual-application products (mop-ready, spray-and-wipe).';

  // ── Quantity calculation formulas ─────────────────────────────────
  let qtyCalcGuide = '';
  if (area > 0) {
    // For each surface type, suggest a base coverage and compute qty
    qtyCalcGuide = 'QUANTITY CALCULATION (follow these formulas):\n';
    const surfaceCount = (params.surface_types || []).length;
    if (surfaceCount > 0) {
      const areaPerSurface = Math.round(area / surfaceCount);
      qtyCalcGuide += `  Total area: ${areaStr}\n`;
      qtyCalcGuide += `  Estimated area per surface type: ~${areaPerSurface.toLocaleString('en-IN')} sq.ft (divided across ${surfaceCount} surface types)\n`;
      qtyCalcGuide += `  Cleaning frequency: ${frequency} (${freqMultiplier}x per month)\n`;
      qtyCalcGuide += `  Formula: Quantity = (Area assigned to this surface / Coverage per unit of product) x Frequency multiplier\n`;
      qtyCalcGuide += `  Example for a product covering 500 sq.ft/unit, cleaning daily: ${areaPerSurface.toLocaleString('en-IN')} / 500 x ${freqMultiplier} = ${Math.round(areaPerSurface / 500 * freqMultiplier)} units/month\n`;
      qtyCalcGuide += `  For ready-to-use (RTU) products: Estimate 1 litre covers approximately 200-300 applications per sq.ft area\n`;
      qtyCalcGuide += `  For concentrates: Account for dilution. E.g., 1:10 ratio means 1 litre concentrate = 10 litres of cleaning solution\n`;
    }
  } else {
    qtyCalcGuide = 'QUANTITY CALCULATION: Area unknown. Estimate quantities based on facility type and typical usage patterns.';
  }

  // ── Preference-based adjustments ─────────────────────────────────
  const prefLower = preferences.toLowerCase();
  let prefGuide = '';
  if (prefLower.includes('eco')) prefGuide += '  - ECO-FRIENDLY: Recommend biodegradable, plant-based formulations with minimal environmental impact.\n';
  if (prefLower.includes('fragrance')) prefGuide += '  - FRAGRANCE-FREE: All recommended products must be unscented or fragrance-free.\n';
  if (prefLower.includes('hypoallergenic')) prefGuide += '  - HYPOALLERGENIC: Recommend products labeled as hypoallergenic, gentle on skin and respiratory system.\n';
  if (prefLower.includes('concentrated')) prefGuide += '  - CONCENTRATED: Prioritize concentrated products that can be diluted, reducing storage and transport costs.\n';
  if (prefLower.includes('ready')) prefGuide += '  - READY-TO-USE: Include some RTU products for quick daily cleaning tasks.\n';
  if (prefLower.includes('industrial')) prefGuide += '  - INDUSTRIAL GRADE: Recommend professional-strength, heavy-duty formulations.\n';

  // ── Safety alerts by chemical type ───────────────────────────────
  const safetyGuide = `SAFETY ALERTS (assign based on product chemistry):
  - Acidic cleaners (HCl, phosphoric): "Corrosive", "Requires gloves", "Use in ventilated area"
  - Bleach/chlorine based: "Corrosive", "Requires gloves", "Avoid mixing with other chemicals", "Use in ventilated area"
  - Quaternary ammonium: "Requires gloves", "Avoid skin contact", "Keep sealed when not in use"
  - Solvent-based: "Flammable", "Use in ventilated area", "Requires gloves"
  - Enzymatic: "Keep sealed when not in use", "Avoid skin contact"
  - pH-neutral: "Requires gloves" (only if concentrated), "Keep sealed when not in use"
  - Fragrance oils: "Avoid skin contact", "Keep sealed when not in use"`;

  // ── Brand-to-category reference ──────────────────────────────────
  const brandGuide = `INDIAN CLEANING BRANDS BY CATEGORY (use real Indian market brands):
  - Floor Cleaners: Diversey, Jyothy Labs, Godrej, Cif, Pril
  - Glass Cleaners: Savo, Colin, Godrej
  - Disinfectants: Vim, Domex, Dettol, Lizol, Savlon
  - Carpet Cleaners: Colin, Rug Doctor (available in India)
  - Toilet Cleaners: Harpic, Lizol, Domex
  - Air Fresheners: Godrej aer, Odonil, Ambi Pur
  - Kitchen Cleaners: Vim, Pril, Exo
  - Multi-Surface: Mr. Muscle, Cif, Godrej`;

  // ── Assemble the complete prompt ─────────────────────────────────
  return `You are an expert institutional cleaning consultant for India. Your task is to recommend the most suitable cleaning products for a facility based on its detailed profile below.

Follow this STEP-BY-STEP REASONING process:
1. ANALYZE the facility type, surfaces, and hygiene requirements
2. MATCH surfaces to appropriate product categories (see Surface-Product Mapping)
3. SELECT specific Indian-brand products with real market prices
4. CALCULATE quantities based on area, frequency, and coverage
5. APPLY budget pricing tier
6. ADD appropriate safety alerts based on product chemistry
7. CONFIRM calculated_cost = unit_price x estimated_monthly_qty_units (must be exact)

═══════════════════════════════════════════
FACILITY PROFILE
═══════════════════════════════════════════

Name: ${params.name || instType}
Type: ${instType}
Total Area: ${areaStr}
Floors: ${floors}
Occupants: ${occupants}
Operating Hours: ${operatingHours}${hoursGuidance ? ' - ' + hoursGuidance : ''}
Facility Age: ${facilityAge}${ageGuidance ? ' - ' + ageGuidance : ''}
Cleaning Frequency: ${frequency} (${freqMultiplier}x cleaning events per month)
Hygiene Standard: ${hygiene}
Budget Level: ${budget}
${facilityDesc !== 'None' ? `Description: ${facilityDesc}` : ''}
${currentProducts !== 'None' ? `Current Products: ${currentProducts}` : ''}
Special Requirements: ${specialReqs}
User Preferences: ${preferences}

═══════════════════════════════════════════
SURFACE-PRODUCT MAPPING
═══════════════════════════════════════════

Each surface in this facility requires specific product categories:
${surfaceGuides}

═══════════════════════════════════════════
FACILITY-TYPE GUIDANCE
═══════════════════════════════════════════

${typeGuide}

═══════════════════════════════════════════
BUDGET & PRICING
═══════════════════════════════════════════

${budgetGuide}

${prefGuide ? `PREFERENCES:\n${prefGuide}` : ''}

═══════════════════════════════════════════
EQUIPMENT COMPATIBILITY
═══════════════════════════════════════════

${equipmentStr}

═══════════════════════════════════════════
QUANTITY CALCULATION
═══════════════════════════════════════════

${qtyCalcGuide}

CRITICAL: Ensure calculated_cost exactly equals unit_price * estimated_monthly_qty_units.
Double-check your multiplication before outputting.

═══════════════════════════════════════════
BRAND REFERENCE
═══════════════════════════════════════════

${brandGuide}

═══════════════════════════════════════════
SAFETY ALERTS
═══════════════════════════════════════════

${safetyGuide}

Each product must have at least 1 safety alert. Most should have 2-3.

═══════════════════════════════════════════
PRODUCT CATALOG
═══════════════════════════════════════════

${catalogStr}

═══════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════

Recommend 4-10 products based on the facility size and needs.
Use REAL Indian brands from the brand reference above.
For usage_guidance: Write clear step-by-step application instructions.
For safety_notes: Include pH level, chemical composition info, and PPE requirements.

VALIDATE your output:
- Each calculated_cost = unit_price x estimated_monthly_qty_units ✓
- Product names include brand (e.g., "Diversey Heavy Duty Floor Cleaner", not generic)
- Quantities are realistic for the facility size
- Prices reflect Indian market rates for the budget tier
- At least 1 safety alert per product
- summary.grossAggregatedCost = sum of all calculated_cost values

Respond ONLY with valid JSON matching this exact schema:
{"recommendations":[{"productId":"","sku":"","name":"","category":"","recommended_dilution":"","estimated_monthly_qty_units":0,"unit_price":0,"calculated_cost":0,"coverage_per_unit":0,"usage_guidance":"","safety_notes":"","alerts":["Alert 1","Alert 2"]}],"summary":{"grossAggregatedCost":0,"financialStatusAlert":null}}`;
}

module.exports = {
  generateRecommendations,
  getGroqKeyCandidates,
  extractJSON,
  getStructuredModel,
};
