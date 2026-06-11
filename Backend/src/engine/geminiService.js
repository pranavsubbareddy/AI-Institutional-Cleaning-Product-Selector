const { GoogleGenAI } = require('@google/genai');
const { generateRecommendation } = require('./recommendationEngine');

let aiClient = null;

function getAIClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      return null;
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

/**
 * Generate recommendations - tries Gemini AI first, falls back to rule engine
 * @param {Object} params - { institution_type, area_size, surface_types, hygiene_standard, budget }
 */
async function generateRecommendations(params) {
  const client = getAIClient();

  if (client) {
    try {
      console.log('  Using Gemini AI for recommendations...');
      const catalog = getCatalogForPrompt();
      const prompt = buildPrompt(params, catalog);

      const result = await client.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      });

      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        if (parsed.recommendations && parsed.summary) {
          return parsed;
        }
      }
      console.warn('  Gemini response invalid, falling back to rule engine');
    } catch (error) {
      console.warn('  Gemini AI call failed, falling back to rule engine:', error.message);
    }
  } else {
    console.log('  No valid Gemini API key found, using rule-based engine...');
  }

  // Fallback to rule-based engine
  return generateFallbackRecommendations(params);
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

  return `You are a "Ganga Maxx Industrial Chemist and Procurement Auditor" with 20+ years of experience.

Analyze this facility and recommend suitable cleaning products:

=== Facility Details ===
- Institution Type: ${params.institution_type}
- Area Size: ${params.area_size} sq ft
- Surface Types: ${(params.surface_types || []).join(', ')}
- Number of Floors: ${floors}
- Approx. Occupants/Capacity: ${occupants}
- Operating Hours: ${operatingHours}
- Facility Age/Condition: ${facilityAge}
- Current Cleaning Frequency: ${cleaningFreq}

=== Requirements ===
- Hygiene Standard: ${params.hygiene_standard}
- Budget: ${params.budget}

=== Available Equipment ===
${equipment}

=== Product Preferences ===
${preferences}

=== Certifications Required ===
${certifications}

Available Products: ${JSON.stringify(catalog)}

Consider the equipment, preferences, and certifications when recommending products.
Respond with ONLY valid JSON (no markdown, no code fences):
{
  "recommendations": [
    {
      "productId": "string",
      "sku": "string",
      "name": "string",
      "recommended_dilution": "string",
      "estimated_monthly_qty_units": number,
      "calculated_cost": number,
      "usage_guidance": "string",
      "safety_notes": "string"
    }
  ],
  "summary": {
    "grossAggregatedCost": number,
    "financialStatusAlert": "string or null"
  }
}`;
}

function getCatalogForPrompt() {
  return [
    { id: 'prod-gpc-001', sku: 'GPC-5L-001', name: 'Ganga Multi-Purpose Cleaner', price: 180, unit: '5L', surfaces: ['hard_floor', 'tile', 'countertop'] },
    { id: 'prod-dsf-002', sku: 'HDS-5L-002', name: 'Ganga Hospital-Grade Disinfectant', price: 350, unit: '5L', surfaces: ['hard_floor', 'tile', 'stainless_steel'] },
    { id: 'prod-gls-003', sku: 'GLS-5L-003', name: 'Ganga Glass & Surface Shine', price: 220, unit: '5L', surfaces: ['glass', 'mirror', 'stainless_steel'] },
    { id: 'prod-flr-004', sku: 'FLR-5L-004', name: 'Ganga Floor Shine Pro', price: 280, unit: '5L', surfaces: ['hard_floor', 'tile', 'marble'] },
    { id: 'prod-crp-005', sku: 'CRP-5L-005', name: 'Ganga Carpet Fresh', price: 420, unit: '5L', surfaces: ['carpet'] }
  ];
}

function generateFallbackRecommendations(params) {
  const result = generateRecommendation(params);
  const alerts = result.alerts || [];

  return {
    recommendations: result.items.map(item => ({
      productId: item.product_id,
      sku: item.product_id,
      name: item.product_name,
      recommended_dilution: item.dilution_ratio,
      estimated_monthly_qty_units: item.quantity_estimate,
      calculated_cost: item.monthly_cost,
      usage_guidance: item.usage_guidance,
      safety_notes: item.safety_notes
    })),
    summary: {
      grossAggregatedCost: result.total_estimated_cost,
      financialStatusAlert: alerts.length > 0 ? alerts.join('; ') : null
    }
  };
}

module.exports = { generateRecommendations, getAIClient };
