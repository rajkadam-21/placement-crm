/**
 * ============================================================================
 * LOGGER CONFIGURATION - Winston Logger Setup
 * ============================================================================
 * 
 * Features:
 * - Structured JSON logging for all environments
 * - Console output with colors (development)
 * - File-based logging with rotation (production)
 * - Request/Response logging
 * - Error stack trace logging
 * - Log level control via environment
 * - Metadata tracking (user_id, tenant_id, IP, etc.)
 * 
 * Log Levels:
 * - error: 0 - System errors, exceptions
 * - warn: 1 - Warnings, validation failures
 * - info: 2 - API calls, successful operations
 * - debug: 3 - Detailed flow information
 * 
 * Usage:
 * logger.error('Error message', { error: err.message, code: err.code })
 * logger.warn('Warning message', { user_id: '123' })
 * logger.info('Info message', { operation: 'user_created' })
 * logger.debug('Debug message', { variable: value })
 * ============================================================================
 */

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, json, colorize, errors } = format;
const path = require('path');
const fs = require('fs');

const { LOG, LOG_LEVELS } = require('./constants');

// ============================================================================
// CREATE LOGS DIRECTORY (if doesn't exist)
// ============================================================================

const logsDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ============================================================================
// LOG FORMAT DEFINITIONS
// ============================================================================

/**
 * Console Format (Development)
 * Human-readable format with colors
 * 
 * Example:
 * 2025-11-16T20:30:45.123Z [ERROR]: [API_ERROR] POST /users error=... user_id=...
 */
const consoleFormat = printf(({ level, message, timestamp, meta, stack }) => {
  // Build metadata string
  const metaStr = meta && Object.keys(meta).length > 0 
    ? Object.entries(meta)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ')
    : '';

  // Add stack trace for errors
  const stackStr = stack ? `\n${stack}` : '';

  return `${timestamp} [${level}]: ${message} ${metaStr}${stackStr}`;
});

/**
 * JSON Format (All transports)
 * Structured JSON for easy parsing and analysis
 * 
 * Includes:
 * - timestamp
 * - level
 * - message
 * - meta (context data)
 * - stack (error stack trace)
 * - service (application name)
 * - environment
 */
const jsonFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.json()
);

// ============================================================================
// DETERMINE LOG LEVEL
// ============================================================================

const logLevel = process.env.LOG_LEVEL || 'info';

if (!['error', 'warn', 'info', 'debug'].includes(logLevel)) {
  console.warn(`Invalid LOG_LEVEL: ${logLevel}. Defaulting to 'info'`);
}

// ============================================================================
// TRANSPORT: CONSOLE (All Environments)
// ============================================================================

const consoleTransport = new transports.Console({
  level: logLevel,
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    errors({ stack: true }),
    consoleFormat
  )
});

// ============================================================================
// TRANSPORT: ERROR LOG FILE (Production & Staging)
// ============================================================================

const errorFileTransport = new transports.File({
  filename: path.join(logsDir, 'error.log'),
  level: 'error',
  maxsize: 10485760, // 10MB
  maxFiles: 5, // Keep 5 files
  format: jsonFormat
});

// ============================================================================
// TRANSPORT: COMBINED LOG FILE (Production & Staging)
// ============================================================================

const combinedFileTransport = new transports.File({
  filename: path.join(logsDir, 'combined.log'),
  level: logLevel,
  maxsize: 10485760, // 10MB
  maxFiles: 10, // Keep 10 files
  format: jsonFormat
});

// ============================================================================
// TRANSPORT: INFO LOG FILE (Production & Staging)
// ============================================================================

const infoFileTransport = new transports.File({
  filename: path.join(logsDir, 'info.log'),
  level: 'info',
  maxsize: 10485760, // 10MB
  maxFiles: 5,
  format: jsonFormat
});

// ============================================================================
// BUILD TRANSPORTS ARRAY
// ============================================================================

let transportsList = [consoleTransport];

// Add file transports in production and staging
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  transportsList = [
    consoleTransport,
    errorFileTransport,     // ERROR level only
    infoFileTransport,      // INFO level
    combinedFileTransport   // ALL levels
  ];
}

// ============================================================================
// CREATE LOGGER
// ============================================================================

const logger = createLogger({
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'college-crm-api',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.API_VERSION || '1.0.0'
  },
  format: jsonFormat,
  transports: transportsList,
  exceptionHandlers: [
    new transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: jsonFormat
    })
  ],
  rejectionHandlers: [
    new transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: jsonFormat
    })
  ]
});

// ============================================================================
// HELPER FUNCTIONS FOR STRUCTURED LOGGING
// ============================================================================

/**
 * Log API start event
 */
logger.apiStart = (method, endpoint, userId, ip, additionalMeta = {}) => {
  logger.info(`${LOG.API_START_PREFIX} ${method} ${endpoint}`, {
    user_id: userId,
    ip: ip,
    ...additionalMeta
  });
};

/**
 * Log API success event
 */
logger.apiEnd = (method, endpoint, duration, additionalMeta = {}) => {
  logger.info(`${LOG.API_END_PREFIX} ${method} ${endpoint}`, {
    duration_ms: duration,
    ...additionalMeta
  });
};

/**
 * Log API error event
 */
logger.apiError = (method, endpoint, error, additionalMeta = {}) => {
  logger.error(`${LOG.API_ERROR_PREFIX} ${method} ${endpoint}`, {
    error_message: error.message,
    error_code: error.code,
    stack: error.stack,
    ...additionalMeta
  });
};

/**
 * Log transaction event
 */
logger.transaction = (operation, status, additionalMeta = {}) => {
  const level = status === 'start' ? 'debug' : status === 'commit' ? 'info' : 'error';
  logger[level](`${LOG.TRANSACTION_PREFIX} ${operation} - ${status}`, additionalMeta);
};

/**
 * Log security event
 */
logger.security = (event, level = 'warn', additionalMeta = {}) => {
  logger[level](`${LOG.SECURITY_PREFIX} ${event}`, additionalMeta);
};

/**
 * Log validation failure
 */
logger.validation = (event, additionalMeta = {}) => {
  logger.warn(`${LOG.VALIDATION_PREFIX} ${event}`, additionalMeta);
};

// ============================================================================
// EXPORT
// ============================================================================

module.exports = logger;