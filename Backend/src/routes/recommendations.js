const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { queryAll, queryOne, run } = require('../database/schema');
const { generateRecommendations } = require('../engine/geminiService');
const { MOCK_PRODUCT_CATALOG } = require('../engine/productCatalog');

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
      institution = await queryOne('SELECT * FROM institutions WHERE id = ?', [institutionId]);
      if (!institution) {
        return res.status(404).json({
          success: false,
          error: 'Institution not found',
          timestamp: new Date().toISOString()
        });
      }
      institution.surface_types = JSON.parse(institution.surface_types || '[]');
      institution.metadata = institution.metadata ? JSON.parse(institution.metadata) : null;
    }
    // --- MODE 2: Direct form submission (new flow) ---
    else if (institutionType && areaSize && surfaceTypes) {
      const newId = uuidv4();
      const instName = facilityName || `${institutionType}-${Date.now()}`;

      await run(
        `INSERT INTO institutions (id, name, institution_type, area_size, surface_types, hygiene_standard, budget, contact_name, contact_email, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          newId, instName, institutionType, Number(areaSize),
          JSON.stringify(surfaceTypes), hygieneStandard || 'standard',
          budget || 'medium', contactName || null, contactEmail || null
        ]
      );

      institution = await queryOne('SELECT * FROM institutions WHERE id = ?', [newId]);
      institution.surface_types = JSON.parse(institution.surface_types || '[]');
    }
    // --- No valid input ---
    else {
      return res.status(400).json({
        success: false,
        error: 'Provide either institutionId (UUID) or facility details (institutionType, areaSize, surfaceTypes)',
        timestamp: new Date().toISOString()
      });
    }

    // --- Generate recommendation using AI engine only (no rule-based fallback) ---
    const aiResult = await generateRecommendations(institution);

    if (!aiResult || !aiResult.recommendations || aiResult.recommendations.length === 0) {
      return res.status(503).json({
        success: false,
        error: 'AI Engine is unavailable. Please ensure a valid OpenAI or Gemini API key is configured. Only AI-generated recommendations are supported.',
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

    const summary = `Recommended ${aiResult.recommendations.length} products for ${institution.institution_type} facility of ${institution.area_size} sq. ft. ` +
      `Monthly cost: Rs ${(aiResult.summary?.grossAggregatedCost || 0).toLocaleString('en-IN')}.`;

    await run(
      `INSERT INTO recommendations (id, institution_id, status, total_estimated_cost, monthly_total_quantity, summary, alerts, source, owner, processed_at)
       VALUES (?, ?, 'Processed', ?, ?, ?, ?, ?, 'system', NOW())`,
      [
        recId, institution.id,
        aiResult.summary?.grossAggregatedCost || 0,
        totalMonthlyQty, summary,
        JSON.stringify(alerts),
        'AI_Engine'
      ]
    );

    // --- Save recommendation line items ---
    // Build SKU lookups from DB products and hardcoded catalog for fallback
    const catalogBySku = {};
    try {
      MOCK_PRODUCT_CATALOG.forEach(p => { catalogBySku[p.sku] = p; });
    } catch (e) {
      console.warn('[recommendations] productCatalog not available for SKU fallback');
    }

    // Build aiResult lookups by SKU for robust fallback matching
    const aiResultBySku = {};
    aiResult.recommendations.forEach(r => {
      const pid = r.productId || r.product_id || r.sku || '';
      if (pid) aiResultBySku[pid] = r;
    });

    // Fetch actual products from DB to map SKUs/product IDs -> DB UUIDs
    const allProducts = await queryAll('SELECT id, COALESCE(sku, id) as identifier FROM products');
    const productIdByIdentifier = {};
    allProducts.forEach(p => { productIdByIdentifier[p.identifier] = p.id; });

    // Use Promise.all to insert all recommendation items in parallel
    await Promise.all(aiResult.recommendations.map(async (item) => {
      const lineId = uuidv4();
      const pid = item.productId || item.product_id || item.sku || '';
      // Prefer DB product UUID; fallback to using the product ID as-is
      const productId = productIdByIdentifier[pid] || pid;
      await run(
        `INSERT INTO recommendation_items
         (id, recommendation_id, product_id, quantity_estimate, dilution_ratio,
          monthly_cost, usage_frequency, priority, usage_guidance, safety_notes)
         VALUES (?, ?, ?, ?, ?, ?, 'Monthly', ?, ?, ?)`,
        [
          lineId, recId, productId,
          item.estimated_monthly_qty_units, item.recommended_dilution,
          item.calculated_cost, 1,
          item.usage_guidance || null,
          item.safety_notes || null
        ]
      );
    }));

    // --- Return response ---
    const [recommendation, items] = await Promise.all([
      queryOne('SELECT * FROM recommendations WHERE id = ?', [recId]),
      queryAll(
      `SELECT ri.*, p.name as product_name, p.category, p.safety_notes, p.usage_guidance,
              p.unit, p.coverage_per_unit, p.unit_price as base_price
       FROM recommendation_items ri
       LEFT JOIN products p ON ri.product_id = p.id
       WHERE ri.recommendation_id = ?
       ORDER BY ri.priority ASC`, [recId    ])]);

    // If DB items have null product_name (because product_id was a SKU string),
    // fill in from the catalog or Gemini output — matched by SKU, not by index
    const responseItems = items.length > 0
      ? items.map(dbItem => {
          const aiMatch = aiResultBySku[dbItem.product_id];
          return {
            ...dbItem,
            product_name: dbItem.product_name
              || (catalogBySku[dbItem.product_id]?.name)
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
          usage_guidance: r.usage_guidance,
          safety_notes: r.safety_notes
        }));

    res.status(201).json({
      success: true,
      message: 'Recommendation processed successfully',
      data: {
        recommendation: {
          ...recommendation,
          alerts: JSON.parse(recommendation?.alerts || '[]'),
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
        grossAggregatedCost: aiResult.summary?.grossAggregatedCost || 0,
        financialStatusAlert: aiResult.summary?.financialStatusAlert || null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/recommendations — list all recommendations
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let sql = `SELECT r.*, i.name as institution_name, i.institution_type
               FROM recommendations r
               JOIN institutions i ON r.institution_id = i.id WHERE 1=1`;
    const params = [];

    if (status) { sql += ' AND r.status = ?'; params.push(status); }

    const countResult = await queryAll(
      `SELECT COUNT(*) as total FROM recommendations r
       JOIN institutions i ON r.institution_id = i.id WHERE 1=1` + (status ? ' AND r.status = ?' : ''),
      status ? [status] : []
    );
    const total = countResult[0]?.total || 0;

    sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);
    const recommendations = await queryAll(sql, params);

    const parsed = recommendations.map(r => ({ ...r, alerts: JSON.parse(r.alerts || '[]') }));

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
    const recommendation = await queryOne(
      `SELECT r.*, i.name as institution_name, i.institution_type, i.area_size, i.hygiene_standard, i.budget, i.surface_types, i.metadata
       FROM recommendations r JOIN institutions i ON r.institution_id = i.id WHERE r.id = ?`,
      [req.params.id]
    );

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found',
        timestamp: new Date().toISOString()
      });
    }

    // Parse metadata
    recommendation.metadata = recommendation.metadata ? JSON.parse(recommendation.metadata) : null;

    let items = await queryAll(
      `SELECT ri.*, p.name as product_name, p.category, p.safety_notes, p.usage_guidance,
              p.unit, p.coverage_per_unit, p.unit_price as base_price
       FROM recommendation_items ri
       LEFT JOIN products p ON ri.product_id = p.id
       WHERE ri.recommendation_id = ? ORDER BY ri.priority ASC`,
      [req.params.id]
    );

    // Build fallback from MOCK_PRODUCT_CATALOG for items where LEFT JOIN missed
    if (items.length > 0) {
      const catBySku = {};
      try { MOCK_PRODUCT_CATALOG.forEach(p => { catBySku[p.sku] = p; }); } catch (e) {}
      items = items.map(item => ({
        ...item,
        product_name: item.product_name || catBySku[item.product_id]?.name || 'Unknown Product',
        usage_guidance: item.usage_guidance || catBySku[item.product_id]?.usage_guidance || null,
        safety_notes: item.safety_notes || catBySku[item.product_id]?.hazard_statements || null
      }));
    }

    res.json({
      success: true,
      data: {
        ...recommendation,
        alerts: JSON.parse(recommendation.alerts || '[]'),
        surface_types: JSON.parse(recommendation.surface_types || '[]'),
        items
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
