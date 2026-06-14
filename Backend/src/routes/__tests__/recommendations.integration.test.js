const http = require('http');
const axios = require('axios');

jest.setTimeout(30000); // Integration tests can be slow with HTTP + server startup

// ── Mock persistence to avoid disk I/O during tests ──────────────────────
jest.mock('../../../persistence', () => ({
  init: jest.fn(),
  saveNow: jest.fn(),
}));

// ── Mock geminiService to avoid actual AI API calls ──────────────────────
// The route calls generateRecommendations directly (no fallback). We mock
// generateRecommendations to return a deterministic AI-shaped result so the
// route persists and returns 201.
jest.mock('../../engine/geminiService', () => {
  const originalModule = jest.requireActual('../../engine/geminiService');
  return {
    ...originalModule,
    generateRecommendations: jest.fn().mockImplementation(async (params) => {
      // Return a mock AI result that matches the expected response shape
      const area = params.area_size || 5000;
      return {
        recommendations: [
          {
            productId: 'prod-gpc-001',
            sku: 'GPC-5L-001',
            name: 'Multi-Purpose Cleaner',
            recommended_dilution: '1:40 (40ml per litre)',
            estimated_monthly_qty_units: Math.round(area / 100),
            calculated_cost: Math.round(area / 100 * 180),
            usage_guidance: 'Dilute 40ml per litre of water. Apply with mop or cloth.',
            safety_notes: 'Wear gloves. Avoid contact with eyes.',
          },
          {
            productId: 'prod-dsf-002',
            sku: 'HDS-5L-002',
            name: 'Hospital-Grade Disinfectant',
            recommended_dilution: '1:20 (50ml per litre)',
            estimated_monthly_qty_units: Math.round(area / 150),
            calculated_cost: Math.round(area / 150 * 350),
            usage_guidance: 'Apply with contact time of 5 minutes.',
            safety_notes: 'Wear mask. Ensure ventilation.',
          },
        ],
        summary: {
          grossAggregatedCost: Math.round(area / 100 * 180 + area / 150 * 350),
          financialStatusAlert: null,
        },
      };
    }),
  };
});

// ── Helper: create a valid institution body ──────────────────────────────
function makeInstitutionBody(overrides = {}) {
  return {
    name: 'Test Hospital',
    institution_type: 'hospital',
    area_size: 5000,
    surface_types: ['hard_floor', 'tile'],
    hygiene_standard: 'medical_grade',
    budget: 'high',
    ...overrides,
  };
}

