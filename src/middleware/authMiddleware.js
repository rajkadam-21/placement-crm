/**
 * ============================================================================
 * AUTH MIDDLEWARE - Authentication & Authorization (SIMPLIFIED)
 * ============================================================================
 * Handles JWT validation and role-based access control
 * Single database - no multi-tenant pool logic
 * ============================================================================
 */

const jwtHelper = require('../utils/jwtHelper');
const logger = require('../config/logger');
const { getMainPool } = require('../config/db');
const {
  ROLES,
  ERROR_MESSAGES,
  HTTP_STATUS,
  LOG,
  STATUS
} = require('../config/constants');

/**
 * Authentication Middleware
 * 
 * Flow:
 * 1. Extract & parse JWT token from Authorization header
 * 2. Verify JWT signature and expiration
 * 3. Query users table in main pool (college isolation via college_id)
 * 4. Verify user is active
 * 5. Attach user to request
 */
async function authMiddleware(req, res, next) {
  try {
    // ====================================================================
    // Step 1: Extract authorization header
    // ====================================================================
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} Missing authorization header`,
        { ip: req.ip, path: req.path }
      );
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.MISSING_AUTH_HEADER
      });
    }

    // ====================================================================
    // Step 2: Parse Bearer token
    // ====================================================================
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      logger.warn(
        `${LOG.SECURITY_PREFIX} Invalid authorization header format`,
        { ip: req.ip }
      );
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_AUTH_HEADER
      });
    }

    const token = parts[1];

    if (!token) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} Missing token in authorization header`,
        { ip: req.ip }
      );
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_AUTH_HEADER
      });
    }

    // ====================================================================
    // Step 3: Verify JWT signature and expiration
    // ====================================================================
    logger.debug(`${LOG.TRANSACTION_PREFIX} Verifying JWT token`);

    const payload = jwtHelper.verify(token);

    if (!payload) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} Invalid or expired token`,
        { ip: req.ip }
      );
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_TOKEN
      });
    }

    // ====================================================================
    // Step 4: Validate user in database (single pool)
    // ====================================================================
    const mainPool = getMainPool();

    logger.debug(`${LOG.TRANSACTION_PREFIX} Validating user in database`, {
      user_id: payload.id
    });

    const userQuery = `
      SELECT 
        u.user_id,
        u.user_status,
        u.college_id,
        u.user_role,
        c.college_status
      FROM users u
      JOIN colleges c ON u.college_id = c.college_id
      WHERE u.user_id = $1
      LIMIT 1
    `;

    const { rows } = await mainPool.query(userQuery, [payload.id]);

    if (!rows || rows.length === 0) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} User not found in database`,
        { user_id: payload.id, ip: req.ip }
      );
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_TOKEN
      });
    }

    const dbUser = rows[0];

    // Verify user is active
    if (dbUser.user_status !== STATUS.ACTIVE) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} User account is not active`,
        {
          user_id: payload.id,
          status: dbUser.user_status,
          ip: req.ip
        }
      );
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'User account is not active'
      });
    }

    // Verify college is active
    if (dbUser.college_status !== STATUS.ACTIVE) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} College is not active`,
        {
          user_id: payload.id,
          college_id: dbUser.college_id,
          ip: req.ip
        }
      );
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'College is not active'
      });
    }

    // ====================================================================
    // Step 5: Attach user to request
    // ====================================================================
    req.user = {
      ...payload,
      college_id: dbUser.college_id,
      user_role: dbUser.user_role
    };

    logger.debug(
      `${LOG.TRANSACTION_PREFIX} User authenticated successfully`,
      {
        user_id: payload.id,
        role: payload.role,
        college_id: dbUser.college_id
      }
    );

    return next();

  } catch (err) {
    logger.error(
      `${LOG.TRANSACTION_PREFIX} Unexpected error in auth middleware`,
      { error: err.message, ip: req.ip }
    );
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        logger.warn(
          `${LOG.SECURITY_PREFIX} requireRole: No authenticated user`,
          { ip: req.ip, path: req.path }
        );
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: ERROR_MESSAGES.UNAUTHORIZED
        });
      }

      if (!allowedRoles.includes(user.role)) {
        logger.warn(
          `${LOG.SECURITY_PREFIX} Insufficient permissions`,
          {
            user_id: user.id,
            user_role: user.role,
            required_roles: allowedRoles,
            path: req.path,
            ip: req.ip
          }
        );
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.FORBIDDEN
        });
      }

      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Role validation passed`,
        { user_id: user.id, role: user.role }
      );

      return next();

    } catch (err) {
      logger.error(
        `${LOG.TRANSACTION_PREFIX} Unexpected error in requireRole`,
        { error: err.message }
      );
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR
      });
    }
  };
}

module.exports = {
  authMiddleware,
  requireRole
};