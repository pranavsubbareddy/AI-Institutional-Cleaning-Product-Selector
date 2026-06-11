// Vercel Serverless Entry Point
// Uses MySQL database for persistent storage (via PlanetScale)
// Set DATABASE_URL in Vercel environment variables to connect
const app = require('./db');

module.exports = app;
