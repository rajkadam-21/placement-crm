/**
 * ============================================================================
 * DB.JS - Database Connection Pool Management
 * ============================================================================
 * Handles multi-tenant database connections using PostgreSQL connection pools.
 * 
 * Architecture:
 * - Main Pool: Default tenant (T1) - stores tenants metadata & global data
 * - Tenant Pools: Separate pools for each tenant's dedicated database
 * 
 * Example:
 * - T1 (default): Uses main pool
 * - T2 (tenant2): Uses separate Supabase connection
 * 
 * ============================================================================
 */

const { Pool } = require('pg');
const config = require('./env');
const logger = require('./logger');
const { DB, LOG, HTTP_STATUS, ERROR_MESSAGES } = require('./constants');

// ============================================================================
// MAIN CONNECTION POOL (T1 - Default Tenant)
// ============================================================================
const mainPool = new Pool({
  connectionString: config.databaseUrl,
  min: DB.POOL_MIN_CONNECTIONS,
  max: DB.POOL_MAX_CONNECTIONS,
  idleTimeoutMillis: DB.POOL_IDLE_TIMEOUT,
  connectionTimeoutMillis: DB.CONNECTION_TIMEOUT,
  statement_timeout: DB.QUERY_TIMEOUT
});

// Error handling for main pool
mainPool.on('error', (err) => {
  logger.error(
    `${LOG.TRANSACTION_PREFIX} Main pool error occurred`,
    {
      error: err.message,
      code: err.code,
      severity: err.severity
    }
  );
});

mainPool.on('connect', () => {
  logger.debug(`${LOG.TRANSACTION_PREFIX} New connection established in main pool`);
});

mainPool.on('remove', () => {
  logger.debug(`${LOG.TRANSACTION_PREFIX} Connection removed from main pool`);
});

// ============================================================================
// TENANT-SPECIFIC CONNECTION POOLS (T2, T3, etc.)
// ============================================================================
// Key: db_url/connection_string, Value: Pool instance
const tenantPools = new Map();

// Track tenant metadata for audit purposes
const tenantMetadata = new Map();

/**
 * ============================================================================
 * Validates tenant object structure and required fields
 * ============================================================================
 * @param {Object} tenant - Tenant object { tenant_id, tenant_name, db_url }
 * @returns {Object} { valid: boolean, error: string|null }
 */
function validateTenant(tenant) {
  if (!tenant) {
    return { valid: false, error: 'Tenant object is required' };
  }

  if (typeof tenant !== 'object') {
    return { valid: false, error: 'Tenant must be an object' };
  }

  if (!tenant.tenant_id || typeof tenant.tenant_id !== 'string') {
    return { valid: false, error: 'Tenant must have valid tenant_id' };
  }

  if (!tenant.tenant_name || typeof tenant.tenant_name !== 'string') {
    return { valid: false, error: 'Tenant must have valid tenant_name' };
  }

  return { valid: true, error: null };
}

/**
 * ============================================================================
 * Retrieves connection pool for main database (T1 - Default Tenant)
 * ============================================================================
 * This pool connects to the default tenant database which stores:
 * - Tenant metadata (tenants table)
 * - System-wide configurations
 * - User authentication data (college admins, teachers)
 * 
 * @returns {Pool} PostgreSQL connection pool for main database
 * @throws {Error} If pool is not initialized
 */
function getMainPool() {
  if (!mainPool) {
    const error = new Error('Main database pool is not initialized');
    logger.error(
      `${LOG.TRANSACTION_PREFIX} Critical: Main pool not initialized`,
      { error: error.message }
    );
    throw error;
  }
  return mainPool;
}

