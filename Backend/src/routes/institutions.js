const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../database/schema');
const { validateInstitutionInput, validatePagination } = require('../middleware/validation');

router.post('/', validateInstitutionInput, async (req, res) => {
  try {
    const id = uuidv4();
    const { name, institution_type, area_size, surface_types, hygiene_standard, budget, contact_name, contact_email, contact_phone, address, metadata } = req.body;

    await run('INSERT INTO institutions (id, name, institution_type, area_size, surface_types, hygiene_standard, budget, contact_name, contact_email, contact_phone, address, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, institution_type, area_size, JSON.stringify(surface_types), hygiene_standard, budget, contact_name || null, contact_email || null, contact_phone || null, address || null, metadata ? JSON.stringify(metadata) : null]);

    const institution = await queryOne('SELECT * FROM institutions WHERE id = ?', [id]);
    institution.surface_types = JSON.parse(institution.surface_types || '[]');
    institution.metadata = institution.metadata ? JSON.parse(institution.metadata) : null;

    res.status(201).json({
      success: true,
      message: 'Institution created successfully',
      data: institution,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create institution',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/', validatePagination, async (req, res) => {
  try {
    const { page, limit, status, type } = req.query;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM institutions WHERE 1=1';
    const params = [];

    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (type) { sql += ' AND institution_type = ?'; params.push(type); }

    // Count query with filters
    let countSql = 'SELECT COUNT(*) as total FROM institutions WHERE 1=1';
    const countParams = [];
    if (status) { countSql += ' AND status = ?'; countParams.push(status); }
    if (type) { countSql += ' AND institution_type = ?'; countParams.push(type); }
    const countResult = await queryAll(countSql, countParams);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const institutions = await queryAll(sql, params);

    const parsed = institutions.map(inst => ({
      ...inst,
      surface_types: JSON.parse(inst.surface_types || '[]'),
      metadata: inst.metadata ? JSON.parse(inst.metadata) : null
    }));

    res.json({
      success: true,
      count: parsed.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: parsed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institutions',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const institution = await queryOne('SELECT * FROM institutions WHERE id = ?', [req.params.id]);
    if (!institution) {
      return res.status(404).json({
        success: false,
        error: 'Institution not found',
        timestamp: new Date().toISOString()
      });
    }
    institution.surface_types = JSON.parse(institution.surface_types || '[]');
    institution.metadata = institution.metadata ? JSON.parse(institution.metadata) : null;
    const recommendations = await queryAll('SELECT * FROM recommendations WHERE institution_id = ? ORDER BY created_at DESC', [req.params.id]);

    res.json({
      success: true,
      data: { ...institution, recommendations },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institution',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await queryOne('SELECT * FROM institutions WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Institution not found',
        timestamp: new Date().toISOString()
      });
    }

    const { name, institution_type, area_size, surface_types, hygiene_standard, budget, contact_name, contact_email, contact_phone, address, metadata, status } = req.body;

    const updates = [];
    const params = [];
    
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (institution_type !== undefined) { updates.push('institution_type = ?'); params.push(institution_type); }
    if (area_size !== undefined) { updates.push('area_size = ?'); params.push(area_size); }
    if (surface_types !== undefined) { updates.push('surface_types = ?'); params.push(JSON.stringify(surface_types)); }
    if (hygiene_standard !== undefined) { updates.push('hygiene_standard = ?'); params.push(hygiene_standard); }
    if (budget !== undefined) { updates.push('budget = ?'); params.push(budget); }
    if (contact_name !== undefined) { updates.push('contact_name = ?'); params.push(contact_name); }
    if (contact_email !== undefined) { updates.push('contact_email = ?'); params.push(contact_email); }
    if (contact_phone !== undefined) { updates.push('contact_phone = ?'); params.push(contact_phone); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (metadata !== undefined) { updates.push('metadata = ?'); params.push(JSON.stringify(metadata)); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      params.push(req.params.id);
      await run('UPDATE institutions SET ' + updates.join(', ') + ' WHERE id = ?', params);
    }

    const updated = await queryOne('SELECT * FROM institutions WHERE id = ?', [req.params.id]);
    updated.surface_types = JSON.parse(updated.surface_types || '[]');
    updated.metadata = updated.metadata ? JSON.parse(updated.metadata) : null;

    res.json({
      success: true,
      message: 'Institution updated successfully',
      data: updated,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update institution',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await queryOne('SELECT * FROM institutions WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Institution not found',
        timestamp: new Date().toISOString()
      });
    }
    await run('DELETE FROM institutions WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      message: 'Institution deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete institution',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;