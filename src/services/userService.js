/**
 * ============================================================================
 * USER SERVICE - User Management
 * ============================================================================
 * Handles user CRUD operations within college scope
 * - Create user with password hashing
 * - Get all users with pagination
 * - Get user by ID
 * - Update user
 * - Soft delete user
 * 
 * RULE 2 IMPLEMENTATION:
 * Step 1: Get tenant info from colleges table (use getMainPool)
 * Step 2: Get tenant record to get db_url (if separate DB)
 * Step 3: Get pool for this tenant (use getPoolForTenant)
 * Step 4: Query users table using tenant's pool
 * ============================================================================
 */

const { getMainPool, getPoolForTenant } = require('../config/db');
const passwordHelper = require('../utils/passwordHelper');
const logger = require('../config/logger');
const {
  LOG,
  STATUS,
  ROLES,
  DB_ERROR_CODES
} = require('../config/constants');

class UserService {
  /**
   * Creates new user in college
   * 
   * RULE 2: Users table belongs to college/tenant
   * Step 1: Get tenant info from colleges table (mainPool - RULE 1)
   * Step 2: Get tenant record to get db_url
   * Step 3: Get pool for that tenant
   * Step 4: Create user using tenant's pool
   * 
   * @param {Object} data - { college_id, user_name, user_email, user_password, user_role }
   * @returns {Object} Created user (without password)
   * @throws {Error} If validation fails
   */
  async create(data) {
    const {
      college_id,
      user_name,
      user_email,
      user_password,
      user_role
    } = data;

    const mainPool = getMainPool();
    let client = await mainPool.connect();

    try {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Starting user creation transaction`,
        { college_id, user_email, user_role }
      );

      // ====================================================================
      // Step 1: Get tenant info from colleges table (RULE 1)
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Fetching college and tenant info`, {
        college_id
      });

      const collegeQuery = `
        SELECT college_id, tenant_id, college_status
        FROM colleges
        WHERE college_id = $1
        LIMIT 1
      `;

      const collegeResult = await client.query(collegeQuery, [college_id]);

      if (!collegeResult.rows.length) {
        client.release();
        throw new Error('College not found');
      }

      const college = collegeResult.rows[0];

      if (college.college_status !== STATUS.ACTIVE) {
        client.release();
        throw new Error('College is inactive');
      }

      // ====================================================================
      // Step 2: Get tenant record to get db_url (RULE 1)
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
        client.release();
        throw new Error('Tenant not found or inactive');
      }

      const tenant = tenantResult.rows;

      logger.debug(`${LOG.TRANSACTION_PREFIX} Tenant verified`, {
        tenant_id: tenant.tenant_id,
        has_separate_db: !!tenant.db_url
      });

      // client.release();