// ── Test suite ───────────────────────────────────────────────────────────
describe('/api/recommendations/process — Integration', () => {
  let server;
  let baseURL;

  beforeAll(async () => {
    // Re-import the app fresh for each test suite
    delete require.cache[require.resolve('../../../server')];
    const app = require('../../../server');
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    baseURL = `http://localhost:${port}/api`;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
  });

  // Helper to create an institution and return its ID
  async function createInstitution(body) {
    const res = await axios.post(`${baseURL}/institutions`, body);
    return res.data.data.id;
  }

  // Helper to process a recommendation
  async function processRecommendation(institutionId) {
    return axios.post(`${baseURL}/recommendations/process`, { institutionId });
  }

  // Helper to get a recommendation by ID
  async function getRecommendation(id) {
    return axios.get(`${baseURL}/recommendations/${id}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // 1. INPUT VALIDATION
  // ──────────────────────────────────────────────────────────────────────
  describe('Input validation', () => {
    test('returns 400 when institutionId is missing', async () => {
      try {
        await axios.post(`${baseURL}/recommendations/process`, {});
        fail('Expected 400 error');
      } catch (err) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain('institutionId required');
      }
    });

    test('returns 400 when institutionId is null', async () => {
      try {
        await axios.post(`${baseURL}/recommendations/process`, { institutionId: null });
        fail('Expected 400 error');
      } catch (err) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain('institutionId required');
      }
    });

    test('returns 404 when institutionId does not exist', async () => {
      try {
        await axios.post(`${baseURL}/recommendations/process`, { institutionId: 'non-existent-id' });
        fail('Expected 404 error');
      } catch (err) {
        expect(err.response.status).toBe(404);
        expect(err.response.data.error).toContain('Not found');
      }
    });

    test('returns 400 with empty request body', async () => {
      try {
        await axios.post(`${baseURL}/recommendations/process`, {}, { headers: { 'Content-Type': 'application/json' } });
        fail('Expected 400 error');
      } catch (err) {
        expect(err.response.status).toBe(400);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. SUCCESSFUL PROCESSING
  // ──────────────────────────────────────────────────────────────────────
  describe('Successful processing', () => {
    let institutionId;

    beforeAll(async () => {
      institutionId = await createInstitution(makeInstitutionBody());
    });

    test('returns 201 with valid institution', async () => {
      const res = await processRecommendation(institutionId);
      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.message).toBe('Processed');
    });

    test('response contains recommendation object', async () => {
      const res = await processRecommendation(institutionId);
      const rec = res.data.data.recommendation;
      expect(rec).toBeDefined();
      expect(rec.id).toBeDefined();
      expect(rec.institution_id).toBe(institutionId);
      expect(rec.status).toBe('Processed');
      expect(rec.source).toBeDefined();
    });

    test('response contains items array with product details', async () => {
      const res = await processRecommendation(institutionId);
      const items = res.data.data.items;
      const recId = res.data.data.recommendation.id;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(8);

      items.forEach(item => {
        expect(item.product_id).toBeDefined();
        expect(item.product_name).toBeDefined();
        expect(item.category).toBeDefined();
        expect(item.quantity_estimate).toBeGreaterThan(0);
        expect(item.monthly_cost).toBeGreaterThan(0);
        expect(item.unit_price).toBeGreaterThan(0);
        expect(item.recommendation_id).toBe(recId);
      });
    });

    test('response contains engine_source field', async () => {
      const res = await processRecommendation(institutionId);
      expect(res.data.data.engine_source).toBeDefined();
      // AI engine should be the source since we mock it to return data
      expect(res.data.data.engine_source).toBe('AI_Engine');
    });

    test('response contains summary text', async () => {
      const res = await processRecommendation(institutionId);
      expect(res.data.data.summary).toBeDefined();
      expect(res.data.data.summary).toContain('sq. ft.');
      expect(res.data.data.summary).toContain('hospital');
      expect(res.data.data.summary).toContain('5000');
    });

    test('response contains grossAggregatedCost', async () => {
      const res = await processRecommendation(institutionId);
      expect(res.data.data.grossAggregatedCost).toBeDefined();
      expect(res.data.data.grossAggregatedCost).toBeGreaterThan(0);
    });

    test('response contains institution_name and institution_id', async () => {
      const res = await processRecommendation(institutionId);
      expect(res.data.data.institution_name).toBe('Test Hospital');
      expect(res.data.data.institution_id).toBe(institutionId);
    });

    test('alerts is an array', async () => {
      const res = await processRecommendation(institutionId);
      const rec = res.data.data.recommendation;
      expect(Array.isArray(rec.alerts)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. RESPONSE INTEGRITY — verify stored data can be retrieved
  // ──────────────────────────────────────────────────────────────────────
  describe('Data persistence across endpoints', () => {
    let institutionId;
    let recId;

    beforeAll(async () => {
      institutionId = await createInstitution(makeInstitutionBody());
      const res = await processRecommendation(institutionId);
      recId = res.data.data.recommendation.id;
    });

    test('processed recommendation can be fetched via GET /api/recommendations/:id', async () => {
      const res = await getRecommendation(recId);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data.id).toBe(recId);
      expect(res.data.data.institution_id).toBe(institutionId);
      expect(res.data.data.status).toBe('Processed');
    });

    test('GET recommendation returns items', async () => {
      const res = await getRecommendation(recId);
      expect(Array.isArray(res.data.data.items)).toBe(true);
      expect(res.data.data.items.length).toBeGreaterThan(0);
      expect(res.data.data.items[0].recommendation_id).toBe(recId);
    });

    test('GET recommendation returns institution metadata', async () => {
      const res = await getRecommendation(recId);
      expect(res.data.data.institution_name).toBeDefined();
      expect(res.data.data.institution_type).toBe('hospital');
      expect(res.data.data.area_size).toBe(5000);
      expect(res.data.data.hygiene_standard).toBe('medical_grade');
      expect(res.data.data.budget).toBe('high');
    });

    test('GET /api/recommendations lists the processed recommendation', async () => {
      const res = await axios.get(`${baseURL}/recommendations`);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.count).toBeGreaterThanOrEqual(1);
      const found = res.data.data.find(r => r.id === recId);
      expect(found).toBeDefined();
      expect(found.institution_name).toBe('Test Hospital');
    });

    test('institution GET includes recommendations in response', async () => {
      const res = await axios.get(`${baseURL}/institutions/${institutionId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data.data.recommendations)).toBe(true);
      expect(res.data.data.recommendations.length).toBeGreaterThanOrEqual(1);
      expect(res.data.data.recommendations[0].id).toBe(recId);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. DIFFERENT INSTITUTION TYPES
  // ──────────────────────────────────────────────────────────────────────
  describe('Different institution types', () => {
    test.each([
      ['hospital', 'medical_grade'],
      ['school', 'standard'],
      ['hotel', 'high'],
      ['office', 'standard'],
      ['restaurant', 'high'],
      ['factory', 'standard'],
      ['warehouse', 'basic'],
      ['retail', 'standard'],
      ['gym', 'standard'],
      ['laboratory', 'high'],
      ['pharmacy', 'standard'],
      ['airport', 'high'],
      ['shopping_mall', 'standard'],
      ['cinema', 'standard'],
      ['library', 'standard'],
      ['community_center', 'standard'],
    ])('processes %s recommendation successfully', async (type, hygiene) => {
      const id = await createInstitution(makeInstitutionBody({
        name: `Test ${type}`,
        institution_type: type,
        hygiene_standard: hygiene,
        area_size: 3000,
      }));
      const res = await processRecommendation(id);
      expect(res.status).toBe(201);
      expect(res.data.data.engine_source).toBe('AI_Engine');
      expect(res.data.data.institution_name).toBe(`Test ${type}`);
      expect(res.data.data.recommendation.id).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. RESPONSE STRUCTURE VALIDATION
  // ──────────────────────────────────────────────────────────────────────
  describe('Response structure', () => {
    let response;

    beforeAll(async () => {
      const id = await createInstitution(makeInstitutionBody());
      response = await processRecommendation(id);
    });

    test('top-level response has success, message, data, timestamp', () => {
      expect(response.data.success).toBe(true);
      expect(response.data.message).toBe('Processed');
      expect(response.data.data).toBeDefined();
      expect(response.data.timestamp).toBeDefined();
    });

    test('data.recommendation has all required fields', () => {
      const rec = response.data.data.recommendation;
      const required = ['id', 'institution_id', 'status', 'total_estimated_cost',
        'monthly_total_quantity', 'summary', 'alerts', 'source',
        'processed_at', 'created_at', 'updated_at'];
      required.forEach(field => {
        expect(rec[field]).toBeDefined();
      });
    });

    test('data.items each have all required fields', () => {
      const items = response.data.data.items;
      const required = ['id', 'recommendation_id', 'product_id', 'product_name',
        'category', 'sku', 'quantity_estimate', 'unit', 'monthly_cost',
        'unit_price', 'coverage_per_unit', 'usage_frequency', 'priority'];
      items.forEach(item => {
        required.forEach(field => {
          expect(item[field]).toBeDefined();
        });
      });
    });

    test('data has summary and cost fields at top level', () => {
      const data = response.data.data;
      expect(data.summary).toBeDefined();
      expect(data.grossAggregatedCost).toBeGreaterThan(0);
      expect(data.institution_id).toBeDefined();
      expect(data.institution_name).toBeDefined();
    });

    test('recommendation summary is a string', () => {
      expect(typeof response.data.data.summary).toBe('string');
      expect(response.data.data.summary.length).toBeGreaterThan(10);
    });

    test('monthly_total_quantity is a positive number', () => {
      expect(response.data.data.recommendation.monthly_total_quantity).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. EDGE CASES
  // ──────────────────────────────────────────────────────────────────────
  describe('Edge cases', () => {
    test('processes recommendation with minimal institution data', async () => {
      const id = await createInstitution(makeInstitutionBody({
        surface_types: ['hard_floor'],
        hygiene_standard: 'basic',
        budget: 'low',
        area_size: 500,
      }));
      const res = await processRecommendation(id);
      expect(res.status).toBe(201);
      expect(res.data.data.items.length).toBeGreaterThan(0);
      expect(res.data.data.recommendation.total_estimated_cost).toBeGreaterThan(0);
    });

    test('processes recommendation with very large area', async () => {
      const id = await createInstitution(makeInstitutionBody({
        area_size: 100000,
        hygiene_standard: 'medical_grade',
        budget: 'high',
      }));
      const res = await processRecommendation(id);
      expect(res.status).toBe(201);
      expect(res.data.data.items.length).toBeGreaterThan(0);
      // Large area should trigger alerts
      const alerts = res.data.data.recommendation.alerts;
      expect(Array.isArray(alerts)).toBe(true);
    });

    test('processes multiple recommendations for the same institution', async () => {
      const id = await createInstitution(makeInstitutionBody());
      const res1 = await processRecommendation(id);
      const res2 = await processRecommendation(id);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      // Each call should create a unique recommendation
      expect(res1.data.data.recommendation.id).not.toBe(res2.data.data.recommendation.id);
      // Both should reference the same institution
      expect(res1.data.data.institution_id).toBe(id);
      expect(res2.data.data.institution_id).toBe(id);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. ERROR HANDLING
  // ──────────────────────────────────────────────────────────────────────
  describe('Error handling', () => {
    test('returns 404 for unknown route', async () => {
      try {
        await axios.get(`${baseURL}/nonexistent`);
        fail('Expected 404 error');
      } catch (err) {
        expect(err.response.status).toBe(404);
        expect(err.response.data.error).toContain('Route not found');
      }
    });

    test('returns 404 for unknown recommendation ID', async () => {
      try {
        await axios.get(`${baseURL}/recommendations/does-not-exist`);
        fail('Expected 404 error');
      } catch (err) {
        expect(err.response.status).toBe(404);
        expect(err.response.data.error).toContain('Not found');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 8. CONCURRENT PROCESSING
  // ──────────────────────────────────────────────────────────────────────
  describe('Concurrent/sequential processing', () => {
    test('processes two different institutions sequentially', async () => {
      const id1 = await createInstitution(makeInstitutionBody({ name: 'Hospital A', institution_type: 'hospital' }));
      const id2 = await createInstitution(makeInstitutionBody({ name: 'School B', institution_type: 'school' }));

      const res1 = await processRecommendation(id1);
      const res2 = await processRecommendation(id2);

      expect(res1.data.data.institution_name).toBe('Hospital A');
      expect(res2.data.data.institution_name).toBe('School B');
      expect(res1.data.data.recommendation.id).not.toBe(res2.data.data.recommendation.id);
    });

    test('GET /api/recommendations returns multiple recommendations', async () => {
      const id = await createInstitution(makeInstitutionBody({ name: 'MultiRec Institution' }));
      await processRecommendation(id);
      await processRecommendation(id);
      await processRecommendation(id);

      const res = await axios.get(`${baseURL}/recommendations`, {
        params: { limit: 50 }
      });
      const multiRecs = res.data.data.filter(r => r.institution_name === 'MultiRec Institution');
      expect(multiRecs.length).toBe(3);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 9. ITEMS WITH USAGE GUIDANCE AND SAFETY NOTES
  // ──────────────────────────────────────────────────────────────────────
  describe('Item details completeness', () => {
    test('items have usage_guidance or safety_notes or both', async () => {
      const id = await createInstitution(makeInstitutionBody());
      const res = await processRecommendation(id);
      const items = res.data.data.items;
      items.forEach(item => {
        // At minimum, one of these should exist
        const hasGuidance = item.usage_guidance !== null && item.usage_guidance !== undefined;
        const hasSafety = item.safety_notes !== null && item.safety_notes !== undefined;
        expect(hasGuidance || hasSafety).toBe(true);
      });
    });

    test('items have SKU defined', async () => {
      const id = await createInstitution(makeInstitutionBody());
      const res = await processRecommendation(id);
      res.data.data.items.forEach(item => {
        expect(item.sku).toBeDefined();
        expect(item.sku.length).toBeGreaterThan(0);
      });
    });

    test('unit is defined for all items', async () => {
      const id = await createInstitution(makeInstitutionBody());
      const res = await processRecommendation(id);
      res.data.data.items.forEach(item => {
        expect(item.unit).toBeDefined();
      });
    });
  });
});
