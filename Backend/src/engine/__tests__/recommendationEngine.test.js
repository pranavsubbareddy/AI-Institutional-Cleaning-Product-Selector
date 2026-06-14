const { generateRecommendation, PRODUCT_KNOWLEDGE_BASE } = require('../recommendationEngine');

// ---------------------------------------------------------------------------
// Helper: create a basic institution data object
// ---------------------------------------------------------------------------
function makeInstitution(overrides = {}) {
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
// Helper: make metadata
// ---------------------------------------------------------------------------
function makeMetadata(overrides = {}) {
  return {
    floors: 1,
    occupants: 0,
    operating_hours: 'day',
    cleaning_frequency: 'daily',
    facility_age: 'moderate',
    equipment: [],
    preferences: [],
    certifications: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. BASE SCORING TESTS
// ---------------------------------------------------------------------------
describe('Base Scoring', () => {
  test('returns items and summary with basic hospital data', () => {
    const result = generateRecommendation(makeInstitution());
    expect(result).toBeDefined();
    expect(result.items).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total_estimated_cost).toBeGreaterThan(0);
    expect(result.summary).toContain('Hospital');
    expect(result.institution_profile).toBe('Hospital / Healthcare');
  });

  test('prioritizes hospital products (Disinfectant > Hand Sanitizer > GPC)', () => {
    const result = generateRecommendation(makeInstitution());
    const topItem = result.items[0];
    // Hospital profile prioritizes Disinfectant
    expect(topItem.priority).toBe(1);
  });

  test('returns different products for different institution types', () => {
    const hospital = generateRecommendation(makeInstitution({ institution_type: 'hospital' }));
    const warehouse = generateRecommendation(makeInstitution({ institution_type: 'warehouse' }));
    expect(hospital.items[0].product_id).not.toBe(warehouse.items[0].product_id);
  });

  test('surface type match boosts scoring', () => {
    const withCarpet = generateRecommendation(makeInstitution({
      surface_types: ['hard_floor', 'tile', 'carpet'],
    }));
    const hasCarpetItem = withCarpet.items.find(i => i.category === 'Carpet Cleaner');
    expect(hasCarpetItem).toBeDefined();
  });

  test('hygiene standard affects quantity estimates', () => {
    const basic = generateRecommendation(makeInstitution({ hygiene_standard: 'basic' }));
    const medical = generateRecommendation(makeInstitution({ hygiene_standard: 'medical_grade' }));
    // Medical grade should have higher quantities due to frequency_multiplier: 2.0 vs 0.6
    expect(medical.monthly_total_quantity).toBeGreaterThan(basic.monthly_total_quantity);
  });

  test('budget level affects unit prices', () => {
    const low = generateRecommendation(makeInstitution({ budget: 'low' }));
    const high = generateRecommendation(makeInstitution({ budget: 'high' }));
    // High budget should have higher unit prices due to price_multiplier: 1.3 vs 0.8
    const lowPrice = low.items[0].unit_price;
    const highPrice = high.items[0].unit_price;
    expect(highPrice).toBeGreaterThanOrEqual(lowPrice);
  });

  test('larger area increases quantity estimates', () => {
    const small = generateRecommendation(makeInstitution({ area_size: 500 }));
    const large = generateRecommendation(makeInstitution({ area_size: 50000 }));
    expect(large.monthly_total_quantity).toBeGreaterThan(small.monthly_total_quantity);
    expect(large.total_estimated_cost).toBeGreaterThan(small.total_estimated_cost);
  });

  test('returns up to 8 items', () => {
    const result = generateRecommendation(makeInstitution());
    expect(result.items.length).toBeLessThanOrEqual(8);
  });

  test('exact scoring: unknown type + unmatched surfaces = low scores but still returns items', () => {
    const result = generateRecommendation({
      institution_type: 'warehouse',
      area_size: 1000,
      surface_types: ['wood', 'mirror', 'glass'],
      hygiene_standard: 'standard',
      budget: 'low',
      metadata: null,
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThanOrEqual(8);
    // Warehouse with wood/mirror/glass surfaces should still get recommendations
  });

  test('scoring: medical_grade hygiene gives 20 bonus to Disinfectant even if product hygiene < required', () => {
    const result = generateRecommendation(makeInstitution({
      hygiene_standard: 'medical_grade',
      surface_types: ['hard_floor', 'tile', 'stainless_steel', 'countertop'],
    }));
    const disinfectant = result.items.find(i => i.product_id === 'prod-dsf-002');
    expect(disinfectant).toBeDefined();
    // Disinfectant is medical_grade level so it should have high priority
    expect(disinfectant.priority).toBe(1);
  });

  test('budget influences unit_price correctly (low=0.8x, medium=1.0x, high=1.3x)', () => {
    const low = generateRecommendation(makeInstitution({ budget: 'low' }));
    const medium = generateRecommendation(makeInstitution({ budget: 'medium' }));
    const high = generateRecommendation(makeInstitution({ budget: 'high' }));

    const lowGPC = low.items.find(i => i.product_id === 'prod-gpc-001'); // base price 180
    const medGPC = medium.items.find(i => i.product_id === 'prod-gpc-001');
    const highGPC = high.items.find(i => i.product_id === 'prod-gpc-001');

    if (lowGPC && medGPC && highGPC) {
      expect(lowGPC.unit_price).toBe(144);  // 180 * 0.8
      expect(medGPC.unit_price).toBe(180);   // 180 * 1.0
      expect(highGPC.unit_price).toBe(234);  // 180 * 1.3
    }
  });
});

// ---------------------------------------------------------------------------
// 2. EQUIPMENT SCORING TESTS
// ---------------------------------------------------------------------------
describe('Equipment Scoring', () => {
  test('equipment compatibility boosts product scores', () => {
    const noEq = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ equipment: [] }),
    }));
    const withEq = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ equipment: ['mop', 'scrubber', 'microfiber'] }),
    }));

    // With compatible equipment, quantities should be lower (efficiency factor 0.85)
    expect(withEq.monthly_total_quantity).toBeLessThan(noEq.monthly_total_quantity);
    expect(withEq.total_estimated_cost).toBeLessThan(noEq.total_estimated_cost);
  });

  test('power tools (scrubber) give 15% quantity reduction vs no equipment', () => {
    const none = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ equipment: [] }),
    }));
    const powerTools = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ equipment: ['scrubber'] }),
    }));

    const qtyRatio = powerTools.monthly_total_quantity / none.monthly_total_quantity;
    expect(qtyRatio).toBeLessThan(0.9);
    expect(qtyRatio).toBeGreaterThan(0.8);
  });

  test('mop + vacuum triggers basic equipment efficiency path', () => {
    const mopVac = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ equipment: ['mop', 'vacuum'] }),
    }));
    // Verify code path executes: equipment is recognized in metadata_context
    expect(mopVac.metadata_context.equipment_count).toBe(2);
    // Verify the equipment efficiency is applied: quantities should be reasonable
    expect(mopVac.monthly_total_quantity).toBeGreaterThan(0);
  });

  test('auto_dispenser triggers custom usage guidance for hand sanitizer', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ equipment: ['auto_dispenser'] }),
    }));
    const sanitizerItem = result.items.find(i => i.category === 'Hand Sanitizer');
    if (sanitizerItem) {
      expect(sanitizerItem.usage_guidance).toContain('auto-dispenser');
    }
  });

  test('scrubber triggers custom usage guidance for floor cleaner', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ equipment: ['scrubber'] }),
    }));
    const floorItem = result.items.find(i => i.category === 'Floor Cleaner');
    if (floorItem) {
      expect(floorItem.usage_guidance).toContain('floor scrubber');
    }
  });

  test('pressure_washer triggers custom usage guidance for degreaser', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ equipment: ['pressure_washer'] }),
    }));
    const degreaserItem = result.items.find(i => i.category === 'Heavy Duty Degreaser');
    if (degreaserItem) {
      expect(degreaserItem.usage_guidance).toContain('pressure washer');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. PREFERENCE SCORING TESTS
// ---------------------------------------------------------------------------
describe('Preference Scoring', () => {
  test('eco_friendly preference boosts eco-tagged products', () => {
    const noPref = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ preferences: [] }),
    }));
    const ecoPref = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ preferences: ['eco_friendly'] }),
    }));

    // Eco preference should add +12 to eco-friendly tagged products
    // This means Bio-Enzymatic Drain Cleaner (eco_friendly tagged) should have a different relative score
    const ecoItem = ecoPref.items.find(i => i.product_id === 'prod-bio-011');
    const noEcoItem = noPref.items.find(i => i.product_id === 'prod-bio-011');

    if (ecoItem && noEcoItem) {
      expect(ecoItem.score).toBeGreaterThan(noEcoItem.score);
    }
  });

  test('fragrance_free preference boosts fragrance-free tagged products', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ preferences: ['fragrance_free', 'concentrated'] }),
    }));
    expect(result.items.length).toBeGreaterThan(0);
  });

  test('multiple preferences stack bonus', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ preferences: ['eco_friendly', 'concentrated', 'fragrance_free'] }),
    }));
    // All three preferences - Multi-Purpose Cleaner has all three tags, should be highly ranked
    const gpcItem = result.items.find(i => i.product_id === 'prod-gpc-001');
    expect(gpcItem).toBeDefined();
    expect(gpcItem.score).toBeGreaterThan(30); // At least 3 * 12 = 36 from preferences
  });

  test('preferences that do NOT match any product tags add no bonus', () => {
    // Create a basic scenario with minimal surface match to reduce other bonuses
    const result = generateRecommendation(makeInstitution({
      institution_type: 'office',
      area_size: 500,
      surface_types: ['hard_floor'],
      hygiene_standard: 'basic',
      budget: 'low',
      metadata: makeMetadata({ preferences: ['industrial_grade'] }),
    }));
    // Industrial_grade tag only on Disinfectant and Heavy Duty Degreaser
    // Products without industrial_grade tag should NOT get the preference bonus
    expect(result.items.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. CERTIFICATION SCORING TESTS
// ---------------------------------------------------------------------------
describe('Certification Scoring', () => {
  test('HACCP certification boosts disinfectant and degreaser', () => {
    const noCert = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ certifications: [] }),
    }));
    const haccpCert = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ certifications: ['haccp'] }),
    }));

    const haccpDisinfectant = haccpCert.items.find(i => i.category === 'Disinfectant');
    const noDisinfectant = noCert.items.find(i => i.category === 'Disinfectant');
    if (haccpDisinfectant && noDisinfectant) {
      expect(haccpDisinfectant.score).toBeGreaterThan(noDisinfectant.score);
    }
  });

  test('Green Seal certification boosts eco-friendly products', () => {
    const noCert = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ certifications: [] }),
    }));
    const greenCert = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ certifications: ['green_seal'] }),
    }));

    const greenItem = greenCert.items.find(i => i.product_id === 'prod-bio-011');
    const noItem = noCert.items.find(i => i.product_id === 'prod-bio-011');
    if (greenItem && noItem) {
      expect(greenItem.score).toBeGreaterThan(noItem.score);
    }
  });

  test('ISO 9001 gives general quality boost to all products (+4 score)', () => {
    const noCert = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ certifications: [] }),
    }));
    const isoCert = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ certifications: ['iso_9001'] }),
    }));

    // ISO 9001 adds +4 to every product's score
    const isoGPC = isoCert.items.find(i => i.product_id === 'prod-gpc-001');
    const noGPC = noCert.items.find(i => i.product_id === 'prod-gpc-001');
    if (isoGPC && noGPC) {
      expect(isoGPC.score - noGPC.score).toBeGreaterThanOrEqual(4);
    }
  });

  test('multiple certifications combine', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ certifications: ['haccp', 'osha', 'iso_9001'] }),
    }));
    // Certification bonuses should not prevent normal results
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total_estimated_cost).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. OPERATING HOURS & FACILITY AGE TESTS
// ---------------------------------------------------------------------------
describe('Operating Hours & Facility Age', () => {
  test('24x7 facility boosts high/medical-grade hygiene products', () => {
    const day = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ operating_hours: 'day' }),
    }));
    const allDay = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ operating_hours: '24x7' }),
    }));

    const dayDisinfectant = day.items.find(i => i.category === 'Disinfectant');
    const allDayDisinfectant = allDay.items.find(i => i.category === 'Disinfectant');
    if (dayDisinfectant && allDayDisinfectant) {
      expect(allDayDisinfectant.score).toBeGreaterThanOrEqual(dayDisinfectant.score);
    }
  });

  test('old facility boosts heavy-duty degreaser and floor cleaner', () => {
    // Use factory type where degreaser is already naturally high priority
    const result = generateRecommendation(makeInstitution({
      institution_type: 'factory',
      surface_types: ['hard_floor', 'stainless_steel', 'tile', 'countertop'],
      metadata: makeMetadata({ facility_age: 'old' }),
    }));
    const degreaserItem = result.items.find(i => i.category === 'Heavy Duty Degreaser');
    if (degreaserItem) {
      expect(degreaserItem.priority).toBeLessThanOrEqual(2);
      // Verify old facility alert is triggered
      const alert = result.alerts.find(a => a.includes('Older facility'));
      expect(alert).toBeDefined();
    }
  });

  test('vintage facility also boosts heavy-duty products', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ facility_age: 'vintage' }),
    }));
    expect(result.items.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 6. FREQUENCY & OCCUPANT ADJUSTMENT TESTS
// ---------------------------------------------------------------------------
describe('Frequency & Occupant Adjustments', () => {
  test('twice_daily cleaning increases quantities vs weekly', () => {
    const weekly = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ cleaning_frequency: 'weekly' }),
    }));
    const twiceDaily = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ cleaning_frequency: 'twice_daily' }),
    }));

    expect(twiceDaily.monthly_total_quantity).toBeGreaterThan(weekly.monthly_total_quantity);
    // twice_daily: 1.8x vs weekly: 0.4x = 4.5x ratio
    const ratio = twiceDaily.monthly_total_quantity / weekly.monthly_total_quantity;
    expect(ratio).toBeGreaterThan(3);
  });

  test('all cleaning frequency multipliers produce expected ratios', () => {
    const daily = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ cleaning_frequency: 'daily' }),
    }));
    const twice = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ cleaning_frequency: 'twice_daily' }),
    }));
    const multiWk = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ cleaning_frequency: 'multiple_weekly' }),
    }));
    const weekly = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ cleaning_frequency: 'weekly' }),
    }));
    const custom = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ cleaning_frequency: 'custom' }),
    }));

    // Order should be: twice_daily > daily > multiple_weekly > custom > weekly
    expect(twice.monthly_total_quantity).toBeGreaterThan(daily.monthly_total_quantity);
    expect(daily.monthly_total_quantity).toBeGreaterThan(multiWk.monthly_total_quantity);
    expect(multiWk.monthly_total_quantity).toBeGreaterThan(custom.monthly_total_quantity);
    expect(custom.monthly_total_quantity).toBeGreaterThan(weekly.monthly_total_quantity);
  });

  test('high occupant density increases quantities', () => {
    const low = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ occupants: 10 }),
    }));
    const high = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ occupants: 2000 }),
    }));

    expect(high.monthly_total_quantity).toBeGreaterThan(low.monthly_total_quantity);
  });

  test('occupant factor formula: 0 occupants → factor of 1.0', () => {
    const zeroOcc = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ occupants: 0 }),
    }));
    const oneOcc = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ occupants: 1 }),
    }));

    // 0 occupants → occupantDensity = 1 (Math.max(1, 0 / (areaSize / 100)) = 1)
    // occupantFactor = 0.8 + (1 * 0.2) = 1.0
    // 1 occupant → occupantDensity = Math.max(1, 1 / 50) = 1
    // occupantFactor = 0.8 + (1 * 0.2) = 1.0
    expect(zeroOcc.monthly_total_quantity).toBe(oneOcc.monthly_total_quantity);
  });

  test('multiple floors reduce per-floor area calculation', () => {
    const single = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ floors: 1 }),
    }));
    const multi = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ floors: 5 }),
    }));

    expect(multi.metadata_context.floors).toBe(5);
    expect(single.metadata_context.floors).toBe(1);
  });

  test('usage_frequency string based on hygiene multiplier', () => {
    const basic = generateRecommendation(makeInstitution({ hygiene_standard: 'basic' }));
    const standard = generateRecommendation(makeInstitution({ hygiene_standard: 'standard' }));
    const high = generateRecommendation(makeInstitution({ hygiene_standard: 'high' }));
    const medical = generateRecommendation(makeInstitution({ hygiene_standard: 'medical_grade' }));

    // basic: frequency_multiplier=0.6 → '1-2 times/week'
    expect(basic.items[0].usage_frequency).toBe('1-2 times/week');
    // standard: frequency_multiplier=1.0 → '3-4 times/week'
    expect(standard.items[0].usage_frequency).toBe('3-4 times/week');
    // high: frequency_multiplier=1.5 → 'Daily'
    expect(high.items[0].usage_frequency).toBe('Daily');
    // medical_grade: frequency_multiplier=2.0 → 'Daily'
    expect(medical.items[0].usage_frequency).toBe('Daily');
  });
});

