/**
 * ============================================================================
 * APP.JS - Express Application Setup
 * ============================================================================
 * Single Database Architecture
 * - No multi-tenant resolver middleware
 * - Simple, straightforward middleware chain
 * ============================================================================
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const requestLogger = require('./middleware/requestLogger');
const { globalLimiter } = require('./config/rateLimiter');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ============================================================================
// SECURITY & PARSING
// ============================================================================

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// LOGGING & RATE LIMITING
// ============================================================================

app.use(requestLogger);
app.use(globalLimiter);

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api', routes);

// ============================================================================
// ERROR HANDLER (Must be last)
// ============================================================================

app.use(errorHandler);

module.exports = app;