/**
 * ============================================================================
 * REQUEST LOGGER MIDDLEWARE
 * ============================================================================
 * Logs HTTP requests with method, URL, status, and duration
 */

const morgan = require('morgan');
const logger = require('../config/logger');

morgan.token('body', (req) => JSON.stringify(req.body || {}));

const stream = {
  write: (message) => logger.info(message.trim())
};

const requestLogger = morgan(
  ':method :url :status - :response-time ms',
  { stream }
);

module.exports = requestLogger;