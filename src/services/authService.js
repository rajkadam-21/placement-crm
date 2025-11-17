/**
 * ============================================================================
 * AUTH SERVICE - Authentication Business Logic
 * ============================================================================
 * Handles authentication operations:
 * - System admin credential verification
 * - College user authentication (RULE 2)
 * - Token generation
 * 
 * RULE 2 IMPLEMENTATION:
 * Step 1: Get college info from colleges table (mainPool - RULE 1)
 * Step 2: Get tenant info from tenants table (mainPool - RULE 1)
 * Step 3: Get pool for tenant (getPoolForTenant)
 * Step 4: Query users table using tenant pool (RULE 2)
 * ============================================================================
 */

const { getMainPool, getPoolForTenant } = require('../config/db');
const jwtHelper = require('../utils/jwtHelper');
const passwordHelper = require('../utils/passwordHelper');
const logger = require('../config/logger');
const {
  LOG,
  STATUS,
  ROLES,
  AUTH,
  DB_ERROR_CODES
} = require('../config/constants');

class AuthService {
  /**
   * Verify system admin credentials
   * 
   * @param {string} email - Admin email
   * @param {string} password - Admin password
   * @returns {Promise<boolean>} True if credentials match
   */
  async verifySystemAdminCredentials(email, password) {
    try {
      logger.debug(`${LOG.TRANSACTION_PREFIX} Verifying system admin credentials`, {
        email
      });

      const configEmail = process.env.SYSADMIN_EMAIL;
      const configPassword = process.env.SYSADMIN_PASSWORD;

      if (!configEmail || !configPassword) {
        logger.warn(
          `${LOG.SECURITY_PREFIX} System admin credentials not configured in environment`
        );
        return false;
      }

      // Constant-time comparison to prevent timing attacks
      const emailMatch = email === configEmail;
      const passwordMatch = password === configPassword;

      return emailMatch && passwordMatch;

    } catch (err) {
      logger.error(
        `${LOG.TRANSACTION_PREFIX} Error verifying system admin credentials`,
        { error: err.message }
      );
      return false;
    }
  }

  /**
   * Generate system admin token
   * 
   * @param {string} email - Admin email
   * @returns {string} JWT token
   */
  generateAdminToken(email) {
    logger.debug(`${LOG.TRANSACTION_PREFIX} Generating admin JWT token`, {
      email
    });

    return jwtHelper.sign({
      id: AUTH.SYSTEM_ADMIN_ID,
      role: ROLES.SYSADMIN,
      email: email,
      timestamp: Date.now()
    });
  }

  /**
   * Authenticate college user
   * 
   * RULE 2: Get tenant info first, then use tenant pool
   * 
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {Object} tenant - Tenant info from subdomain (optional)
   * @returns {Object} { token, user_info, tenant_info }
   * @throws {Error} If authentication fails
   */
  async authenticateCollegeUser(email, password, tenant = null) {
    const mainPool = getMainPool();
    let client = await mainPool.connect();

    try {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Starting college user authentication`,
        { email }
      );

      // ====================================================================
      // Step 1: Get college info from colleges table (RULE 1)
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Fetching college info`, { email });

      const collegeQuery = `
        SELECT c.college_id, c.tenant_id, c.college_status
        FROM colleges c
        LIMIT 1
      `;

      const collegeResult = await client.query(collegeQuery);

      if (!collegeResult.rows.length) {
        logger.warn(
          `${LOG.VALIDATION_PREFIX} Authentication failed - no colleges configured`,
          { email }
        );
        throw new Error('No colleges configured');
      }

      const college = collegeResult.rows[0];

      // ====================================================================
      // Step 2: Get tenant record (RULE 1)
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Fetching tenant record`, {
        tenant_id: college.tenant_id
      });

      const tenantQuery = `
        SELECT tenant_id, tenant_name, db_url, status
        FROM tenants
        WHERE tenant_id = $1
        AND status = $2
        LIMIT 1
      `;

      const tenantResult = await client.query(tenantQuery, [
        college.tenant_id,
        STATUS.ACTIVE
      ]);

      if (!tenantResult.rows.length) {
        logger.warn(
          `${LOG.VALIDATION_PREFIX} Authentication failed - tenant not found`,
          { email, tenant_id: college.tenant_id }
        );
        throw new Error('Tenant not found or inactive');
      }

      const tenantRecord = tenantResult.rows[0];

      client.release();

      // ====================================================================
      // Step 3: Get pool for tenant (RULE 2)
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Getting tenant pool`, {
        tenant_id: tenantRecord.tenant_id
      });

