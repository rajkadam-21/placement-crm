/**
 * ============================================================================
 * COLLEGE SERVICE - College Management
 * ============================================================================
 * Handles college CRUD operations
 * - Create college (verify tenant exists)
 * - Get all colleges
 * - Get college by ID
 * - Update college
 * ============================================================================
 */

const { getMainPool } = require('../config/db');
const passwordHelper = require('../utils/passwordHelper');
const logger = require('../config/logger');
const {
  LOG,
  STATUS,
  ROLES,
  DB_ERROR_CODES
} = require('../config/constants');

class CollegeService {
  /**
   * Creates new college linked to existing tenant
   * 
   * RULE 1: colleges table exists only in main database
   * Use: getMainPool()
   * 
   * @param {Object} data - { tenant_id, college_name, college_subdomain, admin_name, admin_email, admin_password }
   * @returns {Object} { college, admin, portal_url, note }
   * @throws {Error} If tenant not found or validation fails
   */
  async create(data) {
    const {
      tenant_id,
      college_name,
      college_subdomain,
      admin_name,
      admin_email,
      admin_password
    } = data;

    const mainPool = getMainPool();
    const client = await mainPool.connect();

    try {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Starting college creation transaction`,
        { tenant_id, college_name }
      );

      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // ====================================================================
      // Step 1: Verify tenant exists
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Verifying tenant exists`, {
        tenant_id
      });

      const tenantCheckQuery = `
        SELECT tenant_id, tenant_name, db_url, status
        FROM tenants
        WHERE tenant_id = $1
        AND status = $2
        LIMIT 1
      `;

      const tenantCheckResult = await client.query(tenantCheckQuery, [
        tenant_id,
        STATUS.ACTIVE
      ]);

      if (!tenantCheckResult.rows.length) {
        await client.query('ROLLBACK');
        throw new Error(`Tenant ${tenant_id} not found or inactive`);
      }

      const tenant = tenantCheckResult.rows[0];

      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Tenant verified`,
        { tenant_id: tenant.tenant_id, tenant_name: tenant.tenant_name }
      );

      // ====================================================================
      // Step 2: Check subdomain uniqueness
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Checking subdomain uniqueness`, {
        subdomain: college_subdomain
      });

      const subdomainCheckQuery = `
        SELECT college_id FROM colleges
        WHERE LOWER(college_subdomain) = LOWER($1)
        LIMIT 1
      `;

      const subdomainCheckResult = await client.query(subdomainCheckQuery, [
        college_subdomain
      ]);

      if (subdomainCheckResult.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new Error('College subdomain already exists');
      }

      // ====================================================================
      // Step 3: Create college record
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Creating college record`, {
        college_name
      });

      const collegeInsertQuery = `
        INSERT INTO colleges (
          tenant_id,
          college_name,
          college_subdomain,
          college_status,
          created_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING college_id, tenant_id, college_name, college_subdomain, college_status, created_at
      `;

      const collegeResult = await client.query(collegeInsertQuery, [
        tenant_id,
        college_name,
        college_subdomain,
        STATUS.ACTIVE
      ]);

      const college = collegeResult.rows[0];

      logger.debug(
        `${LOG.TRANSACTION_PREFIX} College record created`,
        { college_id: college.college_id }
      );

      // ====================================================================
      // Step 4: Hash password
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Hashing admin password`);

      const hashedPassword = await passwordHelper.hashPassword(admin_password);

      // ====================================================================
      // Step 5: Create admin user
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Creating admin user`, {
        college_id: college.college_id,
        admin_email
      });

      const userInsertQuery = `
        INSERT INTO users (
          college_id,
          user_name,
          user_email,
          user_password,
          user_role,
          user_status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING user_id, user_name, user_email, user_role, user_status, created_at
      `;

      const userResult = await client.query(userInsertQuery, [
        college.college_id,
        admin_name || 'Admin',
        admin_email,
        hashedPassword,
        ROLES.ADMIN,
        STATUS.ACTIVE
      ]);

      const adminUser = userResult.rows[0];

      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Admin user created`,
        { user_id: adminUser.user_id, user_email: admin_email }
      );

      // ====================================================================
      // Step 6: Commit transaction
      // ====================================================================
      await client.query('COMMIT');

      logger.info(
        `${LOG.TRANSACTION_PREFIX} College creation transaction committed successfully`,
        {
          college_id: college.college_id,
          tenant_id: college.tenant_id,
          admin_user_id: adminUser.user_id
        }
      );

