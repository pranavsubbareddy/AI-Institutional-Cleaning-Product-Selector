// Vercel Serverless Entry Point
// Imports the Express app from the backend and exports it as a serverless function handler
const app = require('../Backend/server');

// Vercel expects the exported handler to be a function or a full Express app
module.exports = app;