      const tenantPool = getPoolForTenant({
        tenant_id: tenantRecord.tenant_id,
        tenant_name: tenantRecord.tenant_name,
        db_url: tenantRecord.db_url
      });

      // ====================================================================
      // Step 4: Query user from tenant pool (RULE 2)
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Querying user from tenant pool`, {
        email,
        tenant_id: tenantRecord.tenant_id
      });

      const userQuery = `
        SELECT 
          user_id, 
          user_email, 
          user_password, 
          user_role, 
          college_id,
          user_status,
          created_at
        FROM users 
        WHERE LOWER(user_email) = LOWER($1)
        AND user_status = $2
        LIMIT 1
      `;

      const { rows: userRows } = await tenantPool.query(userQuery, [
        email,
        STATUS.ACTIVE
      ]);

      if (!userRows || userRows.length === 0) {
        logger.warn(
          `${LOG.SECURITY_PREFIX} Authentication failed - user not found`,
          { email, tenant_id: tenantRecord.tenant_id }
        );
        throw new Error('Invalid credentials');
      }

      const user = userRows[0];

      // ====================================================================
      // Step 5: Verify tenant access (multi-tenant isolation)
      // ====================================================================
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Verifying tenant access isolation`,
        {
          user_college_id: user.college_id,
          requested_tenant: tenant?.tenant_id || 'main'
        }
      );

      if (tenant && user.college_id !== tenant.college_id) {
        logger.warn(
          `${LOG.SECURITY_PREFIX} Unauthorized tenant access attempt`,
          {
            user_id: user.user_id,
            user_college_id: user.college_id,
            requested_college_id: tenant.college_id,
            requested_subdomain: tenant.college_subdomain
          }
        );
        throw new Error('Access denied - Invalid college');
      }

      // ====================================================================
      // Step 6: Validate password
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Validating password`, {
        user_id: user.user_id
      });

      const passwordMatch = await passwordHelper.compare(
        password,
        user.user_password
      );

      if (!passwordMatch) {
        logger.warn(
          `${LOG.SECURITY_PREFIX} Authentication failed - invalid password`,
          { user_id: user.user_id, email: user.user_email }
        );
        throw new Error('Invalid credentials');
      }

      // ====================================================================
      // Step 7: Generate JWT token
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Generating JWT token`, {
        user_id: user.user_id
      });

      const userToken = jwtHelper.sign({
        id: user.user_id,
        role: user.user_role,
        email: user.user_email,
        college_id: user.college_id,
        tenant_id: tenantRecord.tenant_id,
        timestamp: Date.now()
      });

      logger.info(
        `${LOG.TRANSACTION_PREFIX} College user authenticated successfully`,
        {
          user_id: user.user_id,
          role: user.user_role,
          college_id: user.college_id,
          tenant_id: tenantRecord.tenant_id
        }
      );

      return {
        token: userToken,
        user: {
          user_id: user.user_id,
          user_email: user.user_email,
          user_role: user.user_role,
          college_id: user.college_id
        },
        tenant: {
          tenant_id: tenantRecord.tenant_id,
          tenant_name: tenantRecord.tenant_name
        }
      };

    } catch (err) {
      client.release();

      logger.error(
        `${LOG.TRANSACTION_PREFIX} College user authentication failed`,
        { error: err.message, email }
      );

      throw err;
    }
  }
}

module.exports = new AuthService();
