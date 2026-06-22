const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../database/schema');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);
router.use(requireRole('admin', 'warehouse_staff'));

router.get('/', async (req, res, next) => {
  try {
    const warehouses = await queryAll('SELECT * FROM warehouses ORDER BY name ASC');
    const enriched = await Promise.all((warehouses || []).map(async (wh) => {
      const count = await queryOne('SELECT COUNT(*) as count FROM stock_batches WHERE warehouse_id = ?', [wh.id]);
      return { ...wh, batch_count: count?.count || 0 };
    }));
    res.json({ success: true, count: enriched.length, data: enriched, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.get('/all/batches', async (req, res, next) => {
  try {
    const batches = await queryAll('SELECT * FROM stock_batches ORDER BY created_at DESC');
    const enriched = await Promise.all((batches || []).map(async (sb) => {
      const product = sb.product_id ? await queryOne('SELECT name as product_name, sku FROM products WHERE id = ?', [sb.product_id]) : null;
      const warehouse = sb.warehouse_id ? await queryOne('SELECT name as warehouse_name, location as warehouse_location FROM warehouses WHERE id = ?', [sb.warehouse_id]) : null;
      return { ...sb, ...(product || {}), ...(warehouse || {}) };
    }));
    res.json({ success: true, count: enriched.length, data: enriched, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const warehouse = await queryOne('SELECT * FROM warehouses WHERE id = ?', [req.params.id]);
    if (!warehouse) return res.status(404).json({ success: false, error: 'Warehouse not found', timestamp: new Date().toISOString() });
    const batches = await queryAll('SELECT * FROM stock_batches WHERE warehouse_id = ? ORDER BY created_at DESC', [req.params.id]);
    // Enrich batches with product names
    const enrichedBatches = await Promise.all((batches || []).map(async (sb) => {
      const product = sb.product_id ? await queryOne('SELECT name as product_name FROM products WHERE id = ?', [sb.product_id]) : null;
      return { ...sb, product_name: product?.product_name || null };
    }));
    res.json({ success: true, data: { ...warehouse, batches: enrichedBatches || [] }, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, location, contact_person, contact_phone } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Warehouse name is required', timestamp: new Date().toISOString() });
    const id = 'wh_' + uuidv4();
    await run('INSERT INTO warehouses (id, name, location, contact_person, contact_phone, created_at) VALUES (?, ?, ?, ?, ?, NOW())', [id, name.trim(), location || '', contact_person || '', contact_phone || '']);
    const warehouse = await queryOne('SELECT * FROM warehouses WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: warehouse, message: 'Warehouse created', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, location, contact_person, contact_phone } = req.body;
    const existing = await queryOne('SELECT * FROM warehouses WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Warehouse not found', timestamp: new Date().toISOString() });
    await run('UPDATE warehouses SET name = ?, location = ?, contact_person = ?, contact_phone = ? WHERE id = ?', [name?.trim() || existing.name, location ?? existing.location, contact_person ?? existing.contact_person, contact_phone ?? existing.contact_phone, req.params.id]);
    const updated = await queryOne('SELECT * FROM warehouses WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated, message: 'Warehouse updated', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM warehouses WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Warehouse not found', timestamp: new Date().toISOString() });
    await run('DELETE FROM warehouses WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Warehouse deleted', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.get('/:id/batches', async (req, res, next) => {
  try {
    const batches = await queryAll('SELECT * FROM stock_batches WHERE warehouse_id = ? ORDER BY created_at DESC', [req.params.id]);
    const enriched = await Promise.all((batches || []).map(async (sb) => {
      const product = sb.product_id ? await queryOne('SELECT name as product_name, sku FROM products WHERE id = ?', [sb.product_id]) : null;
      return { ...sb, ...(product || {}) };
    }));
    res.json({ success: true, count: enriched.length, data: enriched, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/:id/batches', async (req, res, next) => {
  try {
    const { product_id, batch_number, quantity, expiry_date } = req.body;
    if (!product_id || !batch_number || quantity === undefined) return res.status(400).json({ success: false, error: 'product_id, batch_number, quantity required', timestamp: new Date().toISOString() });
    const wh = await queryOne('SELECT id FROM warehouses WHERE id = ?', [req.params.id]);
    if (!wh) return res.status(404).json({ success: false, error: 'Warehouse not found', timestamp: new Date().toISOString() });
    const id = 'sb_' + uuidv4();
    await run('INSERT INTO stock_batches (id, product_id, warehouse_id, batch_number, quantity, expiry_date, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())', [id, product_id, req.params.id, batch_number, Number(quantity), expiry_date || null]);
    const batch = await queryOne('SELECT * FROM stock_batches WHERE id = ?', [id]);
    if (batch && batch.product_id) {
      const product = await queryOne('SELECT name as product_name FROM products WHERE id = ?', [batch.product_id]);
      batch.product_name = product?.product_name || null;
    }
    res.status(201).json({ success: true, data: batch, message: 'Stock batch added', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.put('/:id/batches/:batchId', async (req, res, next) => {
  try {
    const { quantity, expiry_date, batch_number } = req.body;
    const existing = await queryOne('SELECT * FROM stock_batches WHERE id = ? AND warehouse_id = ?', [req.params.batchId, req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Stock batch not found', timestamp: new Date().toISOString() });
    await run('UPDATE stock_batches SET quantity = ?, expiry_date = ?, batch_number = ? WHERE id = ?', [quantity !== undefined ? Number(quantity) : existing.quantity, expiry_date ?? existing.expiry_date, batch_number || existing.batch_number, req.params.batchId]);
    const updated = await queryOne('SELECT * FROM stock_batches WHERE id = ?', [req.params.batchId]);
    if (updated && updated.product_id) {
      const product = await queryOne('SELECT name as product_name FROM products WHERE id = ?', [updated.product_id]);
      updated.product_name = product?.product_name || null;
    }
    res.json({ success: true, data: updated, message: 'Stock batch updated', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.delete('/:id/batches/:batchId', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM stock_batches WHERE id = ? AND warehouse_id = ?', [req.params.batchId, req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Stock batch not found', timestamp: new Date().toISOString() });
    await run('DELETE FROM stock_batches WHERE id = ?', [req.params.batchId]);
    res.json({ success: true, message: 'Stock batch deleted', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

module.exports = router;
