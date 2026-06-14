// ═══════════════════════════════════════════════════════════════════════
// Vercel Serverless Entry Point
// ═══════════════════════════════════════════════════════════════════════
//
// Uses in-memory storage via Backend/server.js (data.json for persistence).
// On Vercel, data.json can be read (deployed with code) but writes are
// ephemeral — data resets on cold starts. For persistent storage, set
// DATABASE_URL in Vercel env and switch to the MySQL-backed db.js below.
//
// To use MySQL: set DATABASE_URL in Vercel project env, then change:
//   const app = require('./db');   // ← uncomment this
//   // const app = require('../Backend/server');  // ← comment this
// ═══════════════════════════════════════════════════════════════════════

// Prevent dotenv from reading .env in Vercel production (env vars are
// injected by Vercel's dashboard instead)
if (process.env.VERCEL !== '1') {
  require('dotenv').config({ override: true });
}

const app = require('../Backend/server');

module.exports = app;
