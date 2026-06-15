require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { PRODUCT_KNOWLEDGE_BASE } = require('./src/engine/recommendationEngine');
const { initializeSchema } = require('./src/database/schema');

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

const PRODUCTS = PRODUCT_KNOWLEDGE_BASE.products;

// ── Auth Routes ─────────────────────────────────────────────────────────
const authRoutes = require('./src/routes/auth');
app.use('/api/auth', authRoutes);

// ── Protected API Routes (require authentication, handled by route files) ──
const institutionRoutes = require('./src/routes/institutions');
const recommendationRoutes = require('./src/routes/recommendations');
const dashboardRoutes = require('./src/routes/dashboard');

app.use('/api/institutions', institutionRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Root — return a success message so the browser doesn't show a 404
app.get('/', (req, res) => {
  res.json({success:true,message:'AI Institutional Cleaning Product Selector API',version:'1.0.0',endpoints:['/api/health','/api/products','/api/institutions','/api/recommendations','/api/dashboard'],timestamp:new Date().toISOString()});
});

// Health
app.get('/api/health', (req, res) => res.json({success:true,message:'API Running',version:'1.0.0',timestamp:new Date().toISOString()}));

// Products (public, no auth needed)
app.get('/api/products', (req, res) => {
  let p = [...PRODUCTS];
  if(req.query.category) p = p.filter(x => x.category === req.query.category);
  if(req.query.surface_type) p = p.filter(x => x.surface_types.includes(req.query.surface_type));
  if(req.query.hygiene_level) p = p.filter(x => x.hygiene_level === req.query.hygiene_level);
  res.json({success:true,count:p.length,data:p,timestamp:new Date().toISOString()});
});
app.get('/api/products/:id', (req, res) => {
  const p = PRODUCTS.find(x => x.id === req.params.id);
  if(!p) return res.status(404).json({success:false,error:'Not found',timestamp:new Date().toISOString()});
  res.json({success:true,data:p,timestamp:new Date().toISOString()});
});

// 404 & Error
app.use((req, res) => res.status(404).json({success:false,error:'Route not found',path:req.originalUrl,timestamp:new Date().toISOString()}));
app.use((err, req, res, next) => {console.error(err);res.status(err.status||500).json({success:false,error:err.message||'Internal server error',details:process.env.NODE_ENV==='development'?err.stack:undefined,timestamp:new Date().toISOString()});});

// ── Initialize database schema (for auth persistence) ────────────────────────────
initializeSchema()
  .then(() => console.log('  Database schema initialized for auth persistence'))
  .catch(err => console.error('  Database schema init failed (auth won\'t persist):', err.message));

// Export for Vercel serverless deployment
module.exports = app;

// Start server only when running directly (not when imported by Vercel)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`\n  Standalone API running on http://localhost:${PORT}\n`));
}
