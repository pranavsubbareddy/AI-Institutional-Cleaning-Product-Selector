// Ganga Maxx Marketplace - Mock Product Catalog
// This serves as an in-memory cache for the matching logic and
// provides full product metadata (SKU, name, price, surface compatibility, safety info)

const MOCK_PRODUCT_CATALOG = [
  {
    id: 'prod-gpc-001',
    sku: 'GPC-5L-001',
    name: 'Ganga Multi-Purpose Cleaner',
    category: 'General Purpose Cleaner',
    surface_compatibility: ['hard_floor', 'tile', 'countertop', 'wall', 'porcelain'],
    base_price_per_unit: 180.00,
    unit_of_measurement: '5L Canister',
    coverage_per_unit: 200,
    standard_dilution_ratio: '1:40 (40ml per litre of water)',
    hazard_statements: 'May cause mild skin irritation. Avoid contact with eyes.',
    usage_guidance: 'Dilute as per ratio. Apply with mop or spray. No rinsing required for most surfaces.',
    msds_url: 'https://ganga-maxx.com/msds/gpc-5l-001',
    hygiene_level: 'standard'
  },
  {
    id: 'prod-dsf-002',
    sku: 'HDS-5L-002',
    name: 'Ganga Hospital-Grade Disinfectant',
    category: 'Disinfectant',
    surface_compatibility: ['hard_floor', 'tile', 'stainless_steel', 'countertop', 'glass'],
    base_price_per_unit: 350.00,
    unit_of_measurement: '5L Canister',
    coverage_per_unit: 150,
    standard_dilution_ratio: '1:20 (50ml per litre of water)',
    hazard_statements: 'DANGER: Corrosive. Causes severe eye and skin burns. Use PPE.',
    usage_guidance: 'Apply diluted solution. Leave for 5-10 min contact time. Rinse thoroughly.',
    msds_url: 'https://ganga-maxx.com/msds/hds-5l-002',
    hygiene_level: 'medical_grade'
  },
  {
    id: 'prod-gls-003',
    sku: 'GLS-5L-003',
    name: 'Ganga Glass & Surface Shine',
    category: 'Glass Cleaner',
    surface_compatibility: ['glass', 'mirror', 'stainless_steel', 'countertop'],
    base_price_per_unit: 220.00,
    unit_of_measurement: '5L Canister',
    coverage_per_unit: 250,
    standard_dilution_ratio: 'Ready-to-use (RTU) — no dilution required',
    hazard_statements: 'May cause irritation. Keep away from children.',
    usage_guidance: 'Spray directly onto surface. Wipe with microfiber cloth for streak-free shine.',
    msds_url: 'https://ganga-maxx.com/msds/gls-5l-003',
    hygiene_level: 'standard'
  },
  {
    id: 'prod-flr-004',
    sku: 'FLR-5L-004',
    name: 'Ganga Floor Shine Pro',
    category: 'Floor Cleaner',
    surface_compatibility: ['hard_floor', 'tile', 'marble', 'wood', 'vinyl'],
    base_price_per_unit: 280.00,
    unit_of_measurement: '5L Canister',
    coverage_per_unit: 180,
    standard_dilution_ratio: '1:30 (33ml per litre of water)',
    hazard_statements: 'Slippery when wet. Use caution on polished surfaces.',
    usage_guidance: 'Dilute and apply with mop. Do not rinse — let air dry for glossy finish.',
    msds_url: 'https://ganga-maxx.com/msds/flr-5l-004',
    hygiene_level: 'high'
  },
  {
    id: 'prod-crp-005',
    sku: 'CRP-5L-005',
    name: 'Ganga Carpet Fresh Powder',
    category: 'Carpet Cleaner',
    surface_compatibility: ['carpet', 'upholstery', 'fabric'],
    base_price_per_unit: 420.00,
    unit_of_measurement: '5Kg Bag',
    coverage_per_unit: 100,
    standard_dilution_ratio: '1:15 (65g per litre of warm water)',
    hazard_statements: 'Avoid inhalation of dust. Use in well-ventilated area.',
    usage_guidance: 'Dissolve in warm water. Apply with carpet brush or machine. Extract foam after 10 min.',
    msds_url: 'https://ganga-maxx.com/msds/crp-5l-005',
    hygiene_level: 'standard'
  }
];

module.exports = { MOCK_PRODUCT_CATALOG };
