const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { queryAll, queryOne, run, safeJsonParse } = require('../database/schema');
const { generateRecommendations } = require('../engine/geminiService');
const { requireAuth } = require('../middleware/auth');

// All recommendation routes require authentication
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Allowed enums for validation
// ---------------------------------------------------------------------------
const ALLOWED_INSTITUTION_TYPES = [
  'hospital', 'school', 'hotel', 'office', 'restaurant', 'factory', 'warehouse', 'retail',
  'gym', 'laboratory', 'pharmacy', 'airport', 'shopping_mall', 'cinema', 'library', 'community_center'
];
const ALLOWED_HYGIENE_STANDARDS = ['basic', 'standard', 'high', 'medical_grade'];
const ALLOWED_BUDGETS = ['low', 'medium', 'high'];
const ALLOWED_SURFACE_TYPES = [
  'hard_floor', 'carpet', 'glass', 'tile', 'stainless_steel', 'wood',
  'marble', 'countertop', 'porcelain', 'mirror', 'drain', 'air'
];

// ---------------------------------------------------------------------------
// Validation chain for direct body submission (new flow)
// ---------------------------------------------------------------------------
const validateProcessBody = [
  body('institutionType')
    .optional()
    .trim()
    .isIn(ALLOWED_INSTITUTION_TYPES)
    .withMessage(`Must be one of: ${ALLOWED_INSTITUTION_TYPES.join(', ')}`),

  body('areaSize')
    .optional()
    .isInt({ min: 100 }).withMessage('areaSize must be an integer >= 100'),

  body('surfaceTypes')
    .optional()
    .isArray({ min: 1 }).withMessage('surfaceTypes must be a non-empty array')
    .custom((arr) => {
      for (const s of arr) {
        if (!ALLOWED_SURFACE_TYPES.includes(s)) {
          throw new Error(`Invalid surface type "${s}". Allowed: ${ALLOWED_SURFACE_TYPES.join(', ')}`);
        }
      }
      return true;
    }),

  body('hygieneStandard')
    .optional()
    .trim()
    .isIn(ALLOWED_HYGIENE_STANDARDS)
    .withMessage(`Must be one of: ${ALLOWED_HYGIENE_STANDARDS.join(', ')}`),

  body('budget')
    .optional()
    .trim()
    .isIn(ALLOWED_BUDGETS)
    .withMessage(`Must be one of: ${ALLOWED_BUDGETS.join(', ')}`),

  body('institutionId')
    .optional()
    .isUUID().withMessage('institutionId must be a valid UUID'),

  body('facilityName').optional().trim(),
  body('contactName').optional().trim(),
  body('contactEmail').optional().isEmail().withMessage('contactEmail must be valid email'),
];

