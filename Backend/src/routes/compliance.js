const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../database/schema');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(requireAuth);
router.use(requireRole('admin', 'compliance_admin'));

// ── Specific routes MUST come before parameterized /:id ─────────────

// POST /api/compliance/acknowledge - Acknowledge a compliance doc
router.post('/acknowledge', async (req, res, next) => {
  try {
    const { document_id, institution_id, acknowledged_by } = req.body;
    if (!document_id || !institution_id || !acknowledged_by) return res.status(400).json({ success: false, error: 'document_id, institution_id, acknowledged_by required', timestamp: new Date().toISOString() });
    const ackId = 'ack_' + uuidv4();
    await run('INSERT INTO compliance_acknowledgements (id, institution_id, document_id, acknowledged_by, acknowledged_at) VALUES (?, ?, ?, ?, NOW())', [ackId, institution_id, document_id, acknowledged_by]);
    res.status(201).json({ success: true, data: { id: ackId, document_id, institution_id, acknowledged_by }, message: 'Acknowledged', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// GET /api/compliance/acknowledgements/:institutionId
router.get('/acknowledgements/:institutionId', async (req, res, next) => {
  try {
    const acks = await queryAll('SELECT * FROM compliance_acknowledgements WHERE institution_id = ? ORDER BY acknowledged_at DESC', [req.params.institutionId]);
    const enriched = await Promise.all((acks || []).map(async (ack) => {
      const doc = ack.document_id ? await queryOne('SELECT title as document_title FROM msds_documents WHERE id = ?', [ack.document_id]) : null;
      return { ...ack, document_title: doc?.document_title || null };
    }));
    res.json({ success: true, count: enriched.length, data: enriched, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// ── Standard CRUD routes ────────────────────────────────────────────

// GET /api/compliance - List all MSDS/compliance docs
router.get('/', async (req, res, next) => {
  try {
    const docs = await queryAll('SELECT * FROM msds_documents ORDER BY created_at DESC');
    const enriched = await Promise.all((docs || []).map(async (doc) => {
      const ackCount = await queryOne('SELECT COUNT(*) as count FROM compliance_acknowledgements WHERE document_id = ?', [doc.id]);
      const product = doc.product_id ? await queryOne('SELECT name, category FROM products WHERE id = ?', [doc.product_id]) : null;
      return { ...doc, product_name: product?.name || null, product_category: product?.category || null, acknowledgement_count: ackCount?.count || 0 };
    }));
    res.json({ success: true, count: enriched.length, data: enriched, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// GET /api/compliance/:id - Get single doc with acknowledgements
router.get('/:id', async (req, res, next) => {
  try {
    const doc = await queryOne('SELECT * FROM msds_documents WHERE id = ?', [req.params.id]);
    if (!doc) return res.status(404).json({ success: false, error: 'Document not found', timestamp: new Date().toISOString() });
    const product = doc.product_id ? await queryOne('SELECT name FROM products WHERE id = ?', [doc.product_id]) : null;
    const acknowledgements = await queryAll('SELECT ca.* FROM compliance_acknowledgements ca WHERE ca.document_id = ? ORDER BY ca.acknowledged_at DESC', [req.params.id]);
    // Enrich acknowledgements with institution names
    const enrichedAcks = await Promise.all((acknowledgements || []).map(async (ack) => {
      const inst = ack.institution_id ? await queryOne('SELECT name as institution_name FROM institutions WHERE id = ?', [ack.institution_id]) : null;
      return { ...ack, institution_name: inst?.institution_name || null };
    }));
    res.json({ success: true, data: { ...doc, product_name: product?.name || null, acknowledgements: enrichedAcks || [] }, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// POST /api/compliance - Create a compliance doc
router.post('/', async (req, res, next) => {
  try {
    const { product_id, title, document_url, version } = req.body;
    if (!product_id || !title || !title.trim()) return res.status(400).json({ success: false, error: 'product_id and title are required', timestamp: new Date().toISOString() });
    const id = 'msds_' + uuidv4();
    await run('INSERT INTO msds_documents (id, product_id, title, document_url, version, created_at) VALUES (?, ?, ?, ?, ?, NOW())', [id, product_id, title.trim(), document_url || '', version || '1.0']);
    const doc = await queryOne('SELECT * FROM msds_documents WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: doc, message: 'Compliance document added', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// PUT /api/compliance/:id - Update a compliance doc
router.put('/:id', async (req, res, next) => {
  try {
    const { title, document_url, version } = req.body;
    const existing = await queryOne('SELECT * FROM msds_documents WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Document not found', timestamp: new Date().toISOString() });
    await run('UPDATE msds_documents SET title = ?, document_url = ?, version = ? WHERE id = ?', [title?.trim() || existing.title, document_url ?? existing.document_url, version || existing.version, req.params.id]);
    const updated = await queryOne('SELECT * FROM msds_documents WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated, message: 'Document updated', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// DELETE /api/compliance/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM msds_documents WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Document not found', timestamp: new Date().toISOString() });
    await run('DELETE FROM msds_documents WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Document deleted', timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

module.exports = router;
