/**
 * ============================================================================
 * DB.JS - Database Connection Pool Management (SIMPLIFIED)
 * ============================================================================
 * Single database architecture - all colleges in one database
 * 
 * Architecture:
 * - Single Main Pool: All data in one PostgreSQL database
 * - No tenant-specific pools needed
 * - College isolation via college_id filtering in queries
 * 
 * ============================================================================
 */

const { Pool } = require('pg');
const config = require('./env');
const logger = require('./logger');
const { DB, LOG } = require('./constants');

// ============================================================================
// MAIN CONNECTION POOL (All Colleges & Data)
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
      code: err.code
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
// GET MAIN POOL (Only function needed)
// ============================================================================
/**
 * Retrieves connection pool for main database
 * 
 * All queries use this single pool for colleges, users, students, and resources
 * College isolation enforced via college_id in WHERE clauses
 * 
 * @returns {Pool} PostgreSQL connection pool
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

// ============================================================================
// CLOSE ALL POOLS (Graceful Shutdown)
// ============================================================================
/**
 * Closes main database connection pool
 * Called during server shutdown
 * 
 * @returns {Promise<void>}
 */
async function closeAllPools() {
  logger.info(`${LOG.TRANSACTION_PREFIX} Closing database connection pool`);

  try {
    if (mainPool) {
      await mainPool.end();
      logger.info(`${LOG.TRANSACTION_PREFIX} Main pool closed successfully`);
    }
  } catch (err) {
    logger.error(
      `${LOG.TRANSACTION_PREFIX} Error closing pool`,
      { error: err.message }
    );
    throw err;
  }
}

// ============================================================================
// POOL STATISTICS (Monitoring)
// ============================================================================
/**
 * Returns connection pool statistics
 * 
 * @returns {Object} { total, idle, waiting }
 */
function getPoolStats() {
  return {
    total: mainPool.totalCount || 0,
    idle: mainPool.idleCount || 0,
    waiting: mainPool.waitingCount || 0
  };
}

// ============================================================================
// TEST CONNECTIVITY
// ============================================================================
/**
 * Tests connectivity to main database
 * 
 * @returns {Promise<Object>} { connected: boolean, timestamp }
 */
async function testConnectivity() {
  const results = {
    connected: false,
    timestamp: new Date().toISOString()
  };

  try {
    const client = await mainPool.connect();
    await client.query('SELECT 1');
    client.release();
    results.connected = true;
    logger.debug(`${LOG.TRANSACTION_PREFIX} Database connectivity test passed`);
  } catch (err) {
    logger.error(
      `${LOG.TRANSACTION_PREFIX} Database connectivity test failed`,
      { error: err.message }
    );
    results.connected = false;
  }

  return results;
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  getMainPool,
  closeAllPools,
  getPoolStats,
  testConnectivity
};