/**
 * ============================================================================
 * TENANT SERVICE - Multi-Tenant Management
 * ============================================================================
 * Handles all tenant operations with:
 * - Transaction handling
 * - Structured logging
 * - Error management
 * ============================================================================
 */

const { getMainPool } = require('../config/db');
const logger = require('../config/logger');
const {
  LOG,
  STATUS,
  DB_ERROR_CODES,
  HTTP_STATUS
} = require('../config/constants');

class TenantService {
  /**
   * Creates new tenant
   * 
   * @param {Object} data - { tenant_name, db_url (optional) }
   * @returns {Object} Created tenant
   * @throws {Error} If validation fails
   */
  async create(data) {
    const mainPool = getMainPool();
    const client = await mainPool.connect();

    try {
      logger.debug(`${LOG.TRANSACTION_PREFIX} Starting tenant creation`, {
        tenant_name: data.tenant_name
      });

      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // Check if tenant name already exists
      const checkQuery = `
        SELECT tenant_id FROM tenants 
        WHERE LOWER(tenant_name) = LOWER($1)
        AND status = $2
        LIMIT 1
      `;

      const checkResult = await client.query(checkQuery, [
        data.tenant_name,
        STATUS.ACTIVE
      ]);

      if (checkResult.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new Error('Tenant with this name already exists');
      }

      // Insert tenant
      const insertQuery = `
        INSERT INTO tenants (tenant_name, db_url, status, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING tenant_id, tenant_name, db_url, status, created_at
      `;

      const insertResult = await client.query(insertQuery, [
        data.tenant_name,
        data.db_url || null,
        STATUS.ACTIVE
      ]);

      await client.query('COMMIT');

      const tenant = insertResult.rows;

      logger.info(
        `${LOG.TRANSACTION_PREFIX} Tenant created successfully`,
        {
          tenant_id: tenant.tenant_id,
          tenant_name: tenant.tenant_name,
          has_separate_db: !!tenant.db_url
        }
      );

      return tenant;

    } catch (err) {
      await client.query('ROLLBACK');

      logger.error(
        `${LOG.TRANSACTION_PREFIX} Tenant creation failed - rolled back`,
        {
          error: err.message,
          code: err.code
        }
      );

      if (err.code === DB_ERROR_CODES.UNIQUE_VIOLATION) {
        throw new Error('Tenant with this name already exists');
      }

      throw err;

    } finally {
      client.release();
    }
  }

  /**
   * List all tenants with pagination
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
      const countQuery = `SELECT COUNT(*) as total FROM tenants`;
      console.log("countQuery: ",countQuery);
      const countResult = await mainPool.query(countQuery);
      const total = parseInt(countResult.rows.total);

      // Fetch tenants
      const query = `
        SELECT 
          tenant_id,
          tenant_name,
          db_url,
          status,
          created_at,
          updated_at
        FROM tenants
        ORDER BY created_at DESC
        LIMIT $1
        OFFSET $2
      `;

      const { rows } = await mainPool.query(query, [limit, offset]);

      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Tenants listed`,
        {
          total_count: total,
          returned_count: rows.length,
          page: page
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
        `${LOG.TRANSACTION_PREFIX} Tenant list failed`,
        { error: err.message }
      );
      throw err;
    }
  }

  /**
   * Get single tenant by ID
   * 
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Tenant data
   * @throws {Error} If not found
   */
  async getById(tenantId) {
    const mainPool = getMainPool();

    const query = `
      SELECT 
        tenant_id,
        tenant_name,
        db_url,
        status,
        created_at,
        updated_at
      FROM tenants
      WHERE tenant_id = $1
      LIMIT 1
    `;

    const { rows } = await mainPool.query(query, [tenantId]);

    if (!rows.length) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    logger.debug(
      `${LOG.TRANSACTION_PREFIX} Tenant retrieved`,
      { tenant_id: tenantId }
    );

    return rows;
  }

  /**
   * Update tenant
   * 
   * @param {string} tenantId - Tenant ID
   * @param {Object} data - { tenant_name, db_url, status }
   * @returns {Object} Updated tenant
   */
  async update(tenantId, data) {
    const mainPool = getMainPool();
    const client = await mainPool.connect();

    try {
      logger.debug(`${LOG.TRANSACTION_PREFIX} Starting tenant update`, {
        tenant_id: tenantId
      });

      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // Verify tenant exists
      const checkQuery = `
        SELECT tenant_id FROM tenants WHERE tenant_id = $1
      `;
      const checkResult = await client.query(checkQuery, [tenantId]);

      if (!checkResult.rows.length) {
        await client.query('ROLLBACK');
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Update tenant
      const updateQuery = `
        UPDATE tenants
        SET 
          tenant_name = COALESCE($1, tenant_name),
          db_url = COALESCE($2, db_url),
          status = COALESCE($3, status),
          updated_at = NOW()
        WHERE tenant_id = $4
        RETURNING tenant_id, tenant_name, db_url, status, created_at, updated_at
      `;

      const updateResult = await client.query(updateQuery, [
        data.tenant_name || null,
        data.db_url || null,
        data.status || null,
        tenantId
      ]);

      await client.query('COMMIT');

      logger.info(
        `${LOG.TRANSACTION_PREFIX} Tenant updated successfully`,
        { tenant_id: tenantId }
      );

      return updateResult.rows;

    } catch (err) {
      await client.query('ROLLBACK');

      logger.error(
        `${LOG.TRANSACTION_PREFIX} Tenant update failed - rolled back`,
        { error: err.message }
      );

      throw err;

    } finally {
      client.release();
    }
  }

  /**
   * Verify tenant exists (used by college service)
   * 
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Tenant data
   * @throws {Error} If not found
   */
  async verifyExists(tenantId) {
    const mainPool = getMainPool();

    const query = `
      SELECT tenant_id, tenant_name, db_url, status
      FROM tenants
      WHERE tenant_id = $1
      AND status = $2
      LIMIT 1
    `;

    const { rows } = await mainPool.query(query, [tenantId, STATUS.ACTIVE]);

    if (!rows.length) {
      throw new Error(`Tenant ${tenantId} not found or inactive`);
    }

    return rows[0];
  }
}

module.exports = new TenantService();
