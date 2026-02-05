/**
 * Skillstore Backend
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db');
const skillsRouter = require('./routes/skills');
const purchasesRouter = require('./routes/purchases');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend')));

// API Routes
app.use('/api/skills', skillsRouter);
app.use('/api/purchases', purchasesRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all: serve frontend for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Start server
async function start() {
  try {
    // Initialize database
    await db.init();
    await db.seed();

    app.listen(PORT, () => {
      console.log(`
┌─────────────────────────────────────┐
│         SKILLSTORE.MD               │
├─────────────────────────────────────┤
│  Server:  http://localhost:${PORT}      │
│  API:     http://localhost:${PORT}/api  │
└─────────────────────────────────────┘
      `);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = app;

