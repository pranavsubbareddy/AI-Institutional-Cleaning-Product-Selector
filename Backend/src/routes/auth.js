const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { generateToken, COOKIE_OPTIONS } = require('../middleware/auth');

const USERS = [];

router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, displayName, phone, age, gender } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ success: false, error: 'Email, password, and display name are required', timestamp: new Date().toISOString() });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters', timestamp: new Date().toISOString() });
    }

    const existing = USERS.find(u => u.email === email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists', timestamp: new Date().toISOString() });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      uid: 'user_' + uuidv4(),
      displayName: displayName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || '',
      age: age ? Number(age) : null,
      gender: gender || '',
      photoURL: null,
      provider: 'password',
      createdAt: new Date().toISOString(),
    };

    USERS.push({ ...user, passwordHash: hashedPassword });

    const token = generateToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { uid: user.uid, displayName: user.displayName, email: user.email, phone: user.phone, age: user.age, gender: user.gender, photoURL: user.photoURL, provider: user.provider, createdAt: user.createdAt },
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

    const record = USERS.find(u => u.email === email.toLowerCase().trim());
    if (!record) {
      return res.status(401).json({ success: false, error: 'Invalid email or password', timestamp: new Date().toISOString() });
    }

    const validPassword = await bcrypt.compare(password, record.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid email or password', timestamp: new Date().toISOString() });
    }

    const user = {
      uid: record.uid, displayName: record.displayName, email: record.email,
      phone: record.phone || '', age: record.age || null, gender: record.gender || '',
      photoURL: record.photoURL, provider: record.provider, createdAt: record.createdAt,
    };

    const token = generateToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({ success: true, message: 'Logged in successfully', data: user, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully', timestamp: new Date().toISOString() });
});

router.get('/me', (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.json({ success: false, authenticated: false, data: null, timestamp: new Date().toISOString() });
  }

  try {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    const record = USERS.find(u => u.uid === decoded.uid);
    if (!record) {
      res.clearCookie('token', { path: '/' });
      return res.json({ success: false, authenticated: false, data: null, timestamp: new Date().toISOString() });
    }

    res.json({
      success: true, authenticated: true,
      data: { uid: record.uid, displayName: record.displayName, email: record.email, phone: record.phone || '', age: record.age || null, gender: record.gender || '', photoURL: record.photoURL, provider: record.provider, createdAt: record.createdAt },
      timestamp: new Date().toISOString()
    });
  } catch {
    res.clearCookie('token', { path: '/' });
    res.json({ success: false, authenticated: false, data: null, timestamp: new Date().toISOString() });
  }
});

module.exports = router;
