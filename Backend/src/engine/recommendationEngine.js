const { v4: uuidv4 } = require('uuid');

const PRODUCT_KNOWLEDGE_BASE = {
  products: [
    {
      id: 'prod-gpc-001', name: 'Multi-Purpose Cleaner', category: 'General Purpose Cleaner',
      surface_types: ['hard_floor', 'tile', 'countertop'], dilution_ratio: '1:40 (40ml per litre)',
      unit: 'litre', unit_price: 180, coverage_per_unit: 40, hygiene_level: 'standard',
      safety_notes: 'Wear gloves. Avoid contact with eyes. Keep away from children.',
      usage_guidance: 'Dilute 40ml in 1 litre of water. Apply with mop or cloth. No rinsing required.',
      tags: ['eco_friendly', 'concentrated', 'fragrance_free'],
      equipment: ['mop', 'microfiber', 'scrubber', 'steam_cleaner'],
      certifications_hint: 'green_seal'
    },
    {
      id: 'prod-dsf-002', name: 'Hospital-Grade Disinfectant', category: 'Disinfectant',
      surface_types: ['hard_floor', 'tile', 'stainless_steel', 'countertop'], dilution_ratio: '1:20 (50ml per litre)',
      unit: 'litre', unit_price: 350, coverage_per_unit: 30, hygiene_level: 'medical_grade',
      safety_notes: 'Wear gloves and mask. Ensure ventilation. Do not mix with other chemicals.',
      usage_guidance: 'Dilute 50ml in 1 litre of water. Apply and leave for 5 minutes contact time. Rinse if required.',
      tags: ['concentrated', 'industrial_grade'],
      equipment: ['mop', 'microfiber', 'scrubber'],
      certifications_hint: 'haccp'
    },
    {
      id: 'prod-gls-003', name: 'Glass & Surface Shine', category: 'Glass Cleaner',
      surface_types: ['glass', 'mirror', 'stainless_steel'], dilution_ratio: 'Ready to use',
      unit: 'litre', unit_price: 220, coverage_per_unit: 50, hygiene_level: 'standard',
      safety_notes: 'Spray in well-ventilated area. Avoid spraying on electronics.',
      usage_guidance: 'Spray directly on surface. Wipe with clean microfiber cloth. Buff for shine.',
      tags: ['ready_to_use', 'fragrance_free', 'hypoallergenic'],
      equipment: ['microfiber'],
      certifications_hint: 'green_seal'
    },
    {
      id: 'prod-flr-004', name: 'Floor Shine Pro', category: 'Floor Cleaner',
      surface_types: ['hard_floor', 'tile', 'marble'], dilution_ratio: '1:30 (33ml per litre)',
      unit: 'litre', unit_price: 280, coverage_per_unit: 35, hygiene_level: 'standard',
      safety_notes: 'May make floor slippery. Use caution signs during cleaning.',
      usage_guidance: 'Dilute 33ml in 1 litre of water. Mop floor. Allow to air dry.',
      tags: ['concentrated', 'eco_friendly'],
      equipment: ['mop', 'scrubber', 'pressure_washer'],
      certifications_hint: 'iso_14001'
    },
    {
      id: 'prod-crp-005', name: 'Carpet Cleaner Pro', category: 'Carpet Cleaner',
      surface_types: ['carpet'], dilution_ratio: '1:15 (65ml per litre)',
      unit: 'litre', unit_price: 420, coverage_per_unit: 20, hygiene_level: 'standard',
      safety_notes: 'Test on inconspicuous area first. Ensure carpet dries completely.',
      usage_guidance: 'Dilute 65ml in 1 litre of warm water. Apply with carpet brush or machine. Extract and dry.',
      tags: ['concentrated', 'fragrance_free'],
      equipment: ['vacuum', 'carpet_extractor'],
      certifications_hint: null
    },
    {
      id: 'prod-stl-006', name: 'Stainless Steel Polish', category: 'Stainless Steel Polish',
      surface_types: ['stainless_steel'], dilution_ratio: 'Ready to use',
      unit: 'litre', unit_price: 380, coverage_per_unit: 60, hygiene_level: 'standard',
      safety_notes: 'Flammable. Keep away from heat sources. Use in ventilated area.',
      usage_guidance: 'Apply small amount on soft cloth. Rub in direction of grain. Buff to shine.',
      tags: ['ready_to_use', 'fragrance_free'],
      equipment: ['microfiber'],
      certifications_hint: null
    },
    {
      id: 'prod-wpd-007', name: 'Wood Polish Premium', category: 'Wood Polish',
      surface_types: ['wood'], dilution_ratio: 'Ready to use',
      unit: 'litre', unit_price: 450, coverage_per_unit: 55, hygiene_level: 'standard',
      safety_notes: 'Flammable. Keep away from open flames. Use gloves.',
      usage_guidance: 'Shake well. Apply with soft cloth in circular motions. Buff after 5 minutes.',
      tags: ['ready_to_use', 'eco_friendly'],
      equipment: ['microfiber'],
      certifications_hint: null
    },
    {
      id: 'prod-tlt-008', name: 'Toilet & Restroom Cleaner', category: 'Toilet Cleaner',
      surface_types: ['tile', 'porcelain'], dilution_ratio: 'Ready to use',
      unit: 'litre', unit_price: 200, coverage_per_unit: 25, hygiene_level: 'standard',
      safety_notes: 'Do not mix with bleach or acidic cleaners. Use gloves.',
      usage_guidance: 'Apply directly under rim and on surfaces. Let sit for 5 minutes. Scrub and flush.',
      tags: ['ready_to_use', 'fragrance_free'],
      equipment: ['mop', 'microfiber'],
      certifications_hint: null
    },
    {
      id: 'prod-hnd-009', name: 'Hand Sanitizer Gel', category: 'Hand Sanitizer',
      surface_types: ['skin'], dilution_ratio: 'Ready to use',
      unit: 'litre', unit_price: 160, coverage_per_unit: 100, hygiene_level: 'high',
      safety_notes: 'For external use only. Flammable. Keep away from children.',
      usage_guidance: 'Apply small amount on palm. Rub hands together until dry.',
      tags: ['ready_to_use', 'fragrance_free', 'hypoallergenic'],
      equipment: ['auto_dispenser'],
      certifications_hint: 'osha'
    },
    {
      id: 'prod-hdd-010', name: 'Heavy Duty Degreaser', category: 'Heavy Duty Degreaser',
      surface_types: ['hard_floor', 'stainless_steel', 'tile', 'countertop'], dilution_ratio: '1:10 (100ml per litre)',
      unit: 'litre', unit_price: 320, coverage_per_unit: 15, hygiene_level: 'standard',
      safety_notes: 'Wear protective gloves and goggles. Avoid prolonged skin contact.',
      usage_guidance: 'Dilute 100ml in 1 litre of water. Apply and scrub. Rinse thoroughly with water.',
      tags: ['concentrated', 'industrial_grade'],
      equipment: ['mop', 'scrubber', 'pressure_washer', 'steam_cleaner'],
      certifications_hint: 'haccp'
    },
    {
      id: 'prod-bio-011', name: 'Bio-Enzymatic Drain Cleaner', category: 'Drain Cleaner',
      surface_types: ['drain'], dilution_ratio: 'Ready to use',
      unit: 'litre', unit_price: 290, coverage_per_unit: 10, hygiene_level: 'standard',
      safety_notes: 'Non-toxic and biodegradable. Safe for septic systems.',
      usage_guidance: 'Pour 250ml down drain weekly. Let sit overnight for best results.',
      tags: ['eco_friendly', 'ready_to_use', 'hypoallergenic'],
      equipment: [],
      certifications_hint: 'green_seal'
    },
    {
      id: 'prod-air-012', name: 'Air Freshener Mist', category: 'Air Freshener',
      surface_types: ['air'], dilution_ratio: 'Ready to use',
      unit: 'litre', unit_price: 190, coverage_per_unit: 80, hygiene_level: 'standard',
      safety_notes: 'Pressurized container. Do not puncture. Keep away from heat.',
      usage_guidance: 'Spray 2-3 times in room as needed. Reapply every 4-6 hours.',
      tags: ['ready_to_use', 'fragrance_free'],
      equipment: [],
      certifications_hint: null
    }
  ],

  institutionTypeProfiles: {
    hospital: {
      priority_products: ['Disinfectant', 'Hand Sanitizer', 'General Purpose Cleaner', 'Floor Cleaner', 'Toilet Cleaner'],
      type_bonus: { 'Disinfectant': 40, 'Hand Sanitizer': 30, 'General Purpose Cleaner': 15, 'Floor Cleaner': 10, 'Toilet Cleaner': 10 },
      category_qty_multiplier: { 'Disinfectant': 2.0, 'Hand Sanitizer': 1.8, 'Toilet Cleaner': 1.5 },
      hygiene_multiplier: 1.5, area_coverage_factor: 0.3, label: 'Hospital / Healthcare',
      alert: 'Critical healthcare facility: Ensure all disinfectants meet health board standards. Maintain log of cleaning activities.'
    },
    school: {
      priority_products: ['Disinfectant', 'Hand Sanitizer', 'General Purpose Cleaner', 'Floor Cleaner', 'Glass Cleaner'],
      type_bonus: { 'Disinfectant': 30, 'Hand Sanitizer': 25, 'General Purpose Cleaner': 20, 'Floor Cleaner': 10, 'Glass Cleaner': 8 },
      category_qty_multiplier: { 'Hand Sanitizer': 1.6, 'Disinfectant': 1.3, 'General Purpose Cleaner': 1.2 },
      hygiene_multiplier: 1.2, area_coverage_factor: 0.25, label: 'School / Educational',
      alert: 'Educational facility: Prioritize non-toxic, child-safe cleaning products. Focus on high-touch surface disinfection.'
    },
    hotel: {
      priority_products: ['General Purpose Cleaner', 'Glass Cleaner', 'Carpet Cleaner', 'Toilet Cleaner', 'Air Freshener', 'Floor Cleaner'],
      type_bonus: { 'Carpet Cleaner': 35, 'Glass Cleaner': 30, 'Air Freshener': 25, 'Toilet Cleaner': 20, 'General Purpose Cleaner': 15, 'Floor Cleaner': 10 },
      category_qty_multiplier: { 'Carpet Cleaner': 2.0, 'Glass Cleaner': 1.5, 'Air Freshener': 1.8, 'Toilet Cleaner': 1.4 },
      hygiene_multiplier: 1.3, area_coverage_factor: 0.35, label: 'Hotel / Hospitality',
      alert: 'Hospitality facility: Guest experience depends on cleanliness. Prioritize glass shine, carpet freshness, and pleasant ambiance.'
    },
    office: {
      priority_products: ['General Purpose Cleaner', 'Glass Cleaner', 'Hand Sanitizer', 'Floor Cleaner', 'Air Freshener'],
      type_bonus: { 'General Purpose Cleaner': 25, 'Glass Cleaner': 20, 'Hand Sanitizer': 18, 'Floor Cleaner': 12, 'Air Freshener': 10 },
      category_qty_multiplier: { 'General Purpose Cleaner': 1.3, 'Hand Sanitizer': 1.5, 'Air Freshener': 1.2 },
      hygiene_multiplier: 1.0, area_coverage_factor: 0.2, label: 'Office / Corporate',
      alert: 'Corporate facility: Maintain professional appearance. Focus on common areas, restrooms, and break rooms.'
    },
    restaurant: {
      priority_products: ['Heavy Duty Degreaser', 'Disinfectant', 'Floor Cleaner', 'General Purpose Cleaner', 'Toilet Cleaner'],
      type_bonus: { 'Heavy Duty Degreaser': 45, 'Disinfectant': 35, 'Floor Cleaner': 20, 'General Purpose Cleaner': 15, 'Toilet Cleaner': 10 },
      category_qty_multiplier: { 'Heavy Duty Degreaser': 2.5, 'Disinfectant': 1.6, 'Floor Cleaner': 1.4, 'General Purpose Cleaner': 1.3 },
      hygiene_multiplier: 1.4, area_coverage_factor: 0.4, label: 'Restaurant / Food Service',
      alert: 'Food service facility: All cleaning products must be food-safe. Heavy degreasing required for kitchen areas. Comply with health department regulations.'
    },
    factory: {
      priority_products: ['Heavy Duty Degreaser', 'Floor Cleaner', 'General Purpose Cleaner', 'Hand Sanitizer', 'Drain Cleaner'],
      type_bonus: { 'Heavy Duty Degreaser': 40, 'Drain Cleaner': 30, 'Floor Cleaner': 25, 'General Purpose Cleaner': 15, 'Hand Sanitizer': 10 },
      category_qty_multiplier: { 'Heavy Duty Degreaser': 2.0, 'Drain Cleaner': 1.8, 'Floor Cleaner': 1.5 },
      hygiene_multiplier: 1.1, area_coverage_factor: 0.3, label: 'Factory / Industrial',
      alert: 'Industrial facility: Heavy-duty cleaning required for machinery areas. Ensure proper ventilation when using industrial cleaners.'
    },
    warehouse: {
      priority_products: ['Floor Cleaner', 'General Purpose Cleaner', 'Heavy Duty Degreaser'],
      type_bonus: { 'Floor Cleaner': 35, 'General Purpose Cleaner': 25, 'Heavy Duty Degreaser': 15 },
      category_qty_multiplier: { 'Floor Cleaner': 1.6, 'General Purpose Cleaner': 1.3 },
      hygiene_multiplier: 0.8, area_coverage_factor: 0.15, label: 'Warehouse / Storage',
      alert: 'Warehouse facility: Focus on floor maintenance and dust control. Large areas benefit from mechanical scrubbers.'
    },
    retail: {
      priority_products: ['Glass Cleaner', 'Floor Cleaner', 'General Purpose Cleaner', 'Air Freshener'],
      type_bonus: { 'Glass Cleaner': 35, 'Floor Cleaner': 25, 'General Purpose Cleaner': 20, 'Air Freshener': 15 },
      category_qty_multiplier: { 'Glass Cleaner': 1.6, 'Floor Cleaner': 1.4, 'Air Freshener': 1.5 },
      hygiene_multiplier: 1.0, area_coverage_factor: 0.2, label: 'Retail / Store',
      alert: 'Retail facility: First impressions matter. Prioritize clean windows, floors, and pleasant in-store scent.'
    }
  },

  surfaceTypeProductMap: {
    hard_floor: ['Floor Cleaner', 'General Purpose Cleaner'],
    carpet: ['Carpet Cleaner'],
    glass: ['Glass Cleaner'],
    tile: ['Floor Cleaner', 'General Purpose Cleaner', 'Toilet Cleaner'],
    stainless_steel: ['Stainless Steel Polish', 'Glass Cleaner'],
    wood: ['Wood Polish'],
    marble: ['Floor Cleaner'],
    countertop: ['General Purpose Cleaner', 'Disinfectant'],
    porcelain: ['Toilet Cleaner'],
    mirror: ['Glass Cleaner'],
    drain: ['Drain Cleaner'],
    air: ['Air Freshener']
  },

  hygieneLevels: {
    basic: { frequency_multiplier: 0.6, dilution_factor: 0.8, label: 'Basic' },
    standard: { frequency_multiplier: 1.0, dilution_factor: 1.0, label: 'Standard' },
    high: { frequency_multiplier: 1.5, dilution_factor: 1.2, label: 'High' },
    medical_grade: { frequency_multiplier: 2.0, dilution_factor: 1.5, label: 'Medical Grade' }
  },

  budgetLevels: {
    low: { price_multiplier: 0.8, product_tier: 'economy', label: 'Low' },
    medium: { price_multiplier: 1.0, product_tier: 'standard', label: 'Medium' },
    high: { price_multiplier: 1.3, product_tier: 'premium', label: 'High' }
  },

  // Certification impact: boosts certain product types
  certificationCategoryMap: {
    iso_9001: [], // Quality management - general boost
    iso_14001: [], // Environmental - boost eco-friendly (handled via tags)
    haccp: ['Disinfectant', 'Heavy Duty Degreaser', 'General Purpose Cleaner'],
    gmp: ['Disinfectant', 'Hand Sanitizer', 'General Purpose Cleaner'],
    osha: ['Hand Sanitizer', 'Disinfectant', 'General Purpose Cleaner'],
    green_seal: [] // Eco-friendly (handled via tags)
  }
};