// ---------------------------------------------------------------------------
// Helper: ensure a product exists in the products table before creating
// recommendation_items that reference it. This avoids FK constraint failures
// when AI generates dynamic product IDs that don't exist yet.
// ---------------------------------------------------------------------------
async function ensureProductExists(productId, productSku, productData = {}) {
  // Check if already exists by id or sku
  let existing = null;
  if (productId) {
    existing = await queryOne('SELECT id FROM products WHERE id = ?', [productId]);
  }
  if (!existing && productSku) {
    existing = await queryOne('SELECT id FROM products WHERE sku = ?', [productSku]);
  }

  if (existing) {
    return existing.id;
  }

  // Insert the product dynamically
  const finalId = productId || uuidv4();
  const name = productData.name || productData.product_name || 'AI-Generated Product';
  const category = productData.category || 'General';
  const unitPrice = productData.unit_price || 0;
  const unit = productData.unit || 'litre';
  const dilutionRatio = productData.dilution_ratio || productData.recommended_dilution || null;
  const coveragePerUnit = productData.coverage_per_unit || 0;
  const usageGuidance = productData.usage_guidance || null;
  const safetyNotes = productData.safety_notes || null;

  try {
    await run(
      `INSERT INTO products (id, sku, name, description, category, surface_types, dilution_ratio, unit, unit_price, coverage_per_unit, safety_notes, usage_guidance, hygiene_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalId, productSku || finalId, name,
        `${category} cleaning product - AI generated`,
        category, '[]', dilutionRatio,
        unit, Number(unitPrice), Number(coveragePerUnit),
        safetyNotes, usageGuidance, 'standard'
      ]
    );
    console.log(`  [DB] Dynamically inserted product "${name}" with id=${finalId}`);
  } catch (insertErr) {
    // Race condition or duplicate — check if it was inserted by another request
    const retry = await queryOne('SELECT id FROM products WHERE id = ? OR sku = ?', [finalId, productSku || finalId]);
    if (retry) {
      return retry.id;
    }
    throw insertErr;
  }
  return finalId;
}

// ---------------------------------------------------------------------------
// POST /api/recommendations/process
// Supports TWO modes:
//   1. Direct form submission: { institutionType, areaSize, surfaceTypes, ... }
//   2. Institution ID:          { institutionId: "uuid" } (legacy / backward compat)
// ---------------------------------------------------------------------------
router.post('/process', validateProcessBody, async (req, res, next) => {
  try {
    // Check express-validator errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error('Validation failed');
      err.type = 'validation';
      err.errors = errors.array().map(e => ({ field: e.path, message: e.msg }));
      return next(err);
    }

    const { institutionId, institutionType, areaSize, surfaceTypes, hygieneStandard, budget, facilityName, contactName, contactEmail } = req.body;

    let institution;

    // --- MODE 1: Institution ID provided (backward compatible) ---
    if (institutionId) {
      institution = await queryOne('SELECT * FROM institutions WHERE id = ? AND user_id = ?', [institutionId, req.user.uid]);
      if (!institution) {
        return res.status(404).json({
          success: false,
          error: 'Institution not found',
          timestamp: new Date().toISOString()
        });
      }
      institution.surface_types = safeJsonParse(institution.surface_types, []);
      institution.metadata = safeJsonParse(institution.metadata, null);
    }
    // --- MODE 2: Direct form submission (new flow) ---
    else if (institutionType && areaSize && surfaceTypes) {
      const newId = uuidv4();
      const instName = facilityName || `${institutionType}-${Date.now()}`;

      await run(
        `INSERT INTO institutions (id, name, institution_type, area_size, surface_types, hygiene_standard, budget, contact_name, contact_email, status, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [
          newId, instName, institutionType, Number(areaSize),
          JSON.stringify(surfaceTypes), hygieneStandard || 'standard',
          budget || 'medium', contactName || null, contactEmail || null, req.user.uid
        ]
      );

      institution = await queryOne('SELECT * FROM institutions WHERE id = ?', [newId]);
      institution.surface_types = safeJsonParse(institution.surface_types, []);
    }
    // --- No valid input ---
    else {
      return res.status(400).json({
        success: false,
        error: 'Provide either institutionId (UUID) or facility details (institutionType, areaSize, surfaceTypes)',
        timestamp: new Date().toISOString()
      });
    }

    // --- Try the live AI engine first (LangChain OpenAI / Gemini) ---
    let aiResult = null;
    let aiError = null;
    try {
      aiResult = await generateRecommendations(institution);
    } catch (err) {
      aiError = err;
      console.warn('  [recs] AI engine threw:', err.message);
    }

    if (!aiResult || !aiResult.recommendations || aiResult.recommendations.length === 0) {
      // No local/default fallback — the user wants AI-only recommendations.
      console.warn('  [recs] AI engine returned no recommendations. Surfacing 503.');
      const detail = aiError ? aiError.message : 'AI engine returned no recommendations.';
      return res.status(503).json({
        success: false,
        error: 'AI Engine is unavailable. The Groq API key was exhausted or rate-limited. Please add more API keys or try again later.',
        detail,
        timestamp: new Date().toISOString()
      });
    }

    // --- Save recommendation record ---
    const recId = uuidv4();
    const alerts = aiResult.summary?.financialStatusAlert
      ? [aiResult.summary.financialStatusAlert]
      : [];

    const totalMonthlyQty = aiResult.recommendations.reduce(
      (sum, r) => sum + (r.estimated_monthly_qty_units || 0), 0
    );

    // Compute total from sum of individual item costs (more reliable than AI's summary total)
    const computedTotalCost = aiResult.recommendations.reduce(
      (sum, r) => sum + (r.calculated_cost || 0), 0
    );
    // Use computed total as the authoritative value (AI's grossAggregatedCost may be inconsistent)
    const totalEstCost = computedTotalCost > 0 ? computedTotalCost : (aiResult.summary?.grossAggregatedCost || 0);

    const summary = `Recommended ${aiResult.recommendations.length} products for ${institution.institution_type} facility of ${institution.area_size} sq. ft. ` +
      `Monthly cost: Rs ${totalEstCost.toLocaleString('en-IN')}.`;

    await run(
      `INSERT INTO recommendations (id, institution_id, status, total_estimated_cost, monthly_total_quantity, summary, alerts, source, owner, processed_at)
       VALUES (?, ?, 'Processed', ?, ?, ?, ?, ?, 'system', NOW())`,
      [
        recId, institution.id,
        totalEstCost,
        totalMonthlyQty, summary,
        JSON.stringify(alerts),
        'AI_Engine'
      ]
    );

    // --- Save recommendation line items ---
    // Ensure all AI-generated products exist in the products table (FK requirement)
    // then insert recommendation items
    // Use Promise.all to insert all recommendation items in parallel
    await Promise.all(aiResult.recommendations.map(async (item) => {
      const lineId = uuidv4();
      const pid = item.productId || item.product_id || '';
      const sku = item.sku || '';
      // Compute unit_price: prefer AI's unit_price, fallback to calculated_cost/qty, then 0
      const aiUnitPrice = item.unit_price
        || (item.estimated_monthly_qty_units > 0
          ? Math.round((item.calculated_cost || 0) / item.estimated_monthly_qty_units)
          : 0);
      const productId = await ensureProductExists(
        pid || null,
        sku || null,
        {
          name: item.name,
          category: item.category,
          unit_price: aiUnitPrice,
          unit: 'litre',
          dilution_ratio: item.recommended_dilution,
          coverage_per_unit: item.coverage_per_unit || 0,
          usage_guidance: item.usage_guidance,
          safety_notes: item.safety_notes
        }
      );
      await run(
        `INSERT INTO recommendation_items
         (id, recommendation_id, product_id, product_name, quantity_estimate, dilution_ratio,
          monthly_cost, unit_price, usage_frequency, priority, usage_guidance, safety_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Monthly', ?, ?, ?)`,
        [
          lineId, recId, productId,
          item.name || 'AI-Generated Product',
          item.estimated_monthly_qty_units, item.recommended_dilution,
          item.calculated_cost, aiUnitPrice, 1,
          item.usage_guidance || null,
          item.safety_notes || null
        ]
      );
    }));

    // Build aiResult lookups by SKU for robust fallback matching
    const aiResultBySku = {};
    aiResult.recommendations.forEach(r => {
      const pid = r.productId || r.product_id || r.sku || '';
      if (pid) aiResultBySku[pid] = r;
    });

    // --- Return response ---
    const [recommendation, dbItems] = await Promise.all([
      queryOne('SELECT * FROM recommendations WHERE id = ?', [recId]),
      queryAll(
        'SELECT * FROM recommendation_items WHERE recommendation_id = ? ORDER BY priority ASC',
        [recId]
      )
    ]);

    // Fetch product details separately (avoids JOIN — works in in-memory mode)
    let items = dbItems;
    if (items.length > 0) {
      const productIds = [...new Set(items.map(item => item.product_id).filter(Boolean))];
      const productMap = {};
      for (const pid of productIds) {
        const product = await queryOne('SELECT * FROM products WHERE id = ?', [pid]);
        if (product) productMap[pid] = product;
      }
      items = items.map(item => {
        const product = productMap[item.product_id];
        return {
          ...item,
          product_name: item.product_name || product?.name || 'AI-Generated Product',
          category: product?.category || null,
          unit: product?.unit || 'litre',
          coverage_per_unit: product?.coverage_per_unit || 0,
          unit_price: item.unit_price || product?.unit_price || 0,
          base_price: product?.unit_price || item.unit_price || 0
        };
      });
    }

    // If DB items have null product_name (because product_id was a SKU string),
    // fill in from the Gemini output — matched by SKU, not by index
    const responseItems = items.length > 0
      ? items.map(dbItem => {
          const aiMatch = aiResultBySku[dbItem.product_id];
          // Compute unit_price: prefer DB product price, fallback to AI match, then 0
          const itemUnitPrice = dbItem.unit_price
            || aiMatch?.unit_price
            || (dbItem.quantity_estimate > 0
              ? Math.round((dbItem.monthly_cost || 0) / dbItem.quantity_estimate)
              : 0);
          return {
            ...dbItem,
            unit_price: itemUnitPrice,
            base_price: dbItem.base_price || itemUnitPrice,
            product_name: dbItem.product_name
              || aiMatch?.name
              || 'Unknown Product',
            usage_guidance: dbItem.usage_guidance
              || aiMatch?.usage_guidance
              || null,
            safety_notes: dbItem.safety_notes
              || aiMatch?.safety_notes
              || null
          };
        })
      : aiResult.recommendations.map(r => ({
          product_name: r.name,
          product_id: r.productId || r.sku,
          quantity_estimate: r.estimated_monthly_qty_units,
          dilution_ratio: r.recommended_dilution,
          monthly_cost: r.calculated_cost,
          unit_price: r.unit_price || (r.estimated_monthly_qty_units > 0 ? Math.round(r.calculated_cost / r.estimated_monthly_qty_units) : 0),
          coverage_per_unit: r.coverage_per_unit || 0,
          usage_guidance: r.usage_guidance,
          safety_notes: r.safety_notes
        }));

    res.status(201).json({
      success: true,
      message: 'Recommendation processed successfully',
      data: {
        recommendation: {
          ...recommendation,
          alerts: safeJsonParse(recommendation?.alerts, []),
      source: 'AI_Engine',
      status: 'Processed',
      owner: 'system',
      processed_at: new Date().toISOString()
    },
    items: responseItems,
    institution_id: institution.id,
    institution_name: institution.name,
    summary,
    source: 'AI_Engine',
    isFallback: false,
    grossAggregatedCost: totalEstCost,
    financialStatusAlert: aiResult.summary?.financialStatusAlert || null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/recommendations — list recommendations for this user
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Get user's institution IDs first (avoids JOIN)
    const userInstitutions = await queryAll('SELECT id, name, institution_type FROM institutions WHERE user_id = ?', [req.user.uid]);
    const userInstIds = userInstitutions.map(i => i.id);
    const instMap = {};
    userInstitutions.forEach(i => { instMap[i.id] = { institution_name: i.name, institution_type: i.institution_type }; });

    if (userInstIds.length === 0) {
      return res.json({
        success: true,
        count: 0,
        total: 0,
        page: Number(page),
        totalPages: 0,
        data: [],
        timestamp: new Date().toISOString()
      });
    }

    // Build placeholders for IN clause
    const placeholders = userInstIds.map(() => '?').join(',');
    const countSql = `SELECT COUNT(*) as total FROM recommendations WHERE institution_id IN (${placeholders})` +
      (status ? ' AND status = ?' : '');
    const countParams = status ? [...userInstIds, status] : [...userInstIds];
    const countResult = await queryAll(countSql, countParams);
    const total = countResult[0]?.total || 0;

    const dataSql = `SELECT * FROM recommendations WHERE institution_id IN (${placeholders})` +
      (status ? ' AND status = ?' : '') +
      ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const dataParams = status
      ? [...userInstIds, status, Number(limit), offset]
      : [...userInstIds, Number(limit), offset];
    const recommendations = await queryAll(dataSql, dataParams);

    // Attach institution name/type from the instMap
    const parsed = recommendations.map(r => ({
      ...r,
      ...(instMap[r.institution_id] || {}),
      alerts: safeJsonParse(r.alerts, [])
    }));

    res.json({
      success: true,
      count: parsed.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data: parsed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/recommendations/:id — fetch single recommendation detail
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    // Step 1: Fetch the recommendation by ID (simple query, no JOIN)
    const recommendation = await queryOne(
      `SELECT * FROM recommendations WHERE id = ?`,
      [req.params.id]
    );

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found',
        timestamp: new Date().toISOString()
      });
    }

    // Step 2: Fetch the associated institution to verify ownership AND get institution fields
    const institution = await queryOne(
      'SELECT * FROM institutions WHERE id = ? AND user_id = ?',
      [recommendation.institution_id, req.user.uid]
    );

    if (!institution) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found',
        timestamp: new Date().toISOString()
      });
    }

    // Step 3: Merge institution fields into the recommendation
    recommendation.institution_name = institution.name;
    recommendation.institution_type = institution.institution_type;
    recommendation.area_size = institution.area_size;
    recommendation.hygiene_standard = institution.hygiene_standard;
    recommendation.budget = institution.budget;
    recommendation.surface_types = institution.surface_types;
    recommendation.metadata = safeJsonParse(institution.metadata, null);
    recommendation.contact_email = institution.contact_email;
    recommendation.contact_name = institution.contact_name;

    // Step 4: Fetch recommendation items (with product data via separate queries if needed)
    let items = await queryAll(
      'SELECT * FROM recommendation_items WHERE recommendation_id = ? ORDER BY priority ASC',
      [req.params.id]
    );

    // Fetch product details separately for each item (avoids JOIN)
    if (items.length > 0) {
      const productIds = [...new Set(items.map(item => item.product_id).filter(Boolean))];
      const productMap = {};
      for (const pid of productIds) {
        const product = await queryOne('SELECT * FROM products WHERE id = ?', [pid]);
        if (product) productMap[pid] = product;
      }
      items = items.map(item => {
        const product = productMap[item.product_id];
        // Compute unit_price: prefer product table price, fallback to stored item price, then monthly_cost/qty
        const itemUnitPrice = product?.unit_price
          || item.unit_price
          || (item.quantity_estimate > 0
            ? Math.round((item.monthly_cost || 0) / item.quantity_estimate)
            : 0);
        return {
          ...item,
          // Use stored product_name as primary source, fallback to products table, then AI-Generated
          product_name: item.product_name || product?.name || 'AI-Generated Product',
          category: product?.category || null,
          safety_notes: item.safety_notes || product?.safety_notes || null,
          usage_guidance: item.usage_guidance || product?.usage_guidance || null,
          unit: product?.unit || 'litre',
          coverage_per_unit: product?.coverage_per_unit || 0,
          unit_price: itemUnitPrice,
          base_price: product?.unit_price || itemUnitPrice
        };
      });
    }

    // Compute total from sum of item monthly_costs (more reliable than stored total)
    const computedTotal = items.reduce(
      (sum, item) => sum + Number(item.monthly_cost || 0), 0
    );

    res.json({
      success: true,
      data: {
        ...recommendation,
        total_estimated_cost: computedTotal > 0 ? computedTotal : recommendation.total_estimated_cost,
        alerts: safeJsonParse(recommendation.alerts, []),
        surface_types: safeJsonParse(recommendation.surface_types, []),
        items
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
