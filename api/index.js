// ─────────────────────────────────────────────────────────────────────────
// Vercel Serverless Entry Point
// ─────────────────────────────────────────────────────────────────────────
// Vercel routes /api/* requests to this file as a serverless function.
// It re-exports the Express app from the main server.
// This file serves as the bridge between Vercel's serverless runtime
// and the Express application defined in Backend/server.js.

const app = require('../Backend/server');

module.exports = app;
