require('dotenv').config();

const { initializeSchema, run, queryAll } = require('./schema');
const { PRODUCT_KNOWLEDGE_BASE } = require('../engine/recommendationEngine');

async function seedDatabase() {
  await initializeSchema();

  const existing = await queryAll('SELECT COUNT(*) as count FROM products');
  if (existing.length > 0 && existing[0].count > 0) {
    console.log('Database already seeded. Drop tables or use TRUNCATE to re-seed.');
    return;
  }

  console.log('Seeding database...');

  // Map product IDs to SKUs
  const productIdToSku = {
    'prod-gpc-001': 'GPC-5L-001',
    'prod-dsf-002': 'HDS-5L-002',
    'prod-gls-003': 'GLS-5L-003',
    'prod-flr-004': 'FLR-5L-004',
    'prod-crp-005': 'CRP-5L-005',
    'prod-stl-006': 'STL-5L-006',
    'prod-wpd-007': 'WPD-5L-007',
    'prod-tlt-008': 'TLT-5L-008',
    'prod-hnd-009': 'HND-5L-009',
    'prod-hdd-010': 'HDD-5L-010',
    'prod-bio-011': 'BIO-5L-011',
    'prod-air-012': 'AIR-5L-012'
  };

  // Seed products
  for (const p of PRODUCT_KNOWLEDGE_BASE.products) {
    await run(
      `INSERT INTO products (id, sku, name, description, category, surface_types, dilution_ratio, unit, unit_price, coverage_per_unit, safety_notes, usage_guidance, hygiene_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, productIdToSku[p.id] || p.id, p.name, p.category + ' for institutional cleaning', p.category,
       JSON.stringify(p.surface_types), p.dilution_ratio, p.unit, p.unit_price,
       p.coverage_per_unit, p.safety_notes, p.usage_guidance, p.hygiene_level]
    );
  }
  console.log('  ' + PRODUCT_KNOWLEDGE_BASE.products.length + ' products seeded');

  // Seed warehouses
  const warehouses = [
    { id: 'wh-001', name: 'Ganga Main Warehouse - Mumbai', location: 'Andheri East, Mumbai - 400093', contact_person: 'Rajesh Kumar', contact_phone: '+91-9876543210' },
    { id: 'wh-002', name: 'Ganga Distribution Center - Delhi', location: 'Okhla Industrial Area, Delhi - 110020', contact_person: 'Sunil Verma', contact_phone: '+91-9876543211' },
    { id: 'wh-003', name: 'Ganga Storage - Bangalore', location: 'Whitefield, Bangalore - 560066', contact_person: 'Priya Sharma', contact_phone: '+91-9876543212' },
    { id: 'wh-004', name: 'Ganga Regional Hub - Chennai', location: 'Guindy, Chennai - 600032', contact_person: 'Venkatesh Rao', contact_phone: '+91-9876543213' }
  ];
  for (const w of warehouses) {
    await run(
      'INSERT INTO warehouses (id, name, location, contact_person, contact_phone) VALUES (?, ?, ?, ?, ?)',
      [w.id, w.name, w.location, w.contact_person, w.contact_phone]
    );
  }
  console.log('  ' + warehouses.length + ' warehouses seeded');

  // Seed stock batches
  const stockData = [
    { id: 'stk-001', product_id: 'prod-gpc-001', warehouse_id: 'wh-001', batch: 'BATCH-GPC-2024-001', qty: 500, expiry: '2026-12-31' },
    { id: 'stk-002', product_id: 'prod-dsf-002', warehouse_id: 'wh-001', batch: 'BATCH-DSF-2024-001', qty: 300, expiry: '2026-10-31' },
    { id: 'stk-003', product_id: 'prod-gls-003', warehouse_id: 'wh-002', batch: 'BATCH-GLS-2024-001', qty: 400, expiry: '2026-11-30' },
    { id: 'stk-004', product_id: 'prod-flr-004', warehouse_id: 'wh-002', batch: 'BATCH-FLR-2024-001', qty: 350, expiry: '2026-12-31' },
    { id: 'stk-005', product_id: 'prod-hnd-009', warehouse_id: 'wh-003', batch: 'BATCH-HND-2024-001', qty: 1000, expiry: '2026-09-30' },
    { id: 'stk-006', product_id: 'prod-hdd-010', warehouse_id: 'wh-003', batch: 'BATCH-HDD-2024-001', qty: 200, expiry: '2026-08-31' }
  ];
  for (const s of stockData) {
    await run(
      'INSERT INTO stock_batches (id, product_id, warehouse_id, batch_number, quantity, expiry_date) VALUES (?, ?, ?, ?, ?, ?)',
      [s.id, s.product_id, s.warehouse_id, s.batch, s.qty, s.expiry]
    );
  }
  console.log('  ' + stockData.length + ' stock batches seeded');

  // Seed quotation kits
  const kits = [
    { id: 'kit-001', name: 'Hospital Essentials Kit', desc: 'Complete cleaning kit for healthcare facilities', products: JSON.stringify(['prod-dsf-002', 'prod-gpc-001', 'prod-hnd-009', 'prod-tlt-008', 'prod-flr-004']), price: 1210 },
    { id: 'kit-002', name: 'Office Cleaning Kit', desc: 'Essential cleaning products for corporate offices', products: JSON.stringify(['prod-gpc-001', 'prod-gls-003', 'prod-hnd-009', 'prod-air-012', 'prod-flr-004']), price: 1070 },
    { id: 'kit-003', name: 'Restaurant Hygiene Kit', desc: 'Complete cleaning for food service establishments', products: JSON.stringify(['prod-hdd-010', 'prod-dsf-002', 'prod-flr-004', 'prod-gpc-001', 'prod-tlt-008']), price: 1350 },
    { id: 'kit-004', name: 'Hotel Hospitality Kit', desc: 'Premium cleaning for hotels and hospitality', products: JSON.stringify(['prod-gpc-001', 'prod-gls-003', 'prod-crp-005', 'prod-tlt-008', 'prod-air-012', 'prod-stl-006']), price: 1650 }
  ];
  for (const k of kits) {
    await run(
      'INSERT INTO quotation_kits (id, name, description, products, total_price) VALUES (?, ?, ?, ?, ?)',
      [k.id, k.name, k.desc, k.products, k.price]
    );
  }
  console.log('  ' + kits.length + ' quotation kits seeded');

  // Seed tier discounts
  const discounts = [
    { id: 'disc-001', product_id: 'prod-gpc-001', min: 0, max: 10, pct: 0 },
    { id: 'disc-002', product_id: 'prod-gpc-001', min: 11, max: 50, pct: 5 },
    { id: 'disc-003', product_id: 'prod-gpc-001', min: 51, max: null, pct: 10 },
    { id: 'disc-004', product_id: 'prod-dsf-002', min: 0, max: 10, pct: 0 },
    { id: 'disc-005', product_id: 'prod-dsf-002', min: 11, max: 50, pct: 8 },
    { id: 'disc-006', product_id: 'prod-dsf-002', min: 51, max: null, pct: 15 }
  ];
  for (const d of discounts) {
    await run(
      'INSERT INTO tier_discounts (id, product_id, min_quantity, max_quantity, discount_percent) VALUES (?, ?, ?, ?, ?)',
      [d.id, d.product_id, d.min, d.max, d.pct]
    );
  }
  console.log('  ' + discounts.length + ' tier discounts seeded');

  // Seed MSDS documents
  const msdsDocs = [
    { id: 'msds-001', product_id: 'prod-gpc-001', title: 'Ganga Multi-Purpose Cleaner MSDS', url: '/docs/msds/gpc-001-v1.pdf', ver: '1.0' },
    { id: 'msds-002', product_id: 'prod-dsf-002', title: 'Ganga Hospital-Grade Disinfectant MSDS', url: '/docs/msds/dsf-002-v1.pdf', ver: '1.0' },
    { id: 'msds-003', product_id: 'prod-hdd-010', title: 'Ganga Heavy Duty Degreaser MSDS', url: '/docs/msds/hdd-010-v1.pdf', ver: '1.0' }
  ];
  for (const d of msdsDocs) {
    await run(
      'INSERT INTO msds_documents (id, product_id, title, document_url, version) VALUES (?, ?, ?, ?, ?)',
      [d.id, d.product_id, d.title, d.url, d.ver]
    );
  }
  console.log('  ' + msdsDocs.length + ' MSDS documents seeded');

  console.log('\n Database seeding complete!');
}

seedDatabase().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
