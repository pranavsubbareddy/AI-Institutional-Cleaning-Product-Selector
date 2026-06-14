const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { generateToken, COOKIE_OPTIONS, JWT_SECRET } = require('../middleware/auth');
const { queryOne, run } = require('../database/schema');

// ── Helper: strip passwordHash from user object ──────────────────────────────────
function stripPassword(record) {
  if (!record) return null;
  const { passwordHash, ...user } = record;
  return user;
}

router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, displayName, phone, age, gender } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ success: false, error: 'Email, password, and display name are required', timestamp: new Date().toISOString() });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters', timestamp: new Date().toISOString() });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing user in database
    const existing = await queryOne('SELECT uid FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists', timestamp: new Date().toISOString() });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const uid = 'user_' + uuidv4();
    const createdAt = new Date().toISOString();

    await run(
      `INSERT INTO users (uid, email, passwordHash, displayName, phone, age, gender, photoURL, provider, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid, normalizedEmail, hashedPassword, displayName.trim(), phone || '', age ? Number(age) : null, gender || '', null, 'password', createdAt]
    );

    const user = { uid, displayName: displayName.trim(), email: normalizedEmail, phone: phone || '', age: age ? Number(age) : null, gender: gender || '', photoURL: null, provider: 'password', createdAt };

    const token = generateToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: user,
      timestamp: new Date().toISOString()
    });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required', timestamp: new Date().toISOString() });
    }

    const record = await queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!record) {
      return res.status(401).json({ success: false, error: 'Invalid email or password', timestamp: new Date().toISOString() });
    }

    const validPassword = await bcrypt.compare(password, record.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid email or password', timestamp: new Date().toISOString() });
    }

    const user = stripPassword(record);

    const token = generateToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({ success: true, message: 'Logged in successfully', data: user, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully', timestamp: new Date().toISOString() });
});

router.get('/me', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.json({ success: false, authenticated: false, data: null, timestamp: new Date().toISOString() });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const record = await queryOne('SELECT * FROM users WHERE uid = ?', [decoded.uid]);
    if (!record) {
      res.clearCookie('token', { path: '/' });
      return res.json({ success: false, authenticated: false, data: null, timestamp: new Date().toISOString() });
    }

    const user = stripPassword(record);
    res.json({
      success: true, authenticated: true,
      data: user,
      timestamp: new Date().toISOString()
    });
  } catch {
    res.clearCookie('token', { path: '/' });
    res.json({ success: false, authenticated: false, data: null, timestamp: new Date().toISOString() });
  }
});

// ── Delete Account ──────────────────────────────────────────────────────
// Requires JWT auth. Deletes all user's institutions (cascading to
// recommendations, items, orders, etc.) and then deletes the user record.
router.delete('/account', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required', timestamp: new Date().toISOString() });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const uid = decoded.uid;

    // Verify user still exists
    const user = await queryOne('SELECT uid FROM users WHERE uid = ?', [uid]);
    if (!user) {
      res.clearCookie('token', { path: '/' });
      return res.status(404).json({ success: false, error: 'User not found', timestamp: new Date().toISOString() });
    }

    // Delete all institutions owned by this user (cascades to recommendations, items, etc.)
    await run('DELETE FROM institutions WHERE user_id = ?', [uid]);

    // Delete the user record
    await run('DELETE FROM users WHERE uid = ?', [uid]);

    // Clear the auth cookie
    res.clearCookie('token', { path: '/' });

    res.json({ success: true, message: 'Account and all associated data permanently deleted', timestamp: new Date().toISOString() });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      res.clearCookie('token', { path: '/' });
      return res.status(401).json({ success: false, error: 'Invalid or expired token', timestamp: new Date().toISOString() });
    }
    console.error('[Auth] Delete account failed:', err);
    res.status(500).json({ success: false, error: 'Failed to delete account', timestamp: new Date().toISOString() });
  }
});

module.exports = router;
