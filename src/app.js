const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const requestLogger = require('./middleware/requestLogger');
const tenantResolver = require('./middleware/tenantResolver');
const { globalLimiter } = require('./config/rateLimiter'); // destructure globalLimiter
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging & rate limiting
app.use(requestLogger);
app.use(globalLimiter); // <- USE middleware here

// Tenant resolution
app.use(tenantResolver);

// Health check
app.get('/health', (req, res) => res.json({ ok: true, tenant: req.tenant || null }));

// API routes
app.use('/api/v1', routes);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
