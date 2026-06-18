require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { initializeSchema } = require('./database/schema');
const { runAllChecks } = require('./services/reminderService');

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 5000;

  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:4173,https://ai-institutional-cleaning-product-s-rouge.vercel.app')
    .split(',')
    .map(s => s.trim());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.use(morgan('dev'));

  // Connect to MySQL and initialize schema
  console.log(' Connecting to MySQL...');
  await initializeSchema();
  console.log(' MySQL database initialized');

  // API Routes
  app.use('/api/products', require('./routes/products'));
  app.use('/api/institutions', require('./routes/institutions'));
  app.use('/api/recommendations', require('./routes/recommendations'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/bulk-orders', require('./routes/bulkOrder'));
  app.use('/api/warehouses', require('./routes/warehouse'));
  app.use('/api/crm', require('./routes/crm'));
  app.use('/api/quotations', require('./routes/quotation'));
  app.use('/api/deliveries', require('./routes/delivery'));
  app.use('/api/salesman', require('./routes/salesman'));
  app.use('/api/reorder', require('./routes/reorder'));
  app.use('/api/contract-pricing', require('./routes/contractPricing'));
  app.use('/api/compliance', require('./routes/compliance'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/workflow', require('./routes/workflow'));

  // Start automated reminder checks (every 10 minutes)
  setInterval(() => {
    runAllChecks().catch(err => console.error('[Scheduler] Reminder check error:', err.message));
  }, 10 * 60 * 1000);
  console.log('  Automated reminder scheduler started (interval: 10 min)');

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: 'AI Institutional Cleaning Product Selector API is running',
      version: '1.0.0',
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

  // Global error handler — captures 400 Bad Request & 500 Internal Server errors
  app.use((err, req, res, next) => {
    if (err.type === 'validation' || err.status) {
      return res.status(err.status || 400).json({
        success: false,
        error: err.message || 'Bad request',
        errors: err.errors || undefined,
        timestamp: new Date().toISOString()
      });
    }

    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      timestamp: new Date().toISOString()
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=============================================`);
    console.log('  AI Institutional Cleaning Product Selector');
    console.log('      AI Institutional Cleaning Product Selector API');
    console.log('=============================================');
    console.log('  Server:');
    console.log(`  http://localhost:${PORT}`);
    console.log('  Health:');
    console.log(`  http://localhost:${PORT}/api/health`);
    console.log('=============================================');
  });

  return app;
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = startServer;