      return {
        college,
        admin: {
          user_id: adminUser.user_id,
          user_name: adminUser.user_name,
          user_email: adminUser.user_email,
          user_role: adminUser.user_role,
          temporary_password: admin_password
        },
        portal_url: `https://${college_subdomain}.pcrm.in`,
        note: 'Please change the temporary password on first login'
      };

    } catch (err) {
      await client.query('ROLLBACK');

      logger.error(
        `${LOG.TRANSACTION_PREFIX} College creation failed - transaction rolled back`,
        {
          error: err.message,
          code: err.code,
          tenant_id
        }
      );

      if (err.code === DB_ERROR_CODES.UNIQUE_VIOLATION) {
        if (err.constraint && err.constraint.includes('subdomain')) {
          throw new Error('College subdomain already exists');
        }
        if (err.constraint && err.constraint.includes('email')) {
          throw new Error('Admin email already exists');
        }
      }

      if (err.code === DB_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
        throw new Error('Invalid tenant reference');
      }

      throw err;

    } finally {
      client.release();
    }
  }

  /**
   * Get all colleges with pagination
   * 
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Object} { data, pagination }
   */
  async list(page = 1, limit = 20) {
    const mainPool = getMainPool();
    const offset = (page - 1) * limit;

    try {
      // Count total
      const countQuery = `SELECT COUNT(*) as total FROM colleges`;
      const countResult = await mainPool.query(countQuery);
      const total = parseInt(countResult.rows.total);

      // Fetch colleges
      const query = `
        SELECT
          c.college_id,
          c.tenant_id,
          c.college_name,
          c.college_subdomain,
          c.college_status,
          c.created_at,
          c.updated_at,
          t.tenant_name
        FROM colleges c
        JOIN tenants t ON c.tenant_id = t.tenant_id
        ORDER BY c.created_at DESC
        LIMIT $1
        OFFSET $2
      `;

      const { rows } = await mainPool.query(query, [limit, offset]);

      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Colleges listed`,
        {
          total_count: total,
          returned_count: rows.length,
          page
        }
      );

      return {
        data: rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (err) {
      logger.error(
        `${LOG.TRANSACTION_PREFIX} College list failed`,
        { error: err.message }
      );
      throw err;
    }
  }

  /**
   * Get single college by ID
   * 
   * @param {number} collegeId - College ID
   * @returns {Object} College data
   * @throws {Error} If not found
   */
  async getById(collegeId) {
    const mainPool = getMainPool();

    const query = `
      SELECT
        c.college_id,
        c.tenant_id,
        c.college_name,
        c.college_subdomain,
        c.college_status,
        c.created_at,
        c.updated_at,
        t.tenant_name
      FROM colleges c
      JOIN tenants t ON c.tenant_id = t.tenant_id
      WHERE c.college_id = $1
      LIMIT 1
    `;

    const { rows } = await mainPool.query(query, [collegeId]);

    if (!rows.length) {
      throw new Error('College not found');
    }

    logger.debug(
      `${LOG.TRANSACTION_PREFIX} College retrieved`,
      { college_id: collegeId }
    );

    return rows[0];
  }

  /**
   * Update college
   * 
   * @param {number} collegeId - College ID
   * @param {Object} data - { college_name, college_subdomain, college_status }
   * @returns {Object} Updated college
   * @throws {Error} If not found
   */
  async update(collegeId, data) {
    const mainPool = getMainPool();
    const client = await mainPool.connect();

    try {
      logger.debug(`${LOG.TRANSACTION_PREFIX} Starting college update`, {
        college_id: collegeId
      });

      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // Verify college exists
      const checkQuery = `
        SELECT college_id FROM colleges
        WHERE college_id = $1
        LIMIT 1
      `;

      const checkResult = await client.query(checkQuery, [collegeId]);

      if (!checkResult.rows.length) {
        await client.query('ROLLBACK');
        throw new Error('College not found');
      }

      // Update college
      const updateQuery = `
        UPDATE colleges
        SET
          college_name = COALESCE($1, college_name),
          college_subdomain = COALESCE($2, college_subdomain),
          college_status = COALESCE($3, college_status),
          updated_at = NOW()
        WHERE college_id = $4
        RETURNING college_id, tenant_id, college_name, college_subdomain, college_status, created_at, updated_at
      `;

      const updateResult = await client.query(updateQuery, [
        data.college_name || null,
        data.college_subdomain || null,
        data.college_status || null,
        collegeId
      ]);

      await client.query('COMMIT');

      logger.info(
        `${LOG.TRANSACTION_PREFIX} College updated successfully`,
        { college_id: collegeId }
      );

      return updateResult.rows;

    } catch (err) {
      await client.query('ROLLBACK');

      logger.error(
        `${LOG.TRANSACTION_PREFIX} College update failed - transaction rolled back`,
        { error: err.message }
      );

      throw err;

    } finally {
      client.release();
    }
  }
}

module.exports = new CollegeService();
