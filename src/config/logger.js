/**
 * ============================================================================
 * LOGGER.JS - Winston Logger Configuration (OPTIMIZED)
 * ============================================================================
 * 
 * Features:
 * - Structured JSON logging
 * - Console output (development)
 * - File-based logging with rotation (production)
 * - Essential logs only (optimized for performance)
 * - Error stack trace logging
 * - Log level control via environment
 * 
 * Log Levels:
 * - error: System errors, exceptions
 * - warn: Validation failures, security issues
 * - info: API operations, successful operations
 * - debug: Detailed flow (development only)
 * 
 * ============================================================================
 */

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');
const { LOG } = require('./constants');

// ============================================================================
// CREATE LOGS DIRECTORY
// ============================================================================

const logsDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ============================================================================
// LOG FORMAT DEFINITIONS
// ============================================================================

/**
 * Console Format (Human-readable)
 * Example: 2025-12-07T13:26:45.123Z [INFO]: [API_START] POST /endpoint user_id=123
 */
const consoleFormat = format.printf(({ level, message, timestamp, meta, stack }) => {
  const metaStr = meta && Object.keys(meta).length > 0
    ? Object.entries(meta)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ')
    : '';

  const stackStr = stack ? `\n${stack}` : '';

  return `${timestamp} [${level}]: ${message} ${metaStr}${stackStr}`;
});

/**
 * JSON Format (Structured)
 * For easy parsing and analysis
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
// TRANSPORTS
// ============================================================================

// Console Transport (All environments)
const consoleTransport = new transports.Console({
  level: logLevel,
  format: format.combine(
    format.colorize(),
    format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    format.errors({ stack: true }),
    consoleFormat
  )
});

// Error Log File (Production & Staging)
const errorFileTransport = new transports.File({
  filename: path.join(logsDir, 'error.log'),
  level: 'error',
  maxsize: 10485760, // 10MB
  maxFiles: 5,
  format: jsonFormat
});

// Combined Log File (Production & Staging)
const combinedFileTransport = new transports.File({
  filename: path.join(logsDir, 'combined.log'),
  level: logLevel,
  maxsize: 10485760, // 10MB
  maxFiles: 10,
  format: jsonFormat
});

// Info Log File (Production & Staging)
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

if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  transportsList = [
    consoleTransport,
    errorFileTransport,
    infoFileTransport,
    combinedFileTransport
  ];
}

// ============================================================================
// CREATE LOGGER
// ============================================================================

const logger = createLogger({
  defaultMeta: {
    service: 'college-crm-api',
    environment: process.env.NODE_ENV || 'development'
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
// EXPORT
// ============================================================================

module.exports = logger;