/**
 * ============================================================================
 * Retrieves connection pool for tenant-specific database
 * ============================================================================
 * Logic:
 * 1. If tenant is null or has no db_url -> return mainPool (T1 default)
 * 2. If tenant.db_url exists -> check cache
 * 3. If cached -> return cached pool
 * 4. If not cached -> create new pool with tenant's connection string
 * 
 * Example Usage:
 * - College1 (tenant_id: T1, db_url: null) -> returns mainPool
 * - College2 (tenant_id: T2, db_url: "https://phgngzizgszzwawnauxs.supabase.co") 
 *   -> returns dedicated pool for T2
 * 
 * @param {Object|null} tenant - { tenant_id, tenant_name, db_url }
 * @returns {Pool} PostgreSQL connection pool
 * @throws {Error} If tenant validation fails or pool creation fails
 */
function getPoolForTenant(tenant) {
  // ========================================================================
  // Case 1: No tenant specified or no separate database
  // ========================================================================
  if (!tenant || !tenant.db_url) {
    logger.debug(
      `${LOG.TRANSACTION_PREFIX} Using main pool for default tenant (T1)`,
      { tenant_id: tenant?.tenant_id || 'none' }
    );
    return mainPool;
  }

  // ========================================================================
  // Tenant Validation
  // ========================================================================
  const validation = validateTenant(tenant);
  if (!validation.valid) {
    const error = new Error(validation.error);
    logger.error(
      `${LOG.VALIDATION_PREFIX} Invalid tenant object provided`,
      {
        error: validation.error,
        tenant_id: tenant.tenant_id,
        provided_fields: Object.keys(tenant)
      }
    );
    throw error;
  }

  // ========================================================================
  // Case 2: Tenant has separate database
  // ========================================================================
  const dbKey = tenant.db_url;

  // Check if pool already exists in cache
  if (tenantPools.has(dbKey)) {
    logger.debug(
      `${LOG.TRANSACTION_PREFIX} Using cached pool for tenant`,
      { tenant_id: tenant.tenant_id, db_key: dbKey }
    );
    return tenantPools.get(dbKey);
  }

  // ========================================================================
  // Create New Tenant Pool
  // ========================================================================
  logger.info(
    `${LOG.TRANSACTION_PREFIX} Creating new connection pool for tenant`,
    {
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.tenant_url,
      db_connection: dbKey.substring(0, 50) + '...' // Log first 50 chars for security
    }
  );

  try {
    const tenantPool = new Pool({
      connectionString: tenant.db_url,
      min: DB.POOL_MIN_CONNECTIONS,
      max: DB.POOL_MAX_CONNECTIONS,
      idleTimeoutMillis: DB.POOL_IDLE_TIMEOUT,
      connectionTimeoutMillis: DB.CONNECTION_TIMEOUT,
      statement_timeout: DB.QUERY_TIMEOUT
    });

    // Set up error handlers for tenant pool
    tenantPool.on('error', (err) => {
      logger.error(
        `${LOG.TRANSACTION_PREFIX} Tenant pool error`,
        {
          tenant_id: tenant.tenant_id,
          error: err.message,
          code: err.code,
          severity: err.severity
        }
      );
    });

    tenantPool.on('connect', () => {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} New connection to tenant pool`,
        { tenant_id: tenant.tenant_id }
      );
    });

    tenantPool.on('remove', () => {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Connection removed from tenant pool`,
        { tenant_id: tenant.tenant_id }
      );
    });

    // Cache the pool
    tenantPools.set(dbKey, tenantPool);

    // Store metadata for monitoring
    tenantMetadata.set(dbKey, {
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.tenant_name,
      created_at: new Date(),
      status: 'active'
    });

    logger.info(
      `${LOG.TRANSACTION_PREFIX} Successfully created tenant pool`,
      {
        tenant_id: tenant.tenant_id,
        total_pools: tenantPools.size
      }
    );

    return tenantPool;

  } catch (err) {
    logger.error(
      `${LOG.TRANSACTION_PREFIX} Failed to create tenant pool`,
      {
        tenant_id: tenant.tenant_id,
        error: err.message,
        stack: err.stack
      }
    );
    throw new Error(`Cannot create pool for tenant ${tenant.tenant_id}: ${err.message}`);
  }
}

