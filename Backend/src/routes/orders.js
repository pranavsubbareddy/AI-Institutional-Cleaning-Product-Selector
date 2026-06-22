const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../database/schema');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);
router.use(requireRole('admin', 'sales_admin', 'accounts_manager'));

router.get('/stats', async (req, res, next) => {
  try {
    const allOrders = await queryAll('SELECT * FROM orders');
    const orders = allOrders || [];
    const stats = {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending' || o.workflow_stage === 'request_created').length,
      approved: orders.filter(o => o.sales_approval_status === 'approved' && o.status !== 'delivered' && o.status !== 'cancelled').length,
      delivered: orders.filter(o => o.status === 'delivered' || o.status === 'completed').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      totalRevenue: orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
    };
    res.json({ success: true, data: stats, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, workflow_stage, institution_id, search } = req.query;
    let sql = 'SELECT * FROM orders';
    const conditions = [];
    const params = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (workflow_stage) { conditions.push('workflow_stage = ?'); params.push(workflow_stage); }
    if (institution_id) { conditions.push('institution_id = ?'); params.push(institution_id); }
    if (search) { conditions.push('(id LIKE ?)'); params.push('%' + search + '%'); }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    const orders = await queryAll(sql, params);
    // Enrich with institution and recommendation data
    const enriched = await Promise.all((orders || []).map(async (o) => {
      const inst = o.institution_id ? await queryOne('SELECT name as institution_name, institution_type, contact_name, contact_phone, address FROM institutions WHERE id = ?', [o.institution_id]) : null;
      const rec = o.recommendation_id ? await queryOne('SELECT total_estimated_cost as rec_cost, status as rec_status FROM recommendations WHERE id = ?', [o.recommendation_id]) : null;
      return { ...o, ...(inst || {}), ...(rec || {}) };
    }));
    res.json({ success: true, count: enriched.length, data: enriched, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found', timestamp: new Date().toISOString() });
    // Enrich with institution data
    const inst = order.institution_id ? await queryOne('SELECT name as institution_name, institution_type, contact_name, contact_phone, address FROM institutions WHERE id = ?', [order.institution_id]) : null;
    const rec = order.recommendation_id ? await queryOne('SELECT total_estimated_cost as rec_cost, status as rec_status, summary as rec_summary FROM recommendations WHERE id = ?', [order.recommendation_id]) : null;
    const enriched = { ...order, ...(inst || {}), ...(rec || {}) };
    let items = [];
    if (order.recommendation_id) {
      items = await queryAll('SELECT * FROM recommendation_items WHERE recommendation_id = ?', [order.recommendation_id]);
      // Enrich items with product data
      items = await Promise.all((items || []).map(async (it) => {
        const prod = it.product_id ? await queryOne('SELECT name as product_name, sku, unit, unit_price FROM products WHERE id = ?', [it.product_id]) : null;
        return { ...it, ...(prod || {}) };
      }));
    }
    const workflowEvents = await queryAll('SELECT * FROM workflow_events WHERE order_id = ? ORDER BY created_at ASC', [req.params.id]);
    res.json({ success: true, data: { ...enriched, items: items || [], workflow_events: workflowEvents || [] }, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { institution_id, recommendation_id, total_amount, delivery_date, notes } = req.body;
    if (!institution_id) return res.status(400).json({ success: false, error: 'institution_id is required', timestamp: new Date().toISOString() });
    const inst = await queryOne('SELECT id FROM institutions WHERE id = ?', [institution_id]);
    if (!inst) return res.status(404).json({ success: false, error: 'Institution not found', timestamp: new Date().toISOString() });
    const id = 'ord_' + uuidv4();
    let amount = total_amount || 0;
    if (recommendation_id && !total_amount) {
      const recItems = await queryAll('SELECT SUM(monthly_cost) as total FROM recommendation_items WHERE recommendation_id = ?', [recommendation_id]);
      amount = recItems[0]?.total || 0;
    }
    await run('INSERT INTO orders (id, institution_id, recommendation_id, status, workflow_stage, total_amount, delivery_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())', [id, institution_id, recommendation_id || null, 'pending', 'request_created', Number(amount), delivery_date || null, notes || '']);
    const eventId = 'we_' + uuidv4();
    await run('INSERT INTO workflow_events (id, order_id, from_stage, to_stage, action, performed_by, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())', [eventId, id, null, 'request_created', 'Order Created', req.user?.email || 'system', 'New order request created']);
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: order, message: 'Order created', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { status, total_amount, delivery_date, notes } = req.body;
    const existing = await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Order not found', timestamp: new Date().toISOString() });
    await run('UPDATE orders SET status = ?, total_amount = ?, delivery_date = ?, notes = ?, updated_at = NOW() WHERE id = ?', [status || existing.status, total_amount !== undefined ? Number(total_amount) : existing.total_amount, delivery_date || existing.delivery_date, notes !== undefined ? notes : existing.notes, req.params.id]);
    const updated = await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated, message: 'Order updated', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Order not found', timestamp: new Date().toISOString() });
    await run('DELETE FROM workflow_events WHERE order_id = ?', [req.params.id]);
    await run('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Order deleted', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/:id/workflow', async (req, res, next) => {
  try {
    const { to_stage, action, notes } = req.body;
    if (!to_stage) return res.status(400).json({ success: false, error: 'to_stage is required', timestamp: new Date().toISOString() });
    const validStages = ['request_created', 'quotation_sent', 'customer_approved', 'payment_received', 'processing', 'ready_for_dispatch', 'dispatched', 'delivered', 'cancelled'];
    if (!validStages.includes(to_stage)) {
      return res.status(400).json({ success: false, error: 'Invalid workflow stage. Valid: ' + validStages.join(', '), timestamp: new Date().toISOString() });
    }
    const existing = await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Order not found', timestamp: new Date().toISOString() });
    const from_stage = existing.workflow_stage;
    const eventId = 'we_' + uuidv4();
    await run('UPDATE orders SET workflow_stage = ?, status = ?, updated_at = NOW() WHERE id = ?', [to_stage, to_stage === 'cancelled' ? 'cancelled' : to_stage === 'delivered' ? 'delivered' : existing.status, req.params.id]);
    await run('INSERT INTO workflow_events (id, order_id, from_stage, to_stage, action, performed_by, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())', [eventId, req.params.id, from_stage, to_stage, action || 'Workflow advanced', req.user?.email || 'system', notes || '']);
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: order, message: 'Workflow advanced to ' + to_stage, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.get('/:id/invoice', async (req, res, next) => {
  try {
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found', timestamp: new Date().toISOString() });
    // Enrich with institution data
    const inst = order.institution_id ? await queryOne('SELECT name as institution_name, address, contact_name, contact_phone FROM institutions WHERE id = ?', [order.institution_id]) : null;
    const enriched = { ...order, ...(inst || {}) };

    let items = [];
    if (order.recommendation_id) {
      items = await queryAll('SELECT * FROM recommendation_items WHERE recommendation_id = ?', [order.recommendation_id]);
      // Enrich items with product data
      items = await Promise.all((items || []).map(async (it) => {
        const prod = it.product_id ? await queryOne('SELECT name as product_name, sku, unit, unit_price FROM products WHERE id = ?', [it.product_id]) : null;
        return { ...it, ...(prod || {}) };
      }));
    }

    const subtotal = Number(order.total_amount) || items.reduce((sum, it) => sum + Number(it.monthly_cost || 0), 0);
    const gstRate = 0.18;
    const gstAmount = Math.round(subtotal * gstRate * 100) / 100;
    const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100;

    const invoice = {
      invoice_no: 'INV-' + order.id.slice(0, 12).toUpperCase(),
      order_id: order.id,
      date: new Date().toISOString(),
      bill_to: {
        name: enriched.institution_name || 'N/A',
        address: enriched.address || '',
        contact: enriched.contact_name ? enriched.contact_name + (enriched.contact_phone ? ' (' + enriched.contact_phone + ')' : '') : ''
      },
      items: items.map(it => ({
        sku: it.sku || 'N/A',
        product: it.product_name || it.name || 'Product',
        qty: Number(it.estimated_monthly_qty_units || it.quantity || 1),
        rate: Number(it.unit_price || 0),
        amount: Number(it.monthly_cost || it.calculated_cost || 0)
      })),
      subtotal: subtotal,
      gst_rate: gstRate,
      gst_amount: gstAmount,
      grand_total: grandTotal,
      status: order.status || 'pending',
      workflow_stage: order.workflow_stage || 'N/A'
    };

    res.json({ success: true, data: invoice, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

module.exports = router;
