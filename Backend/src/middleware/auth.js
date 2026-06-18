const jwt = require('jsonwebtoken');

const crypto = require('crypto');

// Derive a deterministic fallback so existing sessions survive process restarts
let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET === 'gangamaxx-dev-jwt-secret-change-in-production') {
  if (process.env.NODE_ENV === 'production') {
    // Generate a stable per‑deployment secret so the server never crashes on startup
    const projectId = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || 'default';
    JWT_SECRET = crypto.createHash('sha256').update('gangamaxx-secret-' + projectId).digest('hex');
    console.warn('[Auth] JWT_SECRET not set. Using auto-generated secret derived from project URL. Set JWT_SECRET env var for a persistent secret.');
  } else {
    JWT_SECRET = 'gangamaxx-dev-jwt-secret-change-in-production';
    console.warn('WARNING: Using default JWT_SECRET for development. Set JWT_SECRET in .env for production.');
  }
}

const EFFECTIVE_SECRET = JWT_SECRET;

function generateToken(user) {
  return jwt.sign(
    { uid: user.uid, email: user.email, displayName: user.displayName, role: user.role || 'field_staff' },
    EFFECTIVE_SECRET,
    { expiresIn: '7d' }
  );
}

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const decoded = jwt.verify(token, EFFECTIVE_SECRET);
    // Ensure role defaults to field_staff if not present (legacy tokens)
    if (!decoded.role) decoded.role = 'field_staff';
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token. Please log in again.',
      timestamp: new Date().toISOString()
    });
  }
}

function optionalAuth(req, res, next) {
  const token = req.cookies?.token;
  if (token) {
    try {
      req.user = jwt.verify(token, EFFECTIVE_SECRET);
    } catch {
    }
  }
  next();
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

module.exports = { requireAuth, optionalAuth, generateToken, COOKIE_OPTIONS, JWT_SECRET: EFFECTIVE_SECRET };
