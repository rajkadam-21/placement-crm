/**
 * ============================================================================
 * APP.JS - Express Application Setup
 * ============================================================================
 * Single Database Architecture
 * - No multi-tenant resolver middleware
 * - Simple, straightforward middleware chain
 * - Only 2 rate limiters: authLimiter (login), apiLimiter (general)
 * ============================================================================
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');


const requestLogger = require('./middleware/requestLogger');
const { apiLimiter } = require('./config/rateLimiter');
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
app.use(apiLimiter);

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'PCRM API Docs'
  })
);

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api', routes);

// ============================================================================
// ERROR HANDLER (Must be last)
// ============================================================================

app.use(errorHandler);

module.exports = app;