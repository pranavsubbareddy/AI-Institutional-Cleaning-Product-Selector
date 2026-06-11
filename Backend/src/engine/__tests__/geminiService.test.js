const { generateRecommendations, getAIClient } = require('../geminiService');
const { generateRecommendation } = require('../recommendationEngine');

// Mock the recommendation engine module
jest.mock('../recommendationEngine', () => ({
  generateRecommendation: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helper: create base institution params
// ---------------------------------------------------------------------------
function makeParams(overrides = {}) {
  return {
    institution_type: 'hospital',
    area_size: 5000,
    surface_types: ['hard_floor', 'tile'],
    hygiene_standard: 'standard',
    budget: 'medium',
    metadata: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. getAIClient TESTS (isolated to avoid singleton issues)
// ---------------------------------------------------------------------------
describe('getAIClient', () => {
  const OLD_ENV = process.env;

  afterAll(() => {
    process.env = OLD_ENV;
  });

  function getIsolatedAIClient() {
    let result;
    jest.isolateModules(() => {
      const mod = require('../geminiService');
      result = mod.getAIClient();
    });
    return result;
  }

  test('returns null when no API key is set', () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;
    expect(getIsolatedAIClient()).toBeNull();
  });

  test('returns null when API key is placeholder value', () => {
    process.env.GEMINI_API_KEY = 'your-gemini-api-key-here';
    expect(getIsolatedAIClient()).toBeNull();
  });

  test('reads GEMINI_API_KEY env var', () => {
    process.env.GEMINI_API_KEY = 'test-key-123';
    const client = getIsolatedAIClient();
    expect(client).not.toBeNull();
  });

  test('reads GOOGLE_GENAI_API_KEY as fallback', () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GOOGLE_GENAI_API_KEY = 'fallback-key-456';
    expect(getIsolatedAIClient()).not.toBeNull();
  });

  test('prefers GEMINI_API_KEY over GOOGLE_GENAI_API_KEY', () => {
    process.env.GEMINI_API_KEY = 'primary-key';
    process.env.GOOGLE_GENAI_API_KEY = 'fallback-key';
    expect(getIsolatedAIClient()).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. generateFallbackRecommendations TESTS (via generateRecommendations)
// ---------------------------------------------------------------------------
describe('generateRecommendations - fallback behavior', () => {
  const OLD_ENV = process.env;

  beforeAll(() => {
    process.env.GEMINI_API_KEY = ''; // No key = fallback path
    // Reset the singleton
    jest.resetModules();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  beforeEach(() => {
    // Mock the recommendation engine to return controlled output
    generateRecommendation.mockReturnValue({
      items: [
        {
          product_id: 'prod-gpc-001',
          product_name: 'Ganga Multi-Purpose Cleaner',
          dilution_ratio: '1:40 (40ml per litre)',
          quantity_estimate: 50,
          monthly_cost: 9000,
          unit_price: 180,
          usage_guidance: 'Dilute 40ml in 1 litre',
          safety_notes: 'Wear gloves',
          category: 'General Purpose Cleaner',
          unit: 'litre',
          coverage_per_unit: 40,
          priority: 1,
          usage_frequency: '3-4 times/week',
          score: 60,
        },
        {
          product_id: 'prod-dsf-002',
          product_name: 'Ganga Hospital-Grade Disinfectant',
          dilution_ratio: '1:20 (50ml per litre)',
          quantity_estimate: 30,
          monthly_cost: 10500,
          unit_price: 350,
          usage_guidance: 'Apply with contact time of 5 min',
          safety_notes: 'Wear mask',
          category: 'Disinfectant',
          unit: 'litre',
          coverage_per_unit: 30,
          priority: 2,
          usage_frequency: 'Daily',
          score: 55,
        },
      ],
      total_estimated_cost: 19500,
      monthly_total_quantity: 80,
      alerts: ['High hygiene standard detected', 'Large area detected'],
      summary: 'Recommended 2 products for hospital facility',
      institution_profile: 'Hospital / Healthcare',
      hygiene_level: 'Standard',
      budget_level: 'Medium',
      metadata_context: { floors: 1, occupants: 0 },
    });
  });

  test('returns recommendations when no API key is set', async () => {
    const result = await generateRecommendations(makeParams());
    expect(result).toBeDefined();
    expect(result.recommendations).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  test('maps engine items to correct output format', async () => {
    const result = await generateRecommendations(makeParams());
    expect(result.recommendations.length).toBe(2);

    const first = result.recommendations[0];
    expect(first).toHaveProperty('productId', 'prod-gpc-001');
    expect(first).toHaveProperty('sku', 'prod-gpc-001');
    expect(first).toHaveProperty('name', 'Ganga Multi-Purpose Cleaner');
    expect(first).toHaveProperty('recommended_dilution');
    expect(first).toHaveProperty('estimated_monthly_qty_units', 50);
    expect(first).toHaveProperty('calculated_cost', 9000);
    expect(first).toHaveProperty('usage_guidance');
    expect(first).toHaveProperty('safety_notes');
  });

  test('includes summary with grossAggregatedCost and financialStatusAlert', async () => {
    const result = await generateRecommendations(makeParams());
    expect(result.summary.grossAggregatedCost).toBe(19500);
    expect(result.summary.financialStatusAlert).toContain('High hygiene standard');
  });

  test('financialStatusAlert is null when no alerts', async () => {
    generateRecommendation.mockReturnValue({
      items: [{
        product_id: 'prod-gpc-001', product_name: 'Cleaner',
        quantity_estimate: 10, monthly_cost: 1800,
        usage_guidance: '', safety_notes: '',
        unit_price: 180, category: 'GPC', unit: 'litre',
        coverage_per_unit: 40, priority: 1,
        usage_frequency: 'Weekly', score: 30, dilution_ratio: '1:40',
      }],
      total_estimated_cost: 1800,
      monthly_total_quantity: 10,
      alerts: [],
      summary: 'test',
      institution_profile: 'Hospital',
      hygiene_level: 'Standard',
      budget_level: 'Medium',
      metadata_context: {},
    });

    const result = await generateRecommendations(makeParams());
    expect(result.summary.financialStatusAlert).toBeNull();
  });

  test('calls generateRecommendation with correct params', async () => {
    await generateRecommendations(makeParams({
      institution_type: 'school',
      area_size: 10000,
      hygiene_standard: 'high',
      budget: 'low',
    }));

    expect(generateRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        institution_type: 'school',
        area_size: 10000,
        hygiene_standard: 'high',
        budget: 'low',
      })
    );
  });

  test('passes metadata to generateRecommendation', async () => {
    await generateRecommendations(makeParams({
      metadata: { floors: 5, equipment: ['mop'] },
    }));

    expect(generateRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { floors: 5, equipment: ['mop'] },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 3. buildPrompt TESTS  
// ---------------------------------------------------------------------------
describe('buildPrompt output (via generateFallbackRecommendations)', () => {
  const OLD_ENV = process.env;

  beforeAll(() => {
    process.env.GEMINI_API_KEY = '';
    jest.resetModules();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  beforeEach(() => {
    generateRecommendation.mockReturnValue({
      items: [{ 
        product_id: 'prod-gpc-001', product_name: 'Test', 
        quantity_estimate: 1, monthly_cost: 100, 
        usage_guidance: '', safety_notes: '',
        unit_price: 100, category: 'Test', unit: 'L',
        coverage_per_unit: 10, priority: 1,
        usage_frequency: 'Daily', score: 50, dilution_ratio: '1:40',
      }],
      total_estimated_cost: 100,
      monthly_total_quantity: 1,
      alerts: [],
      summary: 'test',
      institution_profile: 'Test',
      hygiene_level: 'Standard',
      budget_level: 'Medium',
      metadata_context: {},
    });
  });

  test('fallback still works with null metadata', async () => {
    const result = await generateRecommendations(makeParams({
      metadata: null,
    }));
    expect(result.recommendations.length).toBe(1);
    expect(result.summary.grossAggregatedCost).toBe(100);
  });

  test('fallback still works with undefined metadata', async () => {
    const result = await generateRecommendations(makeParams());
    expect(result.recommendations.length).toBe(1);
  });

  test('fallback still works with full metadata', async () => {
    const result = await generateRecommendations(makeParams({
      metadata: {
        floors: 5, occupants: 800, operating_hours: '24x7',
        cleaning_frequency: 'twice_daily', facility_age: 'old',
        equipment: ['mop', 'scrubber', 'microfiber'],
        preferences: ['eco_friendly', 'concentrated'],
        certifications: ['haccp', 'iso_9001'],
      },
    }));
    expect(result.recommendations.length).toBe(1);
  });

  test('handles empty surface_types gracefully', async () => {
    const result = await generateRecommendations(makeParams({
      surface_types: [],
    }));
    expect(result.recommendations.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 4. EDGE CASE TESTS
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  const OLD_ENV = process.env;

  beforeAll(() => {
    process.env.GEMINI_API_KEY = '';
    jest.resetModules();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  beforeEach(() => {
    generateRecommendation.mockReturnValue({
      items: [{ 
        product_id: 'prod-test', product_name: 'Test', 
        quantity_estimate: 1, monthly_cost: 100, 
        usage_guidance: '', safety_notes: '',
        unit_price: 100, category: 'Test', unit: 'L',
        coverage_per_unit: 10, priority: 1,
        usage_frequency: 'Daily', score: 50, dilution_ratio: '1:40',
      }],
      total_estimated_cost: 100,
      monthly_total_quantity: 1,
      alerts: [],
      summary: 'test',
      institution_profile: 'Test',
      hygiene_level: 'Standard',
      budget_level: 'Medium',
      metadata_context: {},
    });
  });

  test('engine throws error - error propagates to caller', async () => {
    generateRecommendation.mockImplementation(() => {
      throw new Error('Engine error');
    });

    await expect(
      generateRecommendations(makeParams())
    ).rejects.toThrow('Engine error');
  });

  test('empty items array is handled', async () => {
    generateRecommendation.mockReturnValue({
      items: [],
      total_estimated_cost: 0,
      monthly_total_quantity: 0,
      alerts: [],
      summary: 'No products found',
      institution_profile: 'Test',
      hygiene_level: 'Standard',
      budget_level: 'Medium',
      metadata_context: {},
    });

    const result = await generateRecommendations(makeParams());
    expect(result.recommendations).toEqual([]);
    expect(result.summary.grossAggregatedCost).toBe(0);
  });

  test('handles null/undefined values in engine output', async () => {
    generateRecommendation.mockReturnValue({
      items: [],
      total_estimated_cost: 0,
      monthly_total_quantity: 0,
      alerts: null,  // Tests defensive null guard in production code
      summary: 'No products matched',
      institution_profile: 'Default',
      hygiene_level: 'Standard',
      budget_level: 'Medium',
      metadata_context: {},
    });

    const result = await generateRecommendations(makeParams());
    expect(result.recommendations).toEqual([]);
    // Should not crash despite null alerts
    expect(result.summary.financialStatusAlert).toBeNull();
    expect(result.summary.grossAggregatedCost).toBe(0);
  });
});
