const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  logger.error('UnhandledError', { message: err.message, stack: err.stack });
  const status = err.status || 500;
  res.status(status).json({ success: false, message: err.message || 'Internal Server Error' });
}

module.exports = errorHandler;
