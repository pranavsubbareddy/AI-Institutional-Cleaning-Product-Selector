require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { initializeSchema } = require('./src/database/schema');
const { runAllChecks } = require('./src/services/reminderService');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS config: allow cookie-based auth from frontend origins
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'https://pranavsubbareddy.github.io',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) return callback(null, true);
    // Exact match check
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
    // Allow all subdomains of github.io (GitHub Pages)
    if (origin.endsWith('.github.io')) return callback(null, true);
    // Allow the same Vercel deployment (frontend + API served together)
    if (origin.includes('.vercel.app')) return callback(null, true);
    // Dev mode — allow all
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// ── Auth Routes ─────────────────────────────────────────────────────────
const authRoutes = require('./src/routes/auth');
app.use('/api/auth', authRoutes);

// ── Protected API Routes (require authentication, handled by route files) ──
const institutionRoutes = require('./src/routes/institutions');
const recommendationRoutes = require('./src/routes/recommendations');
const dashboardRoutes = require('./src/routes/dashboard');
const adminRoutes = require('./src/routes/admin');

app.use('/api/institutions', institutionRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);

// ── Operations Routes ───────────────────────────────────────────
const warehouseRoutes = require('./src/routes/warehouse');
const deliveryRoutes = require('./src/routes/delivery');
const salesmanRoutes = require('./src/routes/salesman');
const complianceRoutes = require('./src/routes/compliance');
const ordersRoutes = require('./src/routes/orders');

app.use('/api/warehouses', warehouseRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/salesman', salesmanRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/orders', ordersRoutes);

// Root — return a success message so the browser doesn't show a 404
app.get('/', (req, res) => {
  res.json({success:true,message:'AI Institutional Cleaning Product Selector API',version:'1.0.0',endpoints:['/api/health','/api/products','/api/institutions','/api/recommendations','/api/dashboard','/api/admin'],timestamp:new Date().toISOString()});
});

// Health
app.get('/api/health', (req, res) => res.json({success:true,message:'API Running',version:'1.0.0',timestamp:new Date().toISOString()}));

// Products (public, no auth needed — queries DB to show AI-generated + seeded products)
app.get('/api/products', async (req, res) => {
  try {
    const { queryAll } = require('./src/database/schema');
    let sql = 'SELECT * FROM products';
    const params = [];
    const conditions = [];
    if (req.query.category) { conditions.push('category = ?'); params.push(req.query.category); }
    if (req.query.hygiene_level) { conditions.push('hygiene_level = ?'); params.push(req.query.hygiene_level); }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    const products = await queryAll(sql, params);
    res.json({success:true,count:products.length,data:products,timestamp:new Date().toISOString()});
  } catch (err) {
    console.error('[Products] DB query failed, returning empty catalog:', err.message);
    res.json({success:true,count:0,data:[],timestamp:new Date().toISOString()});
  }
});
app.get('/api/products/:id', async (req, res) => {
  try {
    const { queryOne } = require('./src/database/schema');
    const p = await queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if(!p) return res.status(404).json({success:false,error:'Product not found',timestamp:new Date().toISOString()});
    res.json({success:true,data:p,timestamp:new Date().toISOString()});
  } catch (err) {
    res.status(500).json({success:false,error:err.message,timestamp:new Date().toISOString()});
  }
});

// 404 & Error
app.use((req, res) => res.status(404).json({success:false,error:'Route not found',path:req.originalUrl,timestamp:new Date().toISOString()}));
app.use((err, req, res, next) => {console.error(err);res.status(err.status||500).json({success:false,error:err.message||'Internal server error',details:process.env.NODE_ENV==='development'?err.stack:undefined,timestamp:new Date().toISOString()});});

// ── Initialize database schema (for auth persistence) ────────────────────────────
initializeSchema()
  .then(() => {
    console.log('  Database schema initialized for auth persistence');
    // Start automated reminder checks (every 10 minutes)
    setInterval(() => {
      runAllChecks().catch(err => console.error('[Scheduler] Reminder check error:', err.message));
    }, 10 * 60 * 1000);
    console.log('  Automated reminder scheduler started (interval: 10 min)');
  })
  .catch(err => console.error('  Database schema init failed (auth won\'t persist):', err.message));

// Export for Vercel serverless deployment
module.exports = app;

// Start server only when running directly (not when imported by Vercel)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`\n  Standalone API running on http://localhost:${PORT}\n`));
}
