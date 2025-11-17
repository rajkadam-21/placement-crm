/**
 * ============================================================================
 * AUTH CONTROLLER - User Authentication Management
 * ============================================================================
 * Handles HTTP requests and responses:
 * - Authorization checks (via middleware)
 * - Request validation (via validate middleware)
 * - API logging (start, end, error)
 * - Response formatting
 * - Calls AuthService for business logic
 * ============================================================================
 */

const authService = require('../services/authService');
const logger = require('../config/logger');
const { success, error } = require('../utils/responseHelper');
const {
  ROLES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  LOG,
  HTTP_STATUS,
  AUTH
} = require('../config/constants');

/**
 * POST /api/v1/auth/login
 * System admin and college user login
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function login(req, res) {
  const requestId = `${LOG.API_START_PREFIX} POST /auth/login`;
  const startTime = Date.now();

  logger.info(requestId, {
    ip: req.ip,
    tenant_id: req.tenant?.tenant_id || 'main'
  });

  try {
    const { email, password } = req.validated;

    // ====================================================================
    // Step 1: Check system admin credentials
    // ====================================================================
    logger.debug(`${LOG.TRANSACTION_PREFIX} Checking system admin credentials`);

    const isAdmin = await authService.verifySystemAdminCredentials(email, password);

    if (isAdmin) {
      logger.debug(`${LOG.TRANSACTION_PREFIX} System admin verified`);

      const adminToken = authService.generateAdminToken(email);

      const duration = Date.now() - startTime;

      logger.info(
        `${LOG.API_END_PREFIX} POST /auth/login - System admin login successful`,
        {
          email: email,
          role: ROLES.SYSADMIN,
          ip: req.ip,
          duration_ms: duration
        }
      );

      return success(
        res,
        {
          token: adminToken,
          role: ROLES.SYSADMIN,
          email: email,
          type: 'sysadmin'
        },
        SUCCESS_MESSAGES.LOGIN_SUCCESSFUL,
        HTTP_STATUS.OK
      );
    }

    // ====================================================================
    // Step 2: Authenticate college user (service handles RULE 2)
    // ====================================================================
    logger.debug(`${LOG.TRANSACTION_PREFIX} Authenticating college user`);

    const authResult = await authService.authenticateCollegeUser(
      email,
      password,
      req.tenant
    );

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} POST /auth/login - User login successful`,
      {
        user_id: authResult.user.user_id,
        role: authResult.user.user_role,
        college_id: authResult.user.college_id,
        tenant_id: authResult.tenant.tenant_id,
        email: authResult.user.user_email,
        ip: req.ip,
        duration_ms: duration
      }
    );

    return success(
      res,
      {
        token: authResult.token,
        role: authResult.user.user_role,
        email: authResult.user.user_email,
        college_id: authResult.user.college_id,
        type: 'college_user'
      },
      SUCCESS_MESSAGES.LOGIN_SUCCESSFUL,
      HTTP_STATUS.OK
    );

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} POST /auth/login - Error`,
      {
        error: err.message,
        ip: req.ip,
        duration_ms: duration,
        stack: err.stack
      }
    );

    // Handle specific errors
    if (err.message.includes('Invalid credentials') || 
        err.message.includes('not found') ||
        err.message.includes('inactive')) {
      return error(
        res,
        err.message,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (err.message.includes('Access denied')) {
      return error(res, ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }

    return error(
      res,
      ERROR_MESSAGES.SERVER_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * POST /api/v1/auth/logout
 * Logout user (stateless JWT - optional endpoint)
 * 
 * @param {Object} req - Express request (authenticated)
 * @param {Object} res - Express response
 */
async function logout(req, res) {
  const requestId = `${LOG.API_START_PREFIX} POST /auth/logout`;
  const startTime = Date.now();

  logger.info(requestId, {
    user_id: req.user?.id,
    user_role: req.user?.role,
    ip: req.ip
  });

  try {
    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} POST /auth/logout - Logout successful`,
      {
        user_id: req.user?.id,
        duration_ms: duration
      }
    );

    return success(
      res,
      {},
      SUCCESS_MESSAGES.LOGOUT_SUCCESSFUL,
      HTTP_STATUS.OK
    );

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} POST /auth/logout - Error`,
      {
        error: err.message,
        user_id: req.user?.id,
        duration_ms: duration
      }
    );

    return error(
      res,
      ERROR_MESSAGES.SERVER_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * GET /api/v1/auth/verify
 * Verify current token validity
 * 
 * @param {Object} req - Express request (authenticated)
 * @param {Object} res - Express response
 */
async function verifyToken(req, res) {
  const requestId = `${LOG.API_START_PREFIX} GET /auth/verify`;
  const startTime = Date.now();

  logger.info(requestId, {
    user_id: req.user?.id,
    user_role: req.user?.role
  });

  try {
    const user = req.user;

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} GET /auth/verify - Token verified`,
      {
        user_id: user?.id,
        duration_ms: duration
      }
    );

    return success(
      res,
      {
        id: user.id,
        role: user.role,
        email: user.email,
        college_id: user.college_id || null,
        tenant_id: user.tenant_id || null,
        type: user.id === AUTH.SYSTEM_ADMIN_ID ? 'sysadmin' : 'college_user'
      },
      'Token is valid',
      HTTP_STATUS.OK
    );

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} GET /auth/verify - Error`,
      {
        error: err.message,
        duration_ms: duration
      }
    );

    return error(
      res,
      ERROR_MESSAGES.SERVER_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

module.exports = {
  login,
  logout,
  verifyToken
};
