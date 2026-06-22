const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../database/schema');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);
router.use(requireRole('admin', 'salesman', 'sales_admin'));

router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM salesman_visits';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY visit_date DESC, created_at DESC';
    const visits = await queryAll(sql, params);
    // Enrich with institution data
    const enriched = await Promise.all((visits || []).map(async (v) => {
      const inst = v.institution_id ? await queryOne('SELECT name as institution_name, institution_type, contact_name, contact_phone FROM institutions WHERE id = ?', [v.institution_id]) : null;
      return { ...v, ...(inst || {}) };
    }));
    res.json({ success: true, count: enriched.length, data: enriched, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const visit = await queryOne('SELECT * FROM salesman_visits WHERE id = ?', [req.params.id]);
    if (!visit) return res.status(404).json({ success: false, error: 'Visit not found', timestamp: new Date().toISOString() });
    const inst = visit.institution_id ? await queryOne('SELECT name as institution_name, institution_type, contact_name, contact_phone, address FROM institutions WHERE id = ?', [visit.institution_id]) : null;
    res.json({ success: true, data: { ...visit, ...(inst || {}) }, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { institution_id, salesman_name, visit_date, purpose, notes, follow_up_date, status } = req.body;
    if (!institution_id || !salesman_name || !visit_date) return res.status(400).json({ success: false, error: 'institution_id, salesman_name, visit_date required', timestamp: new Date().toISOString() });
    const id = 'sv_' + uuidv4();
    await run('INSERT INTO salesman_visits (id, institution_id, salesman_name, visit_date, purpose, notes, follow_up_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())', [id, institution_id, salesman_name, visit_date, purpose || '', notes || '', follow_up_date || null, status || 'completed']);
    const visit = await queryOne('SELECT * FROM salesman_visits WHERE id = ?', [id]);
    if (visit && visit.institution_id) {
      const inst = await queryOne('SELECT name as institution_name FROM institutions WHERE id = ?', [visit.institution_id]);
      visit.institution_name = inst?.institution_name || null;
    }
    res.status(201).json({ success: true, data: visit, message: 'Visit logged', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { salesman_name, visit_date, purpose, notes, follow_up_date, status } = req.body;
    const existing = await queryOne('SELECT * FROM salesman_visits WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Visit not found', timestamp: new Date().toISOString() });
    await run('UPDATE salesman_visits SET salesman_name = ?, visit_date = ?, purpose = ?, notes = ?, follow_up_date = ?, status = ? WHERE id = ?', [salesman_name || existing.salesman_name, visit_date || existing.visit_date, purpose ?? existing.purpose, notes ?? existing.notes, follow_up_date !== undefined ? follow_up_date : existing.follow_up_date, status || existing.status, req.params.id]);
    const updated = await queryOne('SELECT * FROM salesman_visits WHERE id = ?', [req.params.id]);
    if (updated && updated.institution_id) {
      const inst = await queryOne('SELECT name as institution_name FROM institutions WHERE id = ?', [updated.institution_id]);
      updated.institution_name = inst?.institution_name || null;
    }
    res.json({ success: true, data: updated, message: 'Visit updated', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM salesman_visits WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Visit not found', timestamp: new Date().toISOString() });
    await run('DELETE FROM salesman_visits WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Visit deleted', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

module.exports = router;
