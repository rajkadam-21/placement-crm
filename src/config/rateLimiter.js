/**
 * ============================================================================
 * RATE LIMITER CONFIGURATION - express-rate-limit Setup
 * ============================================================================
 * 
 * Features:
 * - Auth rate limiting (5 attempts per 15 minutes)
 * - API rate limiting (50 requests per minute)
 * - Logging for rate limit violations
 * - Custom error responses
 * 
 * Usage:
 * router.post('/login', authLimiter, controller.login);
 * router.get('/colleges', apiLimiter, controller.listColleges);
 * ============================================================================
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const logger = require('./logger');
const {
  RATE_LIMIT,
  HTTP_STATUS,
  LOG,
  ROLES
} = require('./constants');

// ============================================================================
// HELPER: CUSTOM KEY GENERATOR
// ============================================================================

/**
 * Generate unique key for rate limiting
 * Combines IP address and user ID (if authenticated)
 * 
 * @param {Object} req - Express request
 * @returns {string} Unique key
 */
function getKey(req) {
  const ip = ipKeyGenerator(req); // Normalize IPv4/IPv6 correctly

  if (req.user && req.user.id) {
    return `${ip}:${req.user.id}`;
  }
  return ip;
}

// ============================================================================
// HELPER: SKIP CONDITION FOR SYSADMIN
// ============================================================================

/**
 * Skip rate limiting for system admins
 * 
 * @param {Object} req - Express request
 * @returns {boolean} True to skip limiting
 */
function skipForSysAdmin(req) {
  // Skip for system admin
  if (req.user && req.user.role === ROLES.SYSADMIN) {
    return true;
  }
  return false;
}

// ============================================================================
// AUTH LIMITER (STRICT)
// ============================================================================

/**
 * Strict rate limiter for authentication endpoints
 * - 5 attempts per 15 minutes
 * - No bypass for admins (security feature)
 */
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS_AUTH, // 15 minutes
  max: RATE_LIMIT.MAX_REQUESTS_AUTH, // 5 attempts
  keyGenerator: getKey,
  skip: (req) => false, // Never skip for auth (even admins)
  handler: (req, res) => {
    logger.warn(
      `${LOG.SECURITY_PREFIX} Multiple login attempts - possible brute force`,
      {
        ip: req.ip,
        user_email: req.body?.email || req.body?.student_email,
        attempt_count: req.rateLimit?.current,
        reset_time: req.rateLimit?.resetTime
      }
    );

    return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      message: 'Too many login attempts. Please try again in 15 minutes.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime - Date.now()) / 1000)
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// API LIMITER (MODERATE)
// ============================================================================

/**
 * Moderate rate limiter for general API endpoints
 * - 50 requests per minute
 * - Allows burst traffic
 * - Skips for sysadmin
 */
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS_API, // 1 minute
  max: RATE_LIMIT.MAX_REQUESTS_API, // 50 requests
  keyGenerator: getKey,
  skip: skipForSysAdmin,
  handler: (req, res) => {
    logger.warn(
      `${LOG.API_START_PREFIX} Rate limit exceeded`,
      {
        ip: req.ip,
        user_id: req.user?.id,
        method: req.method,
        path: req.path
      }
    );

    return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      message: 'Too many requests, please try again later',
      retryAfter: req.rateLimit?.resetTime
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  authLimiter,
  apiLimiter,
  getKey,
  skipForSysAdmin
};