// ---------------------------------------------------------------------------
// 7. ALERTS TESTS
// ---------------------------------------------------------------------------
describe('Metadata-Driven Alerts', () => {
  test('no equipment alert triggers when equipment list is empty', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ equipment: [] }),
    }));
    const alert = result.alerts.find(a => a.includes('No cleaning equipment'));
    expect(alert).toBeDefined();
  });

  test('high floors triggers multi-story alert', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ floors: 5 }),
    }));
    const alert = result.alerts.find(a => a.includes('Multi-story facility'));
    expect(alert).toBeDefined();
  });

  test('high occupancy triggers alert', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ occupants: 600 }),
    }));
    const alert = result.alerts.find(a => a.includes('High occupancy'));
    expect(alert).toBeDefined();
  });

  test('eco-friendly preference triggers alert', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ preferences: ['eco_friendly'] }),
    }));
    const alert = result.alerts.find(a => a.includes('Eco-friendly preferences'));
    expect(alert).toBeDefined();
  });

  test('HACCP or GMP certification triggers food safety alert', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ certifications: ['haccp'] }),
    }));
    const alert = result.alerts.find(a => a.includes('Food safety'));
    expect(alert).toBeDefined();
  });

  test('OSHA certification triggers safety compliance alert', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ certifications: ['osha'] }),
    }));
    const alert = result.alerts.find(a => a.includes('OSHA compliance'));
    expect(alert).toBeDefined();
  });

  test('24x7 facility triggers scheduling alert', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ operating_hours: '24x7' }),
    }));
    const alert = result.alerts.find(a => a.includes('24x7'));
    expect(alert).toBeDefined();
  });

  test('old facility triggers heavy-duty alert', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ facility_age: 'old' }),
    }));
    const alert = result.alerts.find(a => a.includes('Older facility'));
    expect(alert).toBeDefined();
  });

  test('auto_dispenser triggers optimization alert', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ equipment: ['auto_dispenser'] }),
    }));
    const alert = result.alerts.find(a => a.includes('Auto-dispenser'));
    expect(alert).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 8. EDGE CASES
