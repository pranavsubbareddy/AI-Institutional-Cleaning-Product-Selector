// Vercel Serverless Entry Point
// Currently uses in-memory storage via Backend/server.js
// To switch to persistent MySQL (PlanetScale), uncomment the line below and set DATABASE_URL in Vercel env:
// const app = require('./db');
const app = require('../Backend/server');

module.exports = app;