/**
 * Generate recommendations based on institution data including metadata
 * @param {Object} institutionData
 * @param {Object} [institutionData.metadata] - Optional metadata with floors, equipment, preferences, certifications
 */
function generateRecommendation(institutionData) {
  const instType = institutionData.institution_type;
  const areaSize = institutionData.area_size;
  const surfaceTypes = institutionData.surface_types || [];
  const hygieneStandard = institutionData.hygiene_standard || 'standard';
  const budget = institutionData.budget || 'medium';
  const metadata = institutionData.metadata || {};

  // Extract metadata with defaults
  const equipment = metadata.equipment || [];
  const preferences = metadata.preferences || [];
  const certifications = metadata.certifications || [];
  const floors = metadata.floors || 1;
  const occupants = metadata.occupants || 0;
  const operatingHours = metadata.operating_hours || 'day';
  const cleaningFrequency = metadata.cleaning_frequency || 'daily';
  const facilityAge = metadata.facility_age || 'moderate';

  const profile = PRODUCT_KNOWLEDGE_BASE.institutionTypeProfiles[instType] || PRODUCT_KNOWLEDGE_BASE.institutionTypeProfiles.office;
  const hygieneConfig = PRODUCT_KNOWLEDGE_BASE.hygieneLevels[hygieneStandard] || PRODUCT_KNOWLEDGE_BASE.hygieneLevels.standard;
  const budgetConfig = PRODUCT_KNOWLEDGE_BASE.budgetLevels[budget] || PRODUCT_KNOWLEDGE_BASE.budgetLevels.medium;

  const scoredProducts = PRODUCT_KNOWLEDGE_BASE.products.map(product => {
    let score = 0;

    // --- Institution-type-specific scoring (highly differentiated) ---
    // 1. Type bonus: massive boost for key products per institution type
    const typeBonus = profile.type_bonus?.[product.category] || 0;
    score += typeBonus;

    // 2. Priority position bonus: extra points based on order in priority list
    const typePriorityIndex = profile.priority_products.indexOf(product.category);
    if (typePriorityIndex >= 0) {
      // Higher bonus for higher-priority items: 20, 15, 10, 8, 6, 4...
      const posBonus = Math.max(20 - typePriorityIndex * 5, 4);
      score += posBonus;
    }

    // --- Surface compatibility ---
    const surfaceMatch = surfaceTypes.some(s => product.surface_types.includes(s));
    if (surfaceMatch) score += 25;

    // --- Hygiene level scoring ---
    const productHygieneLevel = product.hygiene_level || 'standard';
    const hygieneLevels = ['basic', 'standard', 'high', 'medical_grade'];
    const requiredIndex = hygieneLevels.indexOf(hygieneStandard);
    const productIndex = hygieneLevels.indexOf(productHygieneLevel);
    if (productIndex >= requiredIndex) {
      score += 10;
    } else if (hygieneStandard === 'medical_grade' && product.category === 'Disinfectant') {
      score += 20;
    }

    // --- Budget scoring ---
    if (budget === 'low' && product.unit_price <= 250) score += 10;
    if (budget === 'medium' && product.unit_price > 200 && product.unit_price <= 400) score += 5;
    if (budget === 'high' && product.unit_price > 350) score += 10;

    // --- Metadata-based scoring ---

    // Equipment compatibility: boost products compatible with available equipment
    const compatibleEquipment = product.equipment || [];
    if (equipment.length > 0 && compatibleEquipment.length > 0) {
      const matchingEquipment = compatibleEquipment.filter(eq => equipment.includes(eq));
      if (matchingEquipment.length > 0) {
        // +10 for having compatible equipment, +5 for each additional match
        score += 10 + (matchingEquipment.length - 1) * 5;
      }
    }

    // Preference matching: boost products with matching tags
    if (preferences.length > 0) {
      const productTags = product.tags || [];
      const matchingPreferences = preferences.filter(p => productTags.includes(p));
      if (matchingPreferences.length > 0) {
        score += matchingPreferences.length * 12;
      }
    }

    // Certification impact: boost products matching certification requirements
    if (certifications.length > 0) {
      for (const cert of certifications) {
        const boostedCategories = PRODUCT_KNOWLEDGE_BASE.certificationCategoryMap[cert] || [];
        if (boostedCategories.length === 0) {
          // General certifications (ISO 9001, ISO 14001, Green Seal) get a small general boost
          if (cert === 'green_seal' && (product.tags || []).includes('eco_friendly')) {
            score += 8;
          } else if (cert === 'iso_14001' && (product.tags || []).includes('eco_friendly')) {
            score += 6;
          } else if (cert === 'iso_9001') {
            score += 4; // General quality boost
          } else if (cert === 'osha' && product.safety_notes) {
            score += 5; // Safety compliance
          }
        } else if (boostedCategories.includes(product.category)) {
          score += 10;
        }
      }
    }

    // Operating hours adjustment: 24x7 facilities need more robust products
    if (operatingHours === '24x7' && (product.hygiene_level === 'high' || product.hygiene_level === 'medical_grade')) {
      score += 5;
    }

    // Facility age: older facilities may need more heavy-duty products
    if (facilityAge === 'old' || facilityAge === 'vintage') {
      if (product.category === 'Heavy Duty Degreaser' || product.category === 'Floor Cleaner') {
        score += 8;
      }
    }

    return { product, score };
  });

  scoredProducts.sort((a, b) => b.score - a.score);
  const topProducts = scoredProducts.filter(p => p.score > 10).slice(0, 8);

  if (topProducts.length === 0) {
    const fallback = scoredProducts.slice(0, 3);
    return buildRecommendationOutput(fallback, areaSize, hygieneConfig, budgetConfig, profile, metadata, instType);
  }

  return buildRecommendationOutput(topProducts, areaSize, hygieneConfig, budgetConfig, profile, metadata, instType);
}

