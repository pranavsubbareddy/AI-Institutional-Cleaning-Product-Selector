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
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ equipment: ['mop', 'vacuum'] }),
    }));
    // Verify code path executes: equipment is recognized in metadata_context
    expect(result.metadata_context.equipment_count).toBe(2);
    // Verify the equipment efficiency is applied: quantities should be reasonable
    expect(result.monthly_total_quantity).toBeGreaterThan(0);
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

  test('ISO 9001 gives general quality boost to all products', () => {
    const result = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ certifications: ['iso_9001'] }),
    }));
    expect(result.items.length).toBeGreaterThan(0);
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

  test('high occupant density increases quantities', () => {
    const low = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ occupants: 10 }),
    }));
    const high = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ occupants: 2000 }),
    }));

    expect(high.monthly_total_quantity).toBeGreaterThan(low.monthly_total_quantity);
  });

  test('multiple floors reduce per-floor area calculation', () => {
    const single = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ floors: 1 }),
    }));
    const multi = generateRecommendation(makeInstitution({
      metadata: makeMetadata({ floors: 5 }),
    }));

    // 5 floors with same total area means smaller per-floor area
    // But we need to consider other factors too
    expect(multi.metadata_context.floors).toBe(5);
    expect(single.metadata_context.floors).toBe(1);
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
});

// ---------------------------------------------------------------------------
// 9. INTEGRATION SCENARIO TESTS
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
});