      // ====================================================================
      // Step 3: Get pool for this tenant (RULE 2)
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Getting tenant pool`, {
        tenant_id: tenant.tenant_id
      });

      const tenantPool = getPoolForTenant({
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.tenant_name,
        db_url: tenant.db_url
      });

      client = await tenantPool.connect();

      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // ====================================================================
      // Step 4: Validate user role
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Validating user role`, {
        user_role
      });

      const validRoles = [ROLES.ADMIN, ROLES.TEACHER, 'other'];
      if (!validRoles.includes(user_role)) {
        await client.query('ROLLBACK');
        throw new Error(`Invalid user role: ${user_role}`);
      }

      // ====================================================================
      // Step 5: Hash password
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Hashing user password`);

      const hashedPassword = await passwordHelper.hashPassword(user_password);

      // ====================================================================
      // Step 6: Check email uniqueness
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Checking email uniqueness`, {
        user_email
      });

      const emailCheckQuery = `
        SELECT user_id FROM users
        WHERE LOWER(user_email) = LOWER($1)
        LIMIT 1
      `;

      const emailCheckResult = await client.query(emailCheckQuery, [user_email]);

      if (emailCheckResult.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new Error('Email already exists');
      }

      // ====================================================================
      // Step 7: Create user (RULE 2 - using tenant pool)
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Creating user record`, {
        college_id,
        user_email
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
        RETURNING user_id, college_id, user_name, user_email, user_role, user_status, created_at
      `;

      const userResult = await client.query(userInsertQuery, [
        college_id,
        user_name,
        user_email,
        hashedPassword,
        user_role,
        STATUS.ACTIVE
      ]);

      await client.query('COMMIT');

      const user = userResult.rows;

      logger.info(
        `${LOG.TRANSACTION_PREFIX} User created successfully`,
        {
          user_id: user.user_id,
          college_id: user.college_id,
          user_email: user.user_email,
          user_role: user.user_role,
          tenant_id: tenant.tenant_id
        }
      );

      return user;

    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        logger.error(
          `${LOG.TRANSACTION_PREFIX} Rollback failed`,
          { error: rollbackErr.message }
        );
      }

      logger.error(
        `${LOG.TRANSACTION_PREFIX} User creation failed - transaction rolled back ${err}`,
        {
          error: err.message,
          code: err.code,
          college_id
        }
      );

      if (err.code === DB_ERROR_CODES.UNIQUE_VIOLATION) {
        throw new Error('Email already exists');
      }

      if (err.code === DB_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
        throw new Error('Invalid college reference');
      }

      throw err;

    } finally {
      client.release();
    }
  }

  /**
   * Get all users in college with pagination
   * 
   * RULE 2: Get tenant info first, then use tenant pool
   * 
   * @param {string} collegeId - College ID
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Object} { data, pagination }
   */
  async list(collegeId, page = 1, limit = 20) {
    const mainPool = getMainPool();
    let client = await mainPool.connect();
    const offset = (page - 1) * limit;

    try {
      // ====================================================================
      // Step 1: Get tenant info from colleges table (RULE 1)
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Fetching college tenant info`, {
        college_id: collegeId
      });

      const collegeQuery = `
        SELECT college_id, tenant_id FROM colleges
        WHERE college_id = $1
        LIMIT 1
      `;

      const collegeResult = await client.query(collegeQuery, [collegeId]);

      if (!collegeResult.rows.length) {
        client.release();
        throw new Error('College not found');
      }

      const college = collegeResult.rows[0];

      // ====================================================================
      // Step 2: Get tenant record to get db_url (RULE 1)
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Fetching tenant record`, {
        tenant_id: college.tenant_id
      });

      const tenantQuery = `
        SELECT tenant_id, tenant_name, db_url, status
        FROM tenants
        WHERE tenant_id = $1
        LIMIT 1
      `;

      const tenantResult = await client.query(tenantQuery, [college.tenant_id]);

      if (!tenantResult.rows.length) {
        client.release();
        throw new Error('Tenant not found');
      }

      const tenant = tenantResult.rows[0];

      // client.release();

      // ====================================================================
      // Step 3: Get pool for this tenant (RULE 2)
      // ====================================================================
      const tenantPool = getPoolForTenant({
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.tenant_name,
        db_url: tenant.db_url
      });

      // ====================================================================
      // Step 4: Count total users (RULE 2 - using tenant pool)
      // ====================================================================
      const countQuery = `
        SELECT COUNT(*) as total FROM users
        WHERE college_id = $1
        AND user_status = $2
      `;

      const countResult = await tenantPool.query(countQuery, [
        collegeId,
        STATUS.ACTIVE
      ]);

      const total = parseInt(countResult.rows.total);

      // ====================================================================
      // Step 5: Fetch users with pagination (RULE 2 - using tenant pool)
      // ====================================================================
      const query = `
        SELECT
          user_id,
          college_id,
          user_name,
          user_email,
          user_role,
          user_status,
          created_at
        FROM users
        WHERE college_id = $1
        AND user_status = $2
        ORDER BY created_at DESC
        LIMIT $3
        OFFSET $4
      `;

      const { rows } = await tenantPool.query(query, [
        collegeId,
        STATUS.ACTIVE,
        limit,
        offset
      ]);

      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Users listed`,
        {
          college_id: collegeId,
          tenant_id: tenant.tenant_id,
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
        `${LOG.TRANSACTION_PREFIX} User list failed ${err}`,
        {
          error: err.message,
          college_id: collegeId
        }
      );
      throw err;

    } finally {
      client.release();
    }
  }

  /**
   * Get single user by ID within college
   * 
   * RULE 2: Get tenant info first, then use tenant pool
   * 
   * @param {string} userId - User ID
   * @param {string} collegeId - College ID (for isolation)
   * @returns {Object} User data (without password)
   * @throws {Error} If not found
   */
  async getById(userId, collegeId) {
    const mainPool = getMainPool();
    let client = await mainPool.connect();

    try {
      // ====================================================================
      // Step 1: Get tenant info from colleges table (RULE 1)
      // ====================================================================
      const collegeQuery = `
        SELECT college_id, tenant_id FROM colleges
        WHERE college_id = $1
        LIMIT 1
      `;

      const collegeResult = await client.query(collegeQuery, [collegeId]);

      if (!collegeResult.rows.length) {
        client.release();
        throw new Error('College not found');
      }

      const college = collegeResult.rows;

      // ====================================================================
      // Step 2: Get tenant record (RULE 1)
      // ====================================================================
      const tenantQuery = `
        SELECT tenant_id, tenant_name, db_url
        FROM tenants
        WHERE tenant_id = $1
        LIMIT 1
      `;

      const tenantResult = await client.query(tenantQuery, [college.tenant_id]);

      if (!tenantResult.rows.length) {
        client.release();
        throw new Error('Tenant not found');
      }

      const tenant = tenantResult.rows;

      client.release();

      // ====================================================================
      // Step 3: Get pool for this tenant (RULE 2)
      // ====================================================================
      const tenantPool = getPoolForTenant({
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.tenant_name,
        db_url: tenant.db_url
      });

      // ====================================================================
      // Step 4: Query user (RULE 2 - using tenant pool)
      // ====================================================================
      const query = `
        SELECT
          user_id,
          college_id,
          user_name,
          user_email,
          user_role,
          user_status,
          created_at
        FROM users
        WHERE user_id = $1
        AND college_id = $2
        AND user_status = $3
        LIMIT 1
      `;

      const { rows } = await tenantPool.query(query, [
        userId,
        collegeId,
        STATUS.ACTIVE
      ]);

      if (!rows.length) {
        throw new Error('User not found');
      }

      logger.debug(
        `${LOG.TRANSACTION_PREFIX} User retrieved`,
        {
          user_id: userId,
          college_id: collegeId,
          tenant_id: tenant.tenant_id
        }
      );

      return rows;

    } catch (err) {
      logger.error(
        `${LOG.TRANSACTION_PREFIX} User retrieval failed`,
        {
          error: err.message,
          user_id: userId,
          college_id: collegeId
        }
      );
      throw err;

    } finally {
      client.release();
    }
  }

  /**
   * Update user within college
   * 
   * RULE 2: Get tenant info first, then use tenant pool
   * 
   * @param {string} userId - User ID
   * @param {string} collegeId - College ID (for isolation)
   * @param {Object} data - { user_name, user_role, user_status }
   * @returns {Object} Updated user
   * @throws {Error} If not found or access denied
   */
  async update(userId, collegeId, data) {
    const mainPool = getMainPool();
    let client = await mainPool.connect();

    try {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Starting user update transaction`,
        { user_id: userId, college_id: collegeId }
      );

      // ====================================================================
      // Step 1: Get tenant info from colleges table (RULE 1)
      // ====================================================================
      const collegeQuery = `
        SELECT college_id, tenant_id FROM colleges
        WHERE college_id = $1
        LIMIT 1
      `;

      const collegeResult = await client.query(collegeQuery, [collegeId]);

      if (!collegeResult.rows.length) {
        client.release();
        throw new Error('College not found');
      }

      const college = collegeResult.rows[0];

      // ====================================================================
      // Step 2: Get tenant record (RULE 1)
      // ====================================================================
      const tenantQuery = `
        SELECT tenant_id, tenant_name, db_url
        FROM tenants
        WHERE tenant_id = $1
        LIMIT 1
      `;

      const tenantResult = await client.query(tenantQuery, [college.tenant_id]);

      if (!tenantResult.rows.length) {
        client.release();
        throw new Error('Tenant not found');
      }

      const tenant = tenantResult.rows;

      client.release();

      // ====================================================================
      // Step 3: Get pool for this tenant (RULE 2)
      // ====================================================================
      const tenantPool = getPoolForTenant({
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.tenant_name,
        db_url: tenant.db_url
      });

      client = await tenantPool.connect();

      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // ====================================================================
      // Step 4: Verify user exists and belongs to college (RULE 2)
      // ====================================================================
      const checkQuery = `
        SELECT user_id, college_id FROM users
        WHERE user_id = $1
        AND college_id = $2
        LIMIT 1
      `;

      const checkResult = await client.query(checkQuery, [userId, collegeId]);

      if (!checkResult.rows.length) {
        await client.query('ROLLBACK');
        throw new Error('User not found');
      }

      // ====================================================================
      // Step 5: Validate role if provided
      // ====================================================================
      if (data.user_role) {
        const validRoles = [ROLES.ADMIN, ROLES.TEACHER, 'other'];
        if (!validRoles.includes(data.user_role)) {
          await client.query('ROLLBACK');
          throw new Error(`Invalid user role: ${data.user_role}`);
        }
      }

      // ====================================================================
      // Step 6: Update user (RULE 2 - using tenant pool)
      // ====================================================================
      const updateQuery = `
        UPDATE users
        SET
          user_name = COALESCE($1, user_name),
          user_role = COALESCE($2, user_role),
          user_status = COALESCE($3, user_status),
          updated_at = NOW()
        WHERE user_id = $4
        AND college_id = $5
        RETURNING user_id, college_id, user_name, user_email, user_role, user_status
      `;

      const updateResult = await client.query(updateQuery, [
        data.user_name || null,
        data.user_role || null,
        data.user_status || null,
        userId,
        collegeId
      ]);

      await client.query('COMMIT');

      logger.info(
        `${LOG.TRANSACTION_PREFIX} User updated successfully`,
        {
          user_id: userId,
          college_id: collegeId,
          tenant_id: tenant.tenant_id
        }
      );

      return updateResult.rows;

    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        logger.error(
          `${LOG.TRANSACTION_PREFIX} Rollback failed`,
          { error: rollbackErr.message }
        );
      }

      logger.error(
        `${LOG.TRANSACTION_PREFIX} User update failed - transaction rolled back ${err}`,
        {
          error: err.message,
          user_id: userId,
          college_id: collegeId
        }
      );

      throw err;

    } finally {
      client.release();
    }
  }

  /**
   * Soft delete user (set status to inactive)
   * 
   * RULE 2: Get tenant info first, then use tenant pool
   * 
   * @param {string} userId - User ID
   * @param {string} collegeId - College ID (for isolation)
   * @throws {Error} If not found
   */
  async delete(userId, collegeId) {
    const mainPool = getMainPool();
    let client = await mainPool.connect();

    try {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Starting user deletion transaction`,
        { user_id: userId, college_id: collegeId }
      );

      // ====================================================================
      // Step 1: Get tenant info from colleges table (RULE 1)
      // ====================================================================
      const collegeQuery = `
        SELECT college_id, tenant_id FROM colleges
        WHERE college_id = $1
        LIMIT 1
      `;

      const collegeResult = await client.query(collegeQuery, [collegeId]);

      if (!collegeResult.rows.length) {
        client.release();
        throw new Error('College not found');
      }

      const college = collegeResult.rows[0];

      // ====================================================================
      // Step 2: Get tenant record (RULE 1)
      // ====================================================================
      const tenantQuery = `
        SELECT tenant_id, tenant_name, db_url
        FROM tenants
        WHERE tenant_id = $1
        LIMIT 1
      `;

      const tenantResult = await client.query(tenantQuery, [college.tenant_id]);

      if (!tenantResult.rows.length) {
        client.release();
        throw new Error('Tenant not found');
      }

      const tenant = tenantResult.rows;

      client.release();

      // ====================================================================
      // Step 3: Get pool for this tenant (RULE 2)
      // ====================================================================
      const tenantPool = getPoolForTenant({
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.tenant_name,
        db_url: tenant.db_url
      });

      client = await tenantPool.connect();

      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // ====================================================================
      // Step 4: Soft delete user (RULE 2 - using tenant pool)
      // ====================================================================
      const deleteQuery = `
        UPDATE users
        SET user_status = $1, updated_at = NOW()
        WHERE user_id = $2
        AND college_id = $3
        RETURNING user_id, user_name, user_email
      `;

      const deleteResult = await client.query(deleteQuery, [
        'inactive',
        userId,
        collegeId
      ]);

      if (!deleteResult.rows.length) {
        await client.query('ROLLBACK');
        throw new Error('User not found');
      }

      await client.query('COMMIT');

      logger.info(
        `${LOG.TRANSACTION_PREFIX} User soft deleted successfully`,
        {
          user_id: userId,
          user_name: deleteResult.rows.user_name,
          college_id: collegeId,
          tenant_id: tenant.tenant_id
        }
      );

    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        logger.error(
          `${LOG.TRANSACTION_PREFIX} Rollback failed`,
          { error: rollbackErr.message }
        );
      }

      logger.error(
        `${LOG.TRANSACTION_PREFIX} User deletion failed - transaction rolled back`,
        {
          error: err.message,
          user_id: userId,
          college_id: collegeId
        }
      );

      throw err;

    } finally {
      client.release();
    }
  }
}

module.exports = new UserService();
