const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gangamaxx-dev-jwt-secret-change-in-production';

function generateToken(user) {
  return jwt.sign(
    { uid: user.uid, email: user.email, displayName: user.displayName },
    JWT_SECRET,
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
    const decoded = jwt.verify(token, JWT_SECRET);
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
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
    }
  }
  next();
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

module.exports = { requireAuth, optionalAuth, generateToken, COOKIE_OPTIONS, JWT_SECRET };