function buildRecommendationOutput(scoredProducts, areaSize, hygieneConfig, budgetConfig, profile, metadata = {}, instType) {
  const items = [];
  let totalCost = 0;
  let totalQuantity = 0;
  const alerts = [];

  const equipment = metadata.equipment || [];
  const floors = metadata.floors || 1;
  const occupants = metadata.occupants || 0;
  const preferences = metadata.preferences || [];
  const certifications = metadata.certifications || [];
  const cleaningFrequency = metadata.cleaning_frequency || 'daily';

  // Calculate per-floor area for multi-story buildings
  const areaPerFloor = areaSize / Math.max(floors, 1);

  // Equipment efficiency multiplier: having the right equipment reduces quantity needed
  let equipmentEfficiency = 1.0;
  if (equipment.includes('scrubber') || equipment.includes('pressure_washer') || equipment.includes('steam_cleaner')) {
    equipmentEfficiency = 0.85; // 15% reduction in product usage
  } else if (equipment.includes('mop') && equipment.includes('vacuum')) {
    equipmentEfficiency = 0.92;
  }

  // Frequency adjustment based on cleaning frequency
  let frequencyAdjustment = 1.0;
  switch (cleaningFrequency) {
    case 'twice_daily': frequencyAdjustment = 1.8; break;
    case 'daily': frequencyAdjustment = 1.0; break;
    case 'multiple_weekly': frequencyAdjustment = 0.7; break;
    case 'weekly': frequencyAdjustment = 0.4; break;
    case 'custom': frequencyAdjustment = 0.6; break;
  }

  // Occupant density factor: more people = more cleaning needed
  const occupantDensity = occupants > 0 ? Math.max(1, occupants / (areaSize / 100)) : 1;
  const occupantFactor = 0.8 + (occupantDensity * 0.2); // 0.8x to 1.6x based on density

  scoredProducts.forEach(({ product, score }) => {
    const baseQuantity = areaPerFloor / (product.coverage_per_unit || 20);
    const frequencyMultiplier = hygieneConfig.frequency_multiplier;
    const priceMultiplier = budgetConfig.price_multiplier;

    // Apply category-specific quantity multiplier per institution type
    const categoryQtyMult = profile.category_qty_multiplier?.[product.category] || 1.0;

    // Apply equipment efficiency to quantity
    const adjustedQuantity = Math.ceil(
      baseQuantity * frequencyMultiplier * 4 * equipmentEfficiency * frequencyAdjustment * occupantFactor * categoryQtyMult
    );
    
    const monthlyCost = Math.round(adjustedQuantity * product.unit_price * priceMultiplier);

    totalQuantity += adjustedQuantity;
    totalCost += monthlyCost;

    // Custom usage guidance based on available equipment
    let usageGuidance = product.usage_guidance;
    if (equipment.includes('auto_dispenser') && product.category === 'Hand Sanitizer') {
      usageGuidance = 'Fill auto-dispenser units. Dilute as needed. Ensure dispensers are checked daily.';
    } else if (equipment.includes('scrubber') && (product.category === 'Floor Cleaner' || product.category === 'General Purpose Cleaner')) {
      usageGuidance = 'Use with floor scrubber machine for optimal coverage. ' + product.usage_guidance;
    } else if (equipment.includes('pressure_washer') && product.category === 'Heavy Duty Degreaser') {
      usageGuidance = 'Apply diluted solution, agitate with pressure washer. Rinse thoroughly.';
    }

    items.push({
      id: uuidv4(),
      product_id: product.id,
      product_name: product.name,
      category: product.category,
      quantity_estimate: adjustedQuantity,
      unit: product.unit,
      dilution_ratio: product.dilution_ratio,
      monthly_cost: monthlyCost,
      unit_price: Math.round(product.unit_price * priceMultiplier),
      coverage_per_unit: product.coverage_per_unit,
      usage_guidance: usageGuidance,
      safety_notes: product.safety_notes,
      priority: score > 50 ? 1 : score > 25 ? 2 : 3,
      usage_frequency: hygieneConfig.frequency_multiplier >= 1.5 ? 'Daily' : hygieneConfig.frequency_multiplier >= 1.0 ? '3-4 times/week' : '1-2 times/week',
      score
    });
  });

  items.sort((a, b) => a.priority - b.priority);

  // --- Institution-type-specific alert (always shown) ---
  if (profile.alert) {
    alerts.push(profile.alert);
  }

  // --- Enhanced alerts based on metadata ---
  if (hygieneConfig.frequency_multiplier >= 1.5) {
    alerts.push('High hygiene standard detected: Increase cleaning frequency and use appropriate PPE.');
  }
  if (areaSize > 5000) {
    alerts.push('Large area detected: Consider bulk ordering for cost savings. Tier discounts available for orders over 50 units.');
  }
  if (budgetConfig.price_multiplier <= 0.8) {
    alerts.push('Budget-friendly options selected: Economy products provide adequate cleanliness at reduced cost.');
  }
  if (totalCost > 100000) {
    alerts.push('Estimated monthly cost exceeds Rs 1,00,000: Special contract pricing may be available. Contact sales for negotiation.');
  }

  // Metadata-driven alerts
  if (floors > 3) {
    alerts.push('Multi-story facility (' + floors + ' floors): Consider placing cleaning stations on each floor for efficiency.');
  }
  if (occupants > 500) {
    alerts.push('High occupancy (' + occupants + '+ people): Increase hand sanitizer stations and high-touch surface cleaning frequency.');
  }
  if (equipment.length === 0) {
    alerts.push('No cleaning equipment reported: Manual cleaning will require more time and product. Consider investing in basic equipment.');
  }
  if (equipment.includes('auto_dispenser')) {
    alerts.push('Auto-dispenser available: Optimize hand sanitizer and soap usage with bulk refills.');
  }
  if ((preferences || []).includes('eco_friendly')) {
    alerts.push('Eco-friendly preferences detected: Recommended products are selected for environmental compatibility.');
  }
  if ((certifications || []).includes('haccp') || (certifications || []).includes('gmp')) {
    alerts.push('Food safety / GMP certifications detected: Ensure all products used comply with regulatory standards.');
  }
  if ((certifications || []).includes('osha')) {
    alerts.push('OSHA compliance required: Safety data sheets (SDS) will be provided for all recommended products.');
  }
  if (metadata.operating_hours === '24x7') {
    alerts.push('24x7 facility: Schedule cleaning during low-traffic hours to minimize disruption.');
  }
  if (metadata.facility_age === 'old' || metadata.facility_age === 'vintage') {
    alerts.push('Older facility: Heavy-duty cleaning may be needed for aged surfaces and fixtures.');
  }

  // Build enriched summary with institution-type context
  const topProduct = items[0]?.product_name || 'cleaning products';
  const topCategory = items[0]?.category || '';
  let summary = 'Recommended ' + items.length + ' products for ' + profile.label + ' facility of ' + areaSize + ' sq. ft. ';

  // Add facility profile context
  if (floors > 1) summary += floors + ' floors, ';
  if (occupants > 0) summary += occupants + '+ occupants, ';
  if (metadata.operating_hours === '24x7') summary += '24x7 operation, ';

  // Add institution-type-specific recommendation highlight
  summary += 'Top priority: ' + topProduct + '. ';

  // Add contextual note based on institution type
  const typeNotes = {
    hospital: 'Focus on infection control and high-touch surface disinfection.',
    school: 'Emphasis on child-safe, non-toxic products for student safety.',
    hotel: 'Guest satisfaction driven by sparkling glass, fresh carpets, and pleasant scent.',
    office: 'Professional appearance and employee comfort are key priorities.',
    restaurant: 'Kitchen grease management and food-contact surface safety are critical.',
    factory: 'Heavy-duty cleaning for machinery, floors, and drainage systems.',
    warehouse: 'Floor maintenance and dust control for large storage areas.',
    retail: 'Clean windows, floors, and fresh scent create positive customer impressions.'
  };
  if (instType && typeNotes[instType]) {
    summary += typeNotes[metadata.institution_type] + ' ';
  }

  summary += 'Hygiene standard: ' + hygieneConfig.label + '. Budget: ' + budgetConfig.label + '. ' +
    'Monthly estimated cost: Rs ' + totalCost.toLocaleString('en-IN') + '. ' +
    'Total monthly quantity: ' + totalQuantity + ' litres.';

  // Add metadata context to the return object
  return {
    items,
    total_estimated_cost: totalCost,
    monthly_total_quantity: totalQuantity,
    alerts,
    summary,
    institution_profile: profile.label,
    hygiene_level: hygieneConfig.label,
    budget_level: budgetConfig.label,
    metadata_context: {
      floors,
      occupants,
      equipment_count: equipment.length,
      preferences_count: (preferences || []).length,
      certifications_count: (certifications || []).length,
      cleaning_frequency: cleaningFrequency,
      operating_hours: metadata.operating_hours || 'day',
      facility_age: metadata.facility_age || 'moderate'
    }
  };
}

module.exports = { generateRecommendation, PRODUCT_KNOWLEDGE_BASE };
