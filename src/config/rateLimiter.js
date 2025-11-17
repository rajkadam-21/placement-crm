/**
 * ============================================================================
 * RATE LIMITER CONFIGURATION - express-rate-limit Setup
 * ============================================================================
 * 
 * Features:
 * - Global API rate limiting
 * - Endpoint-specific rate limiters
 * - Skip conditions (admin/sysadmin bypass)
 * - Custom key generation (IP + User ID)
 * - Memory/Redis store support
 * - Logging for rate limit violations
 * - Custom error responses
 * 
 * Rate Limit Tiers:
 * - Global: 100 requests per 15 minutes (default)
 * - Auth: 5 attempts per 15 minutes (strict)
 * - API: 50 requests per minute (moderate)
 * - Upload: 10 requests per hour (strict for uploads)
 * 
 * Usage:
 * app.use(globalLimiter);
 * router.post('/login', authLimiter, controller.login);
 * router.post('/upload', uploadLimiter, controller.upload);
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
// HELPER: SKIP CONDITION FOR ADMINS
// ============================================================================

/**
 * Skip rate limiting for system admins and authorized users
 * 
 * @param {Object} req - Express request
 * @returns {boolean} True to skip limiting
 */
function skipForAdmins(req) {
  // Skip for system admin
  if (req.user && req.user.role === ROLES.SYSADMIN) {
    return true;
  }

  // Skip for health check endpoint
  if (req.path === '/health') {
    return true;
  }

  return false;
}

// ============================================================================
// HELPER: RATE LIMIT HANDLER
// ============================================================================

/**
 * Custom handler for rate limit exceeded
 * Logs violation and returns error response
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Object} options - Rate limiter options
 */
function rateLimitHandler(req, res, options) {
  logger.security(
    `${LOG.SECURITY_PREFIX} Rate limit exceeded`,
    'warn',
    {
      ip: req.ip,
      user_id: req.user?.id,
      user_role: req.user?.role,
      method: req.method,
      path: req.path,
      limit: options.limit,
      window_ms: options.windowMs
    }
  );

  return res.status(options.statusCode || HTTP_STATUS.TOO_MANY_REQUESTS).json({
    success: false,
    message: 'Too many requests, please try again later',
    retryAfter: req.rateLimit?.resetTime
  });
}

// ============================================================================
// GLOBAL RATE LIMITER
// ============================================================================

/**
 * Global API rate limiter
 * - 100 requests per 15 minutes per IP
 * - Skips for admins and health check
 * - Applied to all routes
 */
const globalLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS_DEFAULT,
  max: RATE_LIMIT.MAX_REQUESTS_DEFAULT,
  keyGenerator: getKey,
  skip: skipForAdmins,
  handler: (req, res, options) => {
    // Log when limit is exceeded
    logger.warn(`${LOG.API_START_PREFIX} Rate limit reached`, {
      ip: req.ip,
      method: req.method,
      path: req.path,
      limit: options.max,
      window: options.windowMs / 60000 + ' minutes'
    });

    // Send response
    return res.status(options.statusCode || 429).json({
      success: false,
      message: 'Too many requests, please try again later.',
      retryAfter: req.rateLimit?.resetTime
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// AUTH LIMITER (STRICT)
// ============================================================================

/**
 * Strict rate limiter for authentication endpoints
 * - 5 attempts per 15 minutes
 * - Higher penalty for failed login attempts
 * - No bypass for admins (security feature)
 */
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS_AUTH, // 15 minutes
  max: RATE_LIMIT.MAX_REQUESTS_AUTH, // 5 attempts
  keyGenerator: getKey,
  skip: (req) => false, // Never skip for auth (even admins)
  handler: (req, res) => {
    logger.security(
      'Multiple login attempts - possible brute force',
      'error',
      {
        ip: req.ip,
        user_email: req.body?.email,
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
 * - Skips for admins
 */
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS_API, // 1 minute
  max: RATE_LIMIT.MAX_REQUESTS_API, // 50 requests
  keyGenerator: getKey,
  skip: skipForAdmins,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// UPLOAD LIMITER (STRICT)
// ============================================================================

/**
 * Strict rate limiter for file uploads
 * - 10 uploads per hour
 * - Prevents storage exhaustion
 * - Logs all upload attempts
 */
const uploadLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS_UPLOAD, // 1 hour
  max: RATE_LIMIT.MAX_REQUESTS_UPLOAD, // 10 uploads
  keyGenerator: getKey,
  skip: skipForAdmins,
  handler: (req, res) => {
    logger.security(
      'Upload rate limit exceeded',
      'warn',
      {
        ip: req.ip,
        user_id: req.user?.id,
        window: '1 hour',
        limit: 10
      }
    );

    return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      message: 'Upload limit exceeded. Maximum 10 uploads per hour.',
      retryAfter: req.rateLimit?.resetTime
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// TENANT LIMITER (MODERATE - PER TENANT)
// ============================================================================

/**
 * Tenant-specific rate limiter
 * - 100 requests per 15 minutes per tenant
 * - Prevents one tenant from overwhelming system
 */
const tenantLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS_DEFAULT, // 15 minutes
  max: RATE_LIMIT.MAX_REQUESTS_DEFAULT, // 100 requests
  keyGenerator: (req) => {
    // Use tenant_id if available
    if (req.tenant && req.tenant.tenant_id) {
      return `tenant:${req.tenant.tenant_id}`;
    }
    return getKey(req);
  },
  skip: skipForAdmins,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// COLLEGE LIMITER (MODERATE - PER COLLEGE)
// ============================================================================

/**
 * College-specific rate limiter
 * - 200 requests per 15 minutes per college
 * - Allows more traffic than tenant limiter
 */
const collegeLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS_DEFAULT, // 15 minutes
  max: RATE_LIMIT.MAX_REQUESTS_COLLEGE, // 200 requests
  keyGenerator: (req) => {
    // Use college_id if available
    if (req.user && req.user.college_id) {
      return `college:${req.user.college_id}`;
    }
    return getKey(req);
  },
  skip: skipForAdmins,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// SEARCH LIMITER (STRICT)
// ============================================================================

/**
 * Strict rate limiter for search operations
 * - 30 searches per minute
 * - Prevents search-based attacks
 */
const searchLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS_SEARCH, // 1 minute
  max: RATE_LIMIT.MAX_REQUESTS_SEARCH, // 30 searches
  keyGenerator: getKey,
  skip: skipForAdmins,
  handler: (req, res) => {
    logger.warn(
      `${LOG.API_START_PREFIX} Search rate limit exceeded`,
      {
        ip: req.ip,
        user_id: req.user?.id,
        query: req.query?.q?.substring(0, 50)
      }
    );

    return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      message: 'Search limit exceeded. Please try again in a few moments.'
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main limiters
  globalLimiter,
  authLimiter,
  apiLimiter,
  uploadLimiter,

  // Specialized limiters
  tenantLimiter,
  collegeLimiter,
  searchLimiter,

  // Helper functions
  getKey,
  skipForAdmins,
  rateLimitHandler
};