/**
 * ============================================================================
 * ERROR HANDLER MIDDLEWARE
 * ============================================================================
 * Centralized error handling for all unhandled errors
 */

const logger = require('../config/logger');
const { HTTP_STATUS, ERROR_MESSAGES } = require('../config/constants');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled Error', {
    message: err.message,
    code: err.code,
    path: req.path,
    method: req.method
  });

  const status = err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || ERROR_MESSAGES.SERVER_ERROR;

  return res.status(status).json({
    success: false,
    message: message
  });
}

module.exports = errorHandler;