/**
 * ============================================================================
 * Closes all active database connections (graceful shutdown)
 * ============================================================================
 * Called during server shutdown to:
 * - Close main pool connections
 * - Close all tenant pool connections
 * - Log shutdown status
 * 
 * @returns {Promise<void>}
 */
async function closeAllPools() {
  logger.info(`${LOG.TRANSACTION_PREFIX} Closing all database connection pools`);

  try {
    // Close main pool
    if (mainPool) {
      await mainPool.end();
      logger.info(`${LOG.TRANSACTION_PREFIX} Main pool closed successfully`);
    }

    // Close all tenant pools
    for (const [dbKey, pool] of tenantPools.entries()) {
      try {
        await pool.end();
        const metadata = tenantMetadata.get(dbKey);
        logger.info(
          `${LOG.TRANSACTION_PREFIX} Tenant pool closed`,
          {
            tenant_id: metadata?.tenant_id || 'unknown',
            db_key: dbKey.substring(0, 50) + '...'
          }
        );
      } catch (err) {
        logger.error(
          `${LOG.TRANSACTION_PREFIX} Error closing tenant pool`,
          {
            db_key: dbKey.substring(0, 50) + '...',
            error: err.message
          }
        );
      }
    }

    tenantPools.clear();
    tenantMetadata.clear();
    logger.info(
      `${LOG.TRANSACTION_PREFIX} All database pools closed successfully`
    );

  } catch (err) {
    logger.error(
      `${LOG.TRANSACTION_PREFIX} Error during pool shutdown`,
      { error: err.message, stack: err.stack }
    );
    throw err;
  }
}

/**
 * ============================================================================
 * Returns connection pool statistics for monitoring
 * ============================================================================
 * @returns {Object} { main: Object, tenants: Array }
 */
function getPoolStats() {
  const stats = {
    main: {
      total: mainPool.totalCount || 0,
      idle: mainPool.idleCount || 0,
      waiting: mainPool.waitingCount || 0
    },
    tenants: Array.from(tenantPools.entries()).map(([dbKey, pool]) => {
      const metadata = tenantMetadata.get(dbKey);
      return {
        tenant_id: metadata?.tenant_id || 'unknown',
        total: pool.totalCount || 0,
        idle: pool.idleCount || 0,
        waiting: pool.waitingCount || 0
      };
    }),
    total_pools: 1 + tenantPools.size
  };
  return stats;
}

/**
 * ============================================================================
 * Tests connectivity to main and all tenant databases
 * ============================================================================
 * @returns {Promise<Object>} { main: boolean, tenants: Object }
 */
async function testConnectivity() {
  const results = {
    main: false,
    tenants: {},
    timestamp: new Date().toISOString()
  };

  try {
    // Test main pool
    const mainClient = await mainPool.connect();
    await mainClient.query('SELECT 1');
    mainClient.release();
    results.main = true;
    logger.debug(`${LOG.TRANSACTION_PREFIX} Main pool connectivity test passed`);
  } catch (err) {
    logger.error(
      `${LOG.TRANSACTION_PREFIX} Main pool connectivity test failed`,
      { error: err.message }
    );
    results.main = false;
  }

  // Test all tenant pools
  for (const [dbKey, pool] of tenantPools.entries()) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      const metadata = tenantMetadata.get(dbKey);
      results.tenants[metadata?.tenant_id || dbKey] = true;
    } catch (err) {
      const metadata = tenantMetadata.get(dbKey);
      results.tenants[metadata?.tenant_id || dbKey] = false;
      logger.error(
        `${LOG.TRANSACTION_PREFIX} Tenant pool connectivity test failed`,
        {
          tenant_id: metadata?.tenant_id || 'unknown',
          error: err.message
        }
      );
    }
  }

  return results;
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  getMainPool,
  getPoolForTenant,
  closeAllPools,
  getPoolStats,
  testConnectivity,
  validateTenant
};