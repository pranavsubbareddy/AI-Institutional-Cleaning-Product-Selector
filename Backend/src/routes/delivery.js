const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../database/schema');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);
router.use(requireRole('admin', 'warehouse_staff', 'delivery_coordinator'));

// GET /api/deliveries - List all delivery runs
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM delivery_runs';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY scheduled_date ASC, created_at DESC';
    const deliveries = await queryAll(sql, params);
    // Enrich with order and institution data
    const enriched = await Promise.all((deliveries || []).map(async (dr) => {
      const order = dr.order_id ? await queryOne('SELECT institution_id FROM orders WHERE id = ?', [dr.order_id]) : null;
      let inst = null;
      if (order?.institution_id) {
        inst = await queryOne('SELECT name as institution_name, contact_name, contact_phone, address FROM institutions WHERE id = ?', [order.institution_id]);
      }
      return { ...dr, institution_id: order?.institution_id || null, ...(inst || {}) };
    }));
    res.json({ success: true, count: enriched.length, data: enriched, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// GET /api/deliveries/:id
router.get('/:id', async (req, res, next) => {
  try {
    const delivery = await queryOne('SELECT * FROM delivery_runs WHERE id = ?', [req.params.id]);
    if (!delivery) return res.status(404).json({ success: false, error: 'Delivery not found', timestamp: new Date().toISOString() });
    const order = delivery.order_id ? await queryOne('SELECT institution_id FROM orders WHERE id = ?', [delivery.order_id]) : null;
    let enriched = { ...delivery, institution_id: order?.institution_id || null };
    if (order?.institution_id) {
      const inst = await queryOne('SELECT name as institution_name, contact_name, contact_phone, address FROM institutions WHERE id = ?', [order.institution_id]);
      enriched = { ...enriched, ...(inst || {}) };
    }
    res.json({ success: true, data: enriched, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// POST /api/deliveries - Create delivery run
router.post('/', async (req, res, next) => {
  try {
    const { order_id, driver_name, vehicle_number, scheduled_date, notes } = req.body;
    if (!order_id || !scheduled_date) return res.status(400).json({ success: false, error: 'order_id and scheduled_date are required', timestamp: new Date().toISOString() });
    const id = 'del_' + uuidv4();
    await run(
      'INSERT INTO delivery_runs (id, order_id, driver_name, vehicle_number, status, scheduled_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [id, order_id, driver_name || '', vehicle_number || '', 'scheduled', scheduled_date, notes || '']
    );
    const delivery = await queryOne('SELECT * FROM delivery_runs WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: delivery, message: 'Delivery scheduled', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// PUT /api/deliveries/:id - Update delivery run (status, driver, etc.)
router.put('/:id', async (req, res, next) => {
  try {
    const { driver_name, vehicle_number, status, scheduled_date, completed_date, notes } = req.body;
    const existing = await queryOne('SELECT * FROM delivery_runs WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Delivery not found', timestamp: new Date().toISOString() });

    const validStatuses = ['scheduled', 'in_transit', 'delivered', 'failed'];
    const finalStatus = status && validStatuses.includes(status) ? status : existing.status;

    await run(
      'UPDATE delivery_runs SET driver_name = ?, vehicle_number = ?, status = ?, scheduled_date = ?, completed_date = ?, notes = ? WHERE id = ?',
      [
        driver_name ?? existing.driver_name,
        vehicle_number ?? existing.vehicle_number,
        finalStatus,
        scheduled_date ?? existing.scheduled_date,
        completed_date || (finalStatus === 'delivered' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : existing.completed_date),
        notes ?? existing.notes,
        req.params.id
      ]
    );
    let updated = await queryOne('SELECT * FROM delivery_runs WHERE id = ?', [req.params.id]);
    // Enrich with institution data
    if (updated && updated.order_id) {
      const order = await queryOne('SELECT institution_id FROM orders WHERE id = ?', [updated.order_id]);
      if (order?.institution_id) {
        const inst = await queryOne('SELECT name as institution_name FROM institutions WHERE id = ?', [order.institution_id]);
        updated = { ...updated, institution_name: inst?.institution_name || null, institution_id: order.institution_id };
      }
    }
    res.json({ success: true, data: updated, message: 'Delivery updated', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// DELETE /api/deliveries/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM delivery_runs WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Delivery not found', timestamp: new Date().toISOString() });
    await run('DELETE FROM delivery_runs WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Delivery deleted', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

module.exports = router;
