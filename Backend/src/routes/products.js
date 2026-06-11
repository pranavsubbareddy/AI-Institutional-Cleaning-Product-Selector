const express = require('express');
const router = express.Router();
const { queryAll, queryOne } = require('../database/schema');

router.get('/', async (req, res) => {
  try {
    const { category, surface_type, hygiene_level } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (surface_type) {
      sql += ' AND surface_types LIKE ?';
      params.push('%' + surface_type + '%');
    }
    if (hygiene_level) {
      sql += ' AND hygiene_level = ?';
      params.push(hygiene_level);
    }

    sql += ' ORDER BY name ASC';
    const products = await queryAll(sql, params);

    res.json({
      success: true,
      count: products.length,
      data: products,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/category/:type', async (req, res) => {
  try {
    const sql = 'SELECT * FROM products WHERE category = ? ORDER BY name ASC';
    const products = await queryAll(sql, [req.params.type]);

    res.json({
      success: true,
      count: products.length,
      data: products,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products by category',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        timestamp: new Date().toISOString()
      });
    }
    res.json({
      success: true,
      data: product,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
