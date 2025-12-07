/**
 * ============================================================================
 * RESPONSE HELPER - Standardized Response Formatting
 * ============================================================================
 * Provides consistent response structure for success and error responses
 * 
 * Usage:
 * - success(res, data, message, status)
 * - error(res, message, status, details)
 */

/**
 * Send success response
 * 
 * @param {Object} res - Express response object
 * @param {*} data - Response payload (object, array, or empty object)
 * @param {string} message - Success message (optional, defaults to 'OK')
 * @param {number} status - HTTP status code (optional, defaults to 200)
 * @returns {Object} JSON response { success: true, message, data }
 */
function success(res, data = {}, message = 'OK', status = 200) {
  return res.status(status).json({
    success: true,
    message: message,
    data: data
  });
}

/**
 * Send error response
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message (required)
 * @param {number} status - HTTP status code (required)
 * @param {Object} details - Additional error details (optional)
 * @returns {Object} JSON response { success: false, message, details? }
 */
function error(res, message = 'Error', status = 400, details = null) {
  const payload = {
    success: false,
    message: message
  };

  if (details) {
    payload.details = details;
  }

  return res.status(status).json(payload);
}

module.exports = { success, error };