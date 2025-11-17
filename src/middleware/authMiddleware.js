/**
 * ============================================================================
 * AUTH MIDDLEWARE - Authentication & Authorization
 * ============================================================================
 * Handles JWT validation, user identification, and role-based access control
 * with RULE 2 implementation for multi-tenant support
 * ============================================================================
 */

const jwtHelper = require('../utils/jwtHelper');
const logger = require('../config/logger');
const { getMainPool, getPoolForTenant } = require('../config/db');
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
 * RULE 2: Validate college user in users table
 * Step 1: Extract & parse JWT token
 * Step 2: Verify JWT signature
 * Step 3: Get college info from colleges table (mainPool - RULE 1)
 * Step 4: Get tenant info
 * Step 5: Get pool for tenant
 * Step 6: Validate user exists and is active using tenant pool
 * Step 7: Verify tenant access isolation
 * Step 8: Attach user to request
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

    const token = parts[1]; // ✅ FIXED: Get token string from array

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
    // Step 4: Validate college user if not system admin (RULE 2)
    // ====================================================================
    if (payload.role !== ROLES.SYSADMIN) {
      logger.debug(`${LOG.TRANSACTION_PREFIX} Validating college user`, {
        user_id: payload.id
      });

      const mainPool = getMainPool();
      let client = await mainPool.connect();

      try {
        // Get college info
        const collegeQuery = `
          SELECT c.college_id, c.tenant_id, c.college_status
          FROM colleges c
          JOIN users u ON u.college_id = c.college_id
          WHERE u.user_id = $1
          LIMIT 1
        `;

        const collegeResult = await client.query(collegeQuery, [payload.id]);

        if (!collegeResult.rows.length) {
          client.release();
          logger.warn(
            `${LOG.SECURITY_PREFIX} User not found in database`,
            { user_id: payload.id, ip: req.ip }
          );
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: ERROR_MESSAGES.INVALID_TOKEN
          });
        }

        const college = collegeResult.rows[0]; // ✅ FIXED: Get first row

        // ====================================================================
        // Step 5: Get tenant info (RULE 1)
        // ====================================================================
        logger.debug(`${LOG.TRANSACTION_PREFIX} Fetching tenant info`, {
          tenant_id: college.tenant_id
        });

        const tenantQuery = `
          SELECT tenant_id, tenant_name, db_url, status
          FROM tenants
          WHERE tenant_id = $1
          LIMIT 1
        `;

        const tenantResult = await client.query(tenantQuery, [
          college.tenant_id
        ]);

        if (!tenantResult.rows.length) {
          client.release();
          logger.warn(
            `${LOG.SECURITY_PREFIX} Tenant not found`,
            { user_id: payload.id, tenant_id: college.tenant_id, ip: req.ip }
          );
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: ERROR_MESSAGES.INVALID_TOKEN
          });
        }

        const tenant = tenantResult.rows[0]; // ✅ FIXED: Get first row

        client.release();

        // ====================================================================
        // Step 6: Get tenant pool (RULE 2)
        // ====================================================================
        logger.debug(`${LOG.TRANSACTION_PREFIX} Getting tenant pool`, {
          tenant_id: tenant.tenant_id
        });

        const tenantPool = getPoolForTenant({
          tenant_id: tenant.tenant_id,
          tenant_name: tenant.tenant_name,
          db_url: tenant.db_url
        });

        // ====================================================================
        // Step 7: Query user in tenant pool (RULE 2)
        // ====================================================================
        logger.debug(`${LOG.TRANSACTION_PREFIX} Validating user in tenant pool`, {
          user_id: payload.id,
          tenant_id: tenant.tenant_id
        });

        const userQuery = `
          SELECT user_id, user_status, college_id
          FROM users
          WHERE user_id = $1
          LIMIT 1
        `;

        const { rows } = await tenantPool.query(userQuery, [payload.id]);

        if (!rows || rows.length === 0) {
          logger.warn(
            `${LOG.SECURITY_PREFIX} User not found in tenant pool`,
            { user_id: payload.id, tenant_id: tenant.tenant_id, ip: req.ip }
          );
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: ERROR_MESSAGES.INVALID_TOKEN
          });
        }

        const dbUser = rows[0]; // ✅ FIXED: Get first row

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

        // Update payload with fresh tenant info
        payload.college_id = dbUser.college_id;
        payload.tenant_id = tenant.tenant_id;

      } catch (err) {
        logger.error(
          `${LOG.TRANSACTION_PREFIX} Error validating user in database ${err}`,
          { error: err.message, user_id: payload.id }
        );
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: ERROR_MESSAGES.SERVER_ERROR
        });
      }
    }

    // ====================================================================
    // Step 8: Verify tenant access isolation (multi-tenant)
    // ====================================================================
    if (req.tenant && payload.role !== ROLES.SYSADMIN) {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Verifying tenant access isolation`,
        {
          user_college_id: payload.college_id,
          requested_college_id: req.tenant.college_id
        }
      );

      if (payload.college_id !== req.tenant.college_id) {
        logger.warn(
          `${LOG.SECURITY_PREFIX} Unauthorized tenant access attempt`,
          {
            user_id: payload.id,
            user_college_id: payload.college_id,
            requested_college_id: req.tenant.college_id,
            requested_subdomain: req.tenant.college_subdomain,
            ip: req.ip
          }
        );
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.FORBIDDEN
        });
      }
    }

    // ====================================================================
    // Step 9: Attach user to request
    // ====================================================================
    req.user = payload;

    logger.debug(
      `${LOG.TRANSACTION_PREFIX} User authenticated successfully`,
      {
        user_id: payload.id,
        role: payload.role,
        college_id: payload.college_id || null,
        tenant_id: payload.tenant_id || null
      }
    );

    return next();

  } catch (err) {
    logger.error(
      `${LOG.TRANSACTION_PREFIX} Unexpected error in auth middleware`,
      { error: err.message, stack: err.stack, ip: req.ip }
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
