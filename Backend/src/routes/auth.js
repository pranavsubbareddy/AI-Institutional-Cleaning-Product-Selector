const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { generateToken, COOKIE_OPTIONS, JWT_SECRET } = require('../middleware/auth');
const { queryOne, run } = require('../database/schema');
const {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendSignupConfirmationEmail,
  sendPasswordResetEmail,
  sendLoginNotificationEmail,
  sendGoogleWelcomeEmail,
} = require('../services/emailService');

// ── Helper: strip passwordHash from user object ──────────────────────────────────
function stripPassword(record) {
  if (!record) return null;
  const { passwordHash, ...user } = record;
  return user;
}

// ── Helper: generate a crypto token ─────────────────────────────────────────────
function generateRandomToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── GET /google-config ───────────────────────────────────────────────────────────
// Returns the Google OAuth client ID so the frontend doesn't need VITE_ prefixed env vars.
router.get('/google-config', (req, res) => {
  res.json({
    success: true,
    data: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      configured: !!process.env.GOOGLE_CLIENT_ID,
    },
    timestamp: new Date().toISOString()
  });
});

// ── POST /signup ────────────────────────────────────────────────────────────────
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

    // Check for existing user — if found, reclaim the account instead of creating a duplicate.
    // This ensures the new user is linked to the same uid and therefore to the existing
    // institutions / recommendations tied to that uid (e.g. seed data from data.json).
    const existing = await queryOne('SELECT * FROM users WHERE email = ?', [normalizedEmail]).catch(() => null);
    if (existing) {
      // Update the existing user's password and display name
      const hashedPassword = await bcrypt.hash(password, 10);
      const displayNameTrimmed = displayName.trim();
      await run(
        'UPDATE users SET passwordHash = ?, displayName = ?, phone = ?, age = ?, gender = ? WHERE email = ?',
        [hashedPassword, displayNameTrimmed, phone || '', age ? Number(age) : null, gender || '', normalizedEmail]
      ).catch(() => {});

      // Generate token for the existing user (their uid stays the same, so institutions stay linked)
      const user = stripPassword(existing);
      user.displayName = displayNameTrimmed;
      user.phone = phone || '';
      user.age = age ? Number(age) : null;
      user.gender = gender || '';

      const token = generateToken(user);
      res.cookie('token', token, COOKIE_OPTIONS);

      return res.json({
        success: true,
        message: 'Welcome back! Your account has been linked to your existing facilities.',
        data: { ...user, emailVerified: !!user.emailVerified },
        timestamp: new Date().toISOString()
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const uid = 'user_' + uuidv4();
    const createdAt = new Date().toISOString();
    const verificationToken = generateRandomToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Insert user as unverified
    await run(
      `INSERT INTO users (uid, email, passwordHash, displayName, phone, age, gender, photoURL, provider, emailVerified, emailVerificationToken, emailVerificationExpires, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [uid, normalizedEmail, hashedPassword, displayName.trim(), phone || '', age ? Number(age) : null, gender || '', null, 'password', verificationToken, verificationExpires, createdAt]
    ).catch(() => {
      // If DB is not available, still create user in memory but skip verification
    });

    const user = {
      uid, displayName: displayName.trim(), email: normalizedEmail,
      phone: phone || '', age: age ? Number(age) : null, gender: gender || '',
      photoURL: null, provider: 'password', emailVerified: false, createdAt
    };

    const token = generateToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    // Send confirmation & verification emails (fire-and-forget)
    sendSignupConfirmationEmail(normalizedEmail, displayName.trim());
    sendVerificationEmail(normalizedEmail, displayName.trim(), verificationToken);

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      data: { ...user, emailVerified: false },
      timestamp: new Date().toISOString()
    });
  } catch (error) { next(error); }
});

// ── POST /login ─────────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required', timestamp: new Date().toISOString() });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Portal seed users (fallback for when DB is unavailable) ────────
    const SEED_USERS = [
      { email: 'admin@ganga-maxx.com', pass: 'Pranav@123', name: 'Super Admin', role: 'admin' },
      { email: 'salesadmin@ganga-maxx.com', pass: 'salesadmin@123', name: 'Sales Administrator', role: 'sales_admin' },
      { email: 'salesman@ganga-maxx.com', pass: 'salesman@123', name: 'Field Sales Agent', role: 'salesman' },
      { email: 'warehouse@ganga-maxx.com', pass: 'warehouse@123', name: 'Warehouse Manager', role: 'warehouse_staff' },
      { email: 'accounts@ganga-maxx.com', pass: 'accounts@123', name: 'Accounts Manager', role: 'accounts_manager' },
      { email: 'compliance@ganga-maxx.com', pass: 'compliance@123', name: 'Compliance Officer', role: 'compliance_admin' },
      { email: 'dealer@ganga-maxx.com', pass: 'dealer@123', name: 'Dealer Distributor', role: 'dealer' },
      { email: 'manager@ganga-maxx.com', pass: 'manager@123', name: 'Facility Manager', role: 'field_staff' },
    ];

    // ── Hardcoded admin login check (credentials from .env) ────────────
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

    if (normalizedEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const adminUser = {
        uid: 'admin',
        email: ADMIN_EMAIL,
        displayName: 'Administrator',
        role: 'admin',
        phone: '',
        photoURL: null,
        provider: 'admin',
        emailVerified: true,
        createdAt: new Date().toISOString()
      };

      const token = generateToken(adminUser);
      res.cookie('token', token, COOKIE_OPTIONS);

      return res.json({
        success: true, message: 'Logged in as Administrator',
        data: { ...adminUser, emailVerified: true },
        timestamp: new Date().toISOString()
      });
    }

    // ── Check seed portal users (works even without DB) ────────────────
    const seedMatch = SEED_USERS.find(u => u.email === normalizedEmail && u.pass === password);
    if (seedMatch) {
      const portalUser = {
        uid: 'user_' + seedMatch.role,
        email: seedMatch.email,
        displayName: seedMatch.name,
        role: seedMatch.role,
        phone: '',
        photoURL: null,
        provider: 'seed',
        emailVerified: true,
        createdAt: new Date().toISOString()
      };

      const token = generateToken(portalUser);
      res.cookie('token', token, COOKIE_OPTIONS);

      return res.json({
        success: true, message: 'Logged in as ' + portalUser.displayName,
        data: { ...portalUser, emailVerified: true },
        timestamp: new Date().toISOString()
      });
    }

    // ── Normal user login (database) ───────────────────────────────────
    const record = await queryOne('SELECT * FROM users WHERE email = ?', [normalizedEmail]).catch(() => null);
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

    // Send login notification email (fire-and-forget, only if email is verified)
    if (user.emailVerified) {
      const ip = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';
      sendLoginNotificationEmail(user.email, user.displayName, ip, userAgent, new Date().toLocaleString());
    }

    res.json({
      success: true, message: 'Logged in successfully',
      data: { ...user, emailVerified: !!user.emailVerified },
      timestamp: new Date().toISOString()
    });
  } catch (error) { next(error); }
});

// ── POST /logout ────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully', timestamp: new Date().toISOString() });
});

// ── GET /me ─────────────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.json({ success: false, authenticated: false, data: null, timestamp: new Date().toISOString() });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // ── Admin user (hardcoded, not in DB) ──────────────────────────
    if (decoded.uid === 'admin' && decoded.role === 'admin') {
      return res.json({
        success: true, authenticated: true,
        data: {
          uid: 'admin',
          email: decoded.email,
          displayName: 'Administrator',
          role: 'admin',
          phone: '',
          photoURL: null,
          provider: 'admin',
          emailVerified: true,
          createdAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    }

    // ── Check seed portal users (persist login without DB) ────────
    const SEED_IDS = ['user_admin', 'user_field_staff', 'user_dealer', 'user_salesman', 'user_warehouse_staff', 'user_accounts_manager', 'user_compliance_admin', 'user_sales_admin'];
    if (SEED_IDS.includes(decoded.uid)) {
      return res.json({
        success: true, authenticated: true,
        data: {
          uid: decoded.uid,
          email: decoded.email,
          displayName: decoded.displayName,
          role: decoded.role,
          phone: decoded.phone || '',
          photoURL: decoded.photoURL || null,
          provider: 'seed',
          emailVerified: true,
          createdAt: decoded.createdAt || new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    }

    // ── Normal user (database) ─────────────────────────────────────
    const record = await queryOne('SELECT * FROM users WHERE uid = ?', [decoded.uid]).catch(() => null);
    if (!record) {
      res.clearCookie('token', { path: '/' });
      return res.json({ success: false, authenticated: false, data: null, timestamp: new Date().toISOString() });
    }

    const user = stripPassword(record);
    res.json({
      success: true, authenticated: true,
      data: { ...user, emailVerified: !!user.emailVerified },
      timestamp: new Date().toISOString()
    });
  } catch {
    res.clearCookie('token', { path: '/' });
    res.json({ success: false, authenticated: false, data: null, timestamp: new Date().toISOString() });
  }
});

// ── POST /resend-verification ───────────────────────────────────────────────────
router.post('/resend-verification', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required', timestamp: new Date().toISOString() });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const record = await queryOne('SELECT * FROM users WHERE uid = ?', [decoded.uid]).catch(() => null);
    if (!record) {
      return res.status(404).json({ success: false, error: 'User not found', timestamp: new Date().toISOString() });
    }

    if (record.emailVerified) {
      return res.json({ success: true, message: 'Email is already verified', timestamp: new Date().toISOString() });
    }

    const verificationToken = generateRandomToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await run(
      'UPDATE users SET emailVerificationToken = ?, emailVerificationExpires = ? WHERE uid = ?',
      [verificationToken, verificationExpires, decoded.uid]
    ).catch(() => {});

    await sendVerificationEmail(record.email, record.displayName, verificationToken);

    res.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Invalid or expired session', timestamp: new Date().toISOString() });
    }
    console.error('[Auth] Resend verification failed:', err);
    res.status(500).json({ success: false, error: 'Failed to send verification email', timestamp: new Date().toISOString() });
  }
});

// ── POST /verify-email ──────────────────────────────────────────────────────────
router.post('/verify-email', async (req, res) => {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({ success: false, error: 'Token and email are required', timestamp: new Date().toISOString() });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = await queryOne(
      'SELECT * FROM users WHERE email = ? AND emailVerificationToken = ?',
      [normalizedEmail, token]
    ).catch(() => null);

    if (!record) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification link', timestamp: new Date().toISOString() });
    }

    if (record.emailVerified) {
      return res.json({ success: true, message: 'Email is already verified', timestamp: new Date().toISOString() });
    }

    // Check expiry
    if (new Date(record.emailVerificationExpires) < new Date()) {
      return res.status(400).json({ success: false, error: 'Verification link has expired. Request a new one.', timestamp: new Date().toISOString() });
    }

    await run(
      'UPDATE users SET emailVerified = 1, emailVerificationToken = NULL, emailVerificationExpires = NULL WHERE email = ?',
      [normalizedEmail]
    ).catch(() => {});

    // Send welcome email
    await sendWelcomeEmail(record.email, record.displayName);

    // Issue new token
    const user = stripPassword(record);
    const authToken = generateToken({ ...user, emailVerified: true });
    res.cookie('token', authToken, COOKIE_OPTIONS);

    res.json({
      success: true,
      message: 'Email verified successfully! Welcome aboard.',
      data: { ...user, emailVerified: true },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Auth] Verify email failed:', err);
    res.status(500).json({ success: false, error: 'Failed to verify email', timestamp: new Date().toISOString() });
  }
});

// ── POST /forgot-password ───────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required', timestamp: new Date().toISOString() });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = await queryOne('SELECT * FROM users WHERE email = ?', [normalizedEmail]).catch(() => null);

    // Always return success to prevent email enumeration
    if (!record) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
        timestamp: new Date().toISOString()
      });
    }

    const resetToken = generateRandomToken();
    // Use ISO string for consistent timezone handling across MySQL and JS
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await run(
      'UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?',
      [resetToken, resetExpires, normalizedEmail]
    ).catch(() => {});

    await sendPasswordResetEmail(record.email, record.displayName, resetToken);

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Auth] Forgot password failed:', err);
    res.status(500).json({ success: false, error: 'Failed to process request', timestamp: new Date().toISOString() });
  }
});

// ── GET /validate-reset-token ───────────────────────────────────────────────────
router.get('/validate-reset-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required', timestamp: new Date().toISOString() });
    }

    const record = await queryOne(
      'SELECT email, displayName, resetPasswordExpires FROM users WHERE resetPasswordToken = ?',
      [token]
    ).catch(() => null);

    if (!record) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset link', timestamp: new Date().toISOString() });
    }

    if (new Date(record.resetPasswordExpires) < new Date()) {
      return res.status(400).json({ success: false, error: 'Reset link has expired. Please request a new one.', timestamp: new Date().toISOString() });
    }

    res.json({
      success: true,
      data: { email: record.email, displayName: record.displayName },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Auth] Validate reset token failed:', err);
    res.status(500).json({ success: false, error: 'Failed to validate token', timestamp: new Date().toISOString() });
  }
});

// ── POST /reset-password ────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token || !email || !newPassword) {
      return res.status(400).json({ success: false, error: 'Token, email, and new password are required', timestamp: new Date().toISOString() });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters', timestamp: new Date().toISOString() });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = await queryOne(
      'SELECT * FROM users WHERE email = ? AND resetPasswordToken = ?',
      [normalizedEmail, token]
    ).catch(() => null);

    if (!record) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset link', timestamp: new Date().toISOString() });
    }

    if (new Date(record.resetPasswordExpires) < new Date()) {
      return res.status(400).json({ success: false, error: 'Reset link has expired. Please request a new one.', timestamp: new Date().toISOString() });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await run(
      'UPDATE users SET passwordHash = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE email = ?',
      [hashedPassword, normalizedEmail]
    ).catch(() => {});

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Auth] Reset password failed:', err);
    res.status(500).json({ success: false, error: 'Failed to reset password', timestamp: new Date().toISOString() });
  }
});

// ── PUT /profile ────────────────────────────────────────────────────────────────
router.put('/profile', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required', timestamp: new Date().toISOString() });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { displayName, phone, age, gender } = req.body;

    const updates = [];
    const params = [];

    if (displayName !== undefined) {
      updates.push('displayName = ?');
      params.push(displayName.trim());
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (age !== undefined) {
      updates.push('age = ?');
      params.push(age ? Number(age) : null);
    }
    if (gender !== undefined) {
      updates.push('gender = ?');
      params.push(gender);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update', timestamp: new Date().toISOString() });
    }

    params.push(decoded.uid);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE uid = ?`, params).catch(() => {});

    const record = await queryOne('SELECT * FROM users WHERE uid = ?', [decoded.uid]).catch(() => null);
    if (!record) {
      return res.status(404).json({ success: false, error: 'User not found', timestamp: new Date().toISOString() });
    }

    const user = stripPassword(record);

    // Re-issue token with updated info
    const newToken = generateToken(user);
    res.cookie('token', newToken, COOKIE_OPTIONS);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { ...user, emailVerified: !!user.emailVerified },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Invalid or expired session', timestamp: new Date().toISOString() });
    }
    console.error('[Auth] Profile update failed:', err);
    res.status(500).json({ success: false, error: 'Failed to update profile', timestamp: new Date().toISOString() });
  }
});