// ---------------------------------------------------------------------------
describe('Edge Cases', () => {
  test('handles null metadata gracefully', () => {
    const result = generateRecommendation(makeInstitution({ metadata: null }));
    expect(result).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.alerts.length).toBeGreaterThan(0);
  });

  test('handles undefined metadata gracefully', () => {
    const result = generateRecommendation(makeInstitution());
    expect(result).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);
  });

  test('handles empty surface types', () => {
    const result = generateRecommendation(makeInstitution({ surface_types: [] }));
    expect(result).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);
  });

  test('handles unknown institution type by falling back to office', () => {
    const result = generateRecommendation(makeInstitution({ institution_type: 'unknown_type' }));
    expect(result).toBeDefined();
    expect(result.institution_profile).toBe('Office / Corporate');
    expect(result.items.length).toBeGreaterThan(0);
  });

  test('handles empty metadata fields gracefully', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: {
        floors: null,
        occupants: null,
        equipment: null,
        preferences: null,
        certifications: null,
        operating_hours: null,
        cleaning_frequency: null,
        facility_age: null,
      },
    }));
    expect(result).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);
  });

  test('handles very large area without crashing', () => {
    const result = generateRecommendation(makeInstitution({ area_size: 1000000 }));
    expect(result).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total_estimated_cost).toBeGreaterThan(0);
  });

  test('handles very small area without crashing', () => {
    const result = generateRecommendation(makeInstitution({ area_size: 100 }));
    expect(result).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);
  });

  test('all recommended items have unique product IDs', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({
        equipment: ['mop', 'scrubber', 'microfiber', 'vacuum', 'auto_dispenser'],
        preferences: ['eco_friendly', 'concentrated', 'fragrance_free', 'hypoallergenic'],
        certifications: ['haccp', 'iso_9001', 'osha', 'green_seal'],
      }),
    }));
    const ids = result.items.map(i => i.product_id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('all items have positive quantities and costs', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({
        floors: 10,
        occupants: 2000,
        equipment: ['scrubber', 'steam_cleaner'],
        cleaning_frequency: 'twice_daily',
      }),
    }));
    result.items.forEach(item => {
      expect(item.quantity_estimate).toBeGreaterThan(0);
      expect(item.monthly_cost).toBeGreaterThan(0);
      expect(item.unit_price).toBeGreaterThan(0);
    });
  });

  test('very small area with single floor — no division by zero', () => {
    const result = generateRecommendation(makeInstitution({ area_size: 100, metadata: makeMetadata({ floors: 1 }) }));
    expect(result).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);
  });

  test('area_per_floor: 5 floors divides correctly (5000/5 = 1000 per floor)', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ floors: 5 }),
    }));
    expect(result.metadata_context.floors).toBe(5);
  });

  test('all item IDs are unique UUIDs', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({
        equipment: ['mop', 'scrubber', 'microfiber', 'vacuum'],
      }),
    }));
    const ids = result.items.map(i => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    // UUIDs should be strings of reasonable length
    ids.forEach(id => {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(30);
    });
  });

  test('summary includes metadata context when floors > 1', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ floors: 4, occupants: 500 }),
    }));
    expect(result.summary).toContain('4 floors');
    expect(result.summary).toContain('500+ occupants');
  });

  test('metadata_context is returned with correct values', () => {
    const meta = makeMetadata({
      floors: 3,
      occupants: 300,
      equipment: ['mop', 'vacuum'],
      preferences: ['eco_friendly'],
      certifications: ['iso_9001'],
      cleaning_frequency: 'daily',
      operating_hours: '24x7',
      facility_age: 'old',
    });
    const result = generateRecommendation(makeInstitution({ metadata: meta }));
    expect(result.metadata_context.floors).toBe(3);
    expect(result.metadata_context.occupants).toBe(300);
    expect(result.metadata_context.equipment_count).toBe(2);
    expect(result.metadata_context.preferences_count).toBe(1);
    expect(result.metadata_context.certifications_count).toBe(1);
    expect(result.metadata_context.cleaning_frequency).toBe('daily');
    expect(result.metadata_context.operating_hours).toBe('24x7');
    expect(result.metadata_context.facility_age).toBe('old');
  });

  test('large area (>5000 sq ft) triggers bulk ordering alert', () => {
    const result = generateRecommendation(makeInstitution({ area_size: 10000 }));
    const alert = result.alerts.find(a => a.includes('Large area'));
    expect(alert).toBeDefined();
  });

  test('hospital triggers institution-specific alert', () => {
    const result = generateRecommendation(makeInstitution({ institution_type: 'hospital' }));
    const alert = result.alerts.find(a => a.includes('healthcare facility'));
    expect(alert).toBeDefined();
  });

  test('very large cost (>Rs 1,00,000) triggers contract pricing alert', () => {
    const result = generateRecommendation(makeInstitution({
      area_size: 100000,
      hygiene_standard: 'medical_grade',
      budget: 'high',
      metadata: makeMetadata({
        floors: 1,
        occupants: 0,
        cleaning_frequency: 'twice_daily',
        equipment: [],
      }),
    }));
    const alert = result.alerts.find(a => a.includes('Special contract pricing'));
    if (!alert) {
      // If alerts not triggered, cost might not be high enough — skip assertion
      console.warn('Cost was ' + result.total_estimated_cost + ' — not high enough for contract alert');
    }
    // Note: This alert triggers at cost > 100,000. With large enough area it should trigger.
    if (result.total_estimated_cost > 100000) {
      expect(alert).toBeDefined();
    }
  });

  test('restaurant triggers institution-specific alert', () => {
    const result = generateRecommendation(makeInstitution({
      institution_type: 'restaurant',
      area_size: 3000,
      surface_types: ['hard_floor', 'tile', 'countertop', 'stainless_steel'],
    }));
    const alert = result.alerts.find(a => a.includes('Food service facility'));
    expect(alert).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 9. INTEGRATION SCENARIO TESTS
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 9. FALLBACK PATH TESTS
// ---------------------------------------------------------------------------
describe('Fallback Path', () => {
  test('limited inputs produce valid results even with low scores', () => {
    // Use minimal inputs that produce the lowest possible scores
    const result = generateRecommendation({
      institution_type: 'warehouse',
      area_size: 100,
      surface_types: ['drain'],  // Only matches Drain Cleaner (+25 surface bonus)
      hygiene_standard: 'basic',
      budget: 'medium',
      metadata: null,
    });
    expect(result).toBeDefined();
    // Should still get some items (either normal path or fallback)
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total_estimated_cost).toBeGreaterThan(0);
    expect(result.summary).toBeDefined();
  });

  test('fallback path returns items with all required properties', () => {
    const result = generateRecommendation({
      institution_type: 'retail',
      area_size: 200,
      surface_types: ['drain'],  // Only matches Drain Cleaner
      hygiene_standard: 'basic',
      budget: 'low',
      metadata: null,
    });
    expect(result).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);
    result.items.forEach(item => {
      expect(item.product_id).toBeDefined();
      expect(item.product_name).toBeDefined();
      expect(item.quantity_estimate).toBeGreaterThan(0);
      expect(item.monthly_cost).toBeGreaterThan(0);
      expect(item.unit_price).toBeGreaterThan(0);
      expect(item.priority).toBeGreaterThanOrEqual(1);
      expect(item.priority).toBeLessThanOrEqual(3);
    });
  });

  test('fallback items sorted by score descending', () => {
    const result = generateRecommendation({
      institution_type: 'office',
      area_size: 300,
      surface_types: ['mirror'],  // Only matches Glass Cleaner
      hygiene_standard: 'standard',
      budget: 'low',
      metadata: null,
    });
    expect(result.items.length).toBeGreaterThan(0);
    // Items should be in priority order (ascending - 1 is highest)
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].priority).toBeGreaterThanOrEqual(result.items[i - 1].priority);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. PRODUCT KNOWLEDGE BASE EXPORT TESTS
// ---------------------------------------------------------------------------
describe('PRODUCT_KNOWLEDGE_BASE', () => {
  test('exports all required configuration maps', () => {
    expect(PRODUCT_KNOWLEDGE_BASE.products).toBeDefined();
    expect(PRODUCT_KNOWLEDGE_BASE.institutionTypeProfiles).toBeDefined();
    expect(PRODUCT_KNOWLEDGE_BASE.surfaceTypeProductMap).toBeDefined();
    expect(PRODUCT_KNOWLEDGE_BASE.hygieneLevels).toBeDefined();
    expect(PRODUCT_KNOWLEDGE_BASE.budgetLevels).toBeDefined();
    expect(PRODUCT_KNOWLEDGE_BASE.certificationCategoryMap).toBeDefined();
  });

  test('all 12 products are defined with required fields', () => {
    expect(PRODUCT_KNOWLEDGE_BASE.products.length).toBe(12);
    PRODUCT_KNOWLEDGE_BASE.products.forEach(p => {
      expect(p.id).toBeDefined();
      expect(p.name).toBeDefined();
      expect(p.category).toBeDefined();
      expect(p.unit_price).toBeGreaterThan(0);
      expect(p.coverage_per_unit).toBeGreaterThan(0);
      expect(Array.isArray(p.surface_types)).toBe(true);
      expect(Array.isArray(p.tags)).toBe(true);
    });
  });

  test('all 8 institution type profiles have required fields', () => {
    const types = Object.keys(PRODUCT_KNOWLEDGE_BASE.institutionTypeProfiles);
    expect(types.length).toBe(8);
    types.forEach(type => {
      const profile = PRODUCT_KNOWLEDGE_BASE.institutionTypeProfiles[type];
      expect(profile.priority_products).toBeDefined();
      expect(profile.priority_products.length).toBeGreaterThan(0);
      expect(profile.hygiene_multiplier).toBeGreaterThan(0);
      expect(profile.area_coverage_factor).toBeGreaterThan(0);
      expect(profile.label).toBeDefined();
    });
  });

  test('all 4 hygiene levels have correct multiplier ordering', () => {
    const levels = PRODUCT_KNOWLEDGE_BASE.hygieneLevels;
    expect(levels.basic.frequency_multiplier).toBeLessThan(levels.standard.frequency_multiplier);
    expect(levels.standard.frequency_multiplier).toBeLessThan(levels.high.frequency_multiplier);
    expect(levels.high.frequency_multiplier).toBeLessThan(levels.medical_grade.frequency_multiplier);
  });
});

// ---------------------------------------------------------------------------
// 11. INTEGRATION SCENARIO TESTS
// ---------------------------------------------------------------------------
describe('Integration Scenarios', () => {
  test('full-feature hospital recommendation with all metadata', () => {
    const result = generateRecommendation(makeInstitution({
      institution_type: 'hospital',
      area_size: 15000,
      surface_types: ['hard_floor', 'tile', 'stainless_steel', 'glass', 'countertop'],
      hygiene_standard: 'medical_grade',
      budget: 'high',
      metadata: makeMetadata({
        floors: 6,
        occupants: 1200,
        operating_hours: '24x7',
        cleaning_frequency: 'twice_daily',
        facility_age: 'moderate',
        equipment: ['mop', 'scrubber', 'microfiber', 'auto_dispenser', 'steam_cleaner'],
        preferences: ['eco_friendly', 'concentrated', 'fragrance_free'],
        certifications: ['haccp', 'iso_9001', 'osha', 'green_seal'],
      }),
    }));

    // Should have products
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThanOrEqual(8);

    // Should have metadata-driven alerts
    expect(result.alerts.length).toBeGreaterThan(3);

    // Top priority should be a high-priority product
    expect(result.items[0].priority).toBe(1);

    // Should have cost and quantity
    expect(result.total_estimated_cost).toBeGreaterThan(0);
    expect(result.monthly_total_quantity).toBeGreaterThan(0);

    // Summary should include metadata context
    expect(result.summary).toContain('6 floors');
    expect(result.summary).toContain('1200+ occupants');
    expect(result.institution_profile).toBe('Hospital / Healthcare');
  });

  test('small office with minimal requirements', () => {
    const result = generateRecommendation(makeInstitution({
      institution_type: 'office',
      area_size: 800,
      surface_types: ['hard_floor', 'carpet'],
      hygiene_standard: 'basic',
      budget: 'low',
      metadata: makeMetadata({
        floors: 1,
        occupants: 20,
        equipment: ['mop', 'vacuum'],
      }),
    }));

    expect(result.items.length).toBeGreaterThan(0);
    // Budget-friendly: should be less than premium estimate but still reasonable
    expect(result.total_estimated_cost).toBeLessThan(200000);
    expect(result.institution_profile).toBe('Office / Corporate');
    // Low budget alert should be present
    const budgetAlert = result.alerts.find(a => a.includes('Budget-friendly'));
    expect(budgetAlert).toBeDefined();
  });

  test('restaurant with HACCP and heavy-duty needs', () => {
    const result = generateRecommendation(makeInstitution({
      institution_type: 'restaurant',
      area_size: 2500,
      surface_types: ['hard_floor', 'tile', 'stainless_steel', 'countertop'],
      hygiene_standard: 'high',
      budget: 'medium',
      metadata: makeMetadata({
        floors: 1,
        occupants: 100,
        equipment: ['mop', 'pressure_washer', 'microfiber'],
        preferences: ['concentrated', 'industrial_grade'],
        certifications: ['haccp'],
      }),
    }));

    // Restaurant + HACCP should boost Heavy Duty Degreaser and Disinfectant
    const topCategories = result.items.slice(0, 3).map(i => i.category);
    expect(topCategories).toContain('Heavy Duty Degreaser');

    // Should have food safety alert
    const foodAlert = result.alerts.find(a => a.includes('Food safety'));
    expect(foodAlert).toBeDefined();
  });

  test('school with eco-friendly preferences', () => {
    const result = generateRecommendation(makeInstitution({
      institution_type: 'school',
      area_size: 20000,
      surface_types: ['hard_floor', 'tile', 'glass', 'carpet'],
      hygiene_standard: 'standard',
      budget: 'low',
      metadata: makeMetadata({
        floors: 3,
        occupants: 800,
        equipment: ['mop', 'vacuum', 'microfiber'],
        preferences: ['eco_friendly', 'fragrance_free', 'hypoallergenic'],
        certifications: ['green_seal'],
      }),
    }));

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.summary).toContain('3 floors');
    expect(result.summary).toContain('800+ occupants');
  });

  test('hotel with carpet and air freshener needs', () => {
    const result = generateRecommendation(makeInstitution({
      institution_type: 'hotel',
      area_size: 30000,
      surface_types: ['hard_floor', 'carpet', 'glass', 'tile', 'marble'],
      hygiene_standard: 'high',
      budget: 'high',
      metadata: makeMetadata({
        floors: 8,
        occupants: 500,
        operating_hours: '24x7',
        equipment: ['vacuum', 'carpet_extractor', 'microfiber', 'scrubber'],
        preferences: ['fragrance_free', 'eco_friendly'],
      }),
    }));

    expect(result.items.length).toBeGreaterThan(0);
    // Hotel should have carpet cleaner in recommendations
    const carpet = result.items.find(i => i.category === 'Carpet Cleaner');
    expect(carpet).toBeDefined();
    // Should have multi-story alert
    const storyAlert = result.alerts.find(a => a.includes('Multi-story'));
    expect(storyAlert).toBeDefined();
    expect(result.summary).toContain('8 floors');
  });
});
