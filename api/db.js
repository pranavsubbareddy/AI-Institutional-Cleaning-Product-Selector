// Vercel Serverless Entry Point — MySQL Database Backend
// Uses PlanetScale MySQL-compatible database for persistent storage

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { initializeSchema } = require('../Backend/src/database/schema');

const app = express();
let initialized = false;
let initPromise = null;

// CORS — allow GitHub Pages and the Vercel domain itself
const allowedOrigins = (process.env.CORS_ORIGINS || [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'https://pranavsubbareddy.github.io',
  'https://ai-institutional-cleaning-product-s.vercel.app'
].join(',')).split(',').map(s => s.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Middleware to ensure DB is initialized before handling requests
app.use(async (req, res, next) => {
  if (!initialized) {
    if (!initPromise) {
      initPromise = (async () => {
        try {
          console.log('[db] Initializing database connection...');
          await initializeSchema();
          initialized = true;
          console.log('[db] Database initialized successfully');
        } catch (err) {
          console.error('[db] Failed to initialize database:', err.message);
          throw err;
        }
      })();
    }
    try {
      await initPromise;
    } catch (err) {
      return res.status(503).json({
        success: false,
        error: 'Database not available. Please check the DATABASE_URL environment variable.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
  next();
});

// API Routes (MySQL-backed)
app.use('/api/products', require('../Backend/src/routes/products'));
app.use('/api/institutions', require('../Backend/src/routes/institutions'));
app.use('/api/recommendations', require('../Backend/src/routes/recommendations'));
app.use('/api/dashboard', require('../Backend/src/routes/dashboard'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'AI Institutional Cleaning Product Selector API (MySQL) is running',
    version: '1.0.0',
    database: initialized ? 'connected' : 'connecting',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.type === 'validation' || err.status) {
    return res.status(err.status || 400).json({
      success: false,
      error: err.message || 'Bad request',
      errors: err.errors || undefined,
      timestamp: new Date().toISOString()
    });
  }
  console.error('[db] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