// ── POST /google (Google Sign-In) ───────────────────────────────────────────────
// Accepts either:
//   1. { idToken: string } — a Google ID token (JWT) from One Tap / Sign-In button
//   2. { code: string }    — an OAuth authorization code from the popup flow
// Auto-detects the type: if the value has 3 dot-separated segments it's treated
// as a JWT; otherwise it's treated as an auth code and exchanged for tokens.
router.post('/google', async (req, res) => {
  try {
    const { idToken, code } = req.body;

    const { OAuth2Client } = require('google-auth-library');
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        success: false, error: 'Google Sign-In is not configured. Set GOOGLE_CLIENT_ID environment variable.',
        timestamp: new Date().toISOString()
      });
    }

    let payload;

    if (!idToken && !code) {
      return res.status(400).json({ success: false, error: 'Either idToken or code is required', timestamp: new Date().toISOString() });
    }

    // Accept credential in either idToken or code field
    const credential = idToken || code;

    // Auto-detect: Google ID tokens (JWTs) have 3 dot-separated segments
    const isJwt = (credential.match(/\./g) || []).length === 2;

    if (isJwt) {
      // Case 1: Direct ID token (JWT) from One Tap or Google Sign-In button
      const client = new OAuth2Client(GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else {
      // Case 2: Authorization code — exchange it for tokens
      const redirectUri = req.body.redirectUri || 'postmessage';
      const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
      const { tokens } = await client.getToken(credential);

      if (!tokens.id_token) {
        return res.status(400).json({ success: false, error: 'Failed to get ID token from authorization code', timestamp: new Date().toISOString() });
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    }
    const googleId = payload['sub'];
    const email = payload['email'].toLowerCase().trim();
    const displayName = payload['name'] || payload['email'].split('@')[0];
    const photoURL = payload['picture'] || null;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Google account has no email', timestamp: new Date().toISOString() });
    }

    // Check if user exists by email or google uid
    let record = await queryOne(
      'SELECT * FROM users WHERE email = ? OR (provider = ? AND uid = ?)',
      [email, 'google', 'google_' + googleId]
    ).catch(() => null);

    let isNewUser = false;

    if (record) {
      // Update Google UID and photo if logging in with Google for first time
      if (record.provider !== 'google') {
        await run(
          'UPDATE users SET provider = ?, photoURL = ?, uid = ?, emailVerified = 1 WHERE email = ?',
          ['google', photoURL, 'google_' + googleId, email]
        ).catch(() => {});
      } else if (photoURL) {
        await run('UPDATE users SET photoURL = ? WHERE uid = ?', [photoURL, record.uid]).catch(() => {});
      }
    } else {
      // Create new user with Google provider
      const uid = 'google_' + googleId;
      const createdAt = new Date().toISOString();

      await run(
        `INSERT INTO users (uid, email, passwordHash, displayName, phone, age, gender, photoURL, provider, emailVerified, createdAt)
         VALUES (?, ?, '', ?, '', NULL, '', ?, 'google', 1, ?)`,
        [uid, email, displayName, photoURL || null, createdAt]
      ).catch(() => {});
      isNewUser = true;
    }

    // Fetch the (possibly updated) record
    record = await queryOne('SELECT * FROM users WHERE email = ?', [email]).catch(() => null);
    if (!record) {
      return res.status(500).json({ success: false, error: 'Failed to create/find user', timestamp: new Date().toISOString() });
    }

    const user = stripPassword(record);
    const authToken = generateToken(user);
    res.cookie('token', authToken, COOKIE_OPTIONS);

    // Send welcome email for new Google users
    if (isNewUser) {
      sendGoogleWelcomeEmail(user.email, user.displayName);
    }

    res.json({
      success: true,
      message: isNewUser ? 'Account created with Google' : 'Signed in with Google',
      data: { ...user, emailVerified: true },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Auth] Google sign-in failed:', err);
    res.status(401).json({ success: false, error: 'Invalid Google token. Please try signing in again.', timestamp: new Date().toISOString() });
  }
});

// ── DELETE /account ────────────────────────────────────────────────────────────
router.delete('/account', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required', timestamp: new Date().toISOString() });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const uid = decoded.uid;

    const user = await queryOne('SELECT uid FROM users WHERE uid = ?', [uid]).catch(() => null);
    if (!user) {
      res.clearCookie('token', { path: '/' });
      return res.status(404).json({ success: false, error: 'User not found', timestamp: new Date().toISOString() });
    }

    await run('DELETE FROM institutions WHERE user_id = ?', [uid]).catch(() => {});
    await run('DELETE FROM users WHERE uid = ?', [uid]).catch(() => {});
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
