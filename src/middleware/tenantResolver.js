/**
 * ============================================================================
 * TENANT RESOLVER MIDDLEWARE
 * ============================================================================
 * Resolves tenant (college) from subdomain and attaches to request.
 * 
 * Flow:
 * 1. Extract host from request headers
 * 2. Parse subdomain from host
 * 3. Query colleges table for subdomain match
 * 4. Attach tenant info to request
 * 5. Continue to next middleware
 * 
 * ============================================================================
 */

const logger = require('../config/logger');
const { getMainPool } = require('../config/db');
const { LOG, STATUS, HTTP_STATUS } = require('../config/constants');

/**
 * ============================================================================
 * Extract Subdomain from Host Header
 * ============================================================================
 * Examples:
 * - rcpit.pcrm.in -> 'rcpit'
 * - admin.rcpit.pcrm.in -> 'rcpit'
 * - www.pcrm.in -> null (main portal)
 * - localhost:3000 -> null (local development)
 * 
 * @param {string} host - Host header value (e.g., "rcpit.pcrm.in:3000")
 * @returns {string|null} Subdomain or null if no college subdomain
 */
function getSubdomainFromHost(host) {
  if (!host || typeof host !== 'string') {
    logger.debug(
      `${LOG.TRANSACTION_PREFIX} Invalid host provided to getSubdomainFromHost`,
      { host: host }
    );
    return null;
  }

  // Remove port if present
  const hostname = host.split(':')[0].toLowerCase();

  // Handle localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    logger.debug(
      `${LOG.TRANSACTION_PREFIX} Local development environment detected`
    );
    return null;
  }

  const parts = hostname.split('.');

  // Need at least 3 parts (college.domain.extension) or just (domain.extension)
  if (parts.length < 2) {
    logger.debug(
      `${LOG.TRANSACTION_PREFIX} Host has insufficient parts for subdomain extraction`,
      { hostname: hostname, parts_count: parts.length }
    );
    return null;
  }

  // If first part is 'admin', 'www', or other system subdomains, use second part
  const systemPrefixes = ['admin', 'www', 'api', 'app', 'mail', 'ftp'];
  if (systemPrefixes.includes(parts[0])) {
    const subdomain = parts[1];
    logger.debug(
      `${LOG.TRANSACTION_PREFIX} System prefix detected, extracting second part as subdomain`,
      { prefix: parts[0], subdomain: subdomain }
    );
    return subdomain;
  }

  // Otherwise, first part is the college subdomain
  const subdomain = parts[0];
  logger.debug(
    `${LOG.TRANSACTION_PREFIX} College subdomain extracted from host`,
    { hostname: hostname, subdomain: subdomain }
  );

  return subdomain;
}

/**
 * ============================================================================
 * Tenant Resolver Middleware
 * ============================================================================
 * 
 * Resolves tenant (college) from request subdomain and attaches to request.
 * If no subdomain or college not found, proceeds as main portal request.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 * @returns {void}
 */
async function tenantResolver(req, res, next) {
  try {
    const host = req.headers.host;

    // ====================================================================
    // 1. EXTRACT SUBDOMAIN
    // ====================================================================
    const subdomain = getSubdomainFromHost(host);

    if (!subdomain) {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} No college subdomain - treating as main portal`,
        { host: host }
      );
      req.tenant = null;
      req.isTenantPortal = false;
      return next();
    }

    // ====================================================================
    // 2. QUERY FOR COLLEGE
    // ====================================================================
    try {
      const mainPool = getMainPool();

      const query = `
        SELECT 
          college_id,
          tenant_id,
          college_name,
          college_subdomain,
          college_status,
          created_at
        FROM colleges 
        WHERE LOWER(college_subdomain) = LOWER($1)
        AND college_status = $2
        LIMIT 1
      `;

      const { rows } = await mainPool.query(query, [subdomain, STATUS.ACTIVE]);

      if (!rows || rows.length === 0) {
        logger.warn(
          `${LOG.TRANSACTION_PREFIX} Tenant not found for subdomain`,
          { subdomain: subdomain, host: host }
        );
        req.tenant = null;
        req.isTenantPortal = true;
        req.requestedSubdomain = subdomain;
        return next();
      }

      // ====================================================================
      // 3. ATTACH TENANT TO REQUEST
      // ====================================================================
      const college = rows[0];
      req.tenant = college;
      req.isTenantPortal = true;

      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Tenant resolved successfully`,
        {
          college_id: college.college_id,
          tenant_id: college.tenant_id,
          subdomain: college.college_subdomain,
          college_name: college.college_name
        }
      );

      return next();

    } catch (err) {
      logger.error(
        `${LOG.TRANSACTION_PREFIX} Database error in tenant resolver ${err}`,
        {
          error: err.message,
          code: err.code,
          subdomain: subdomain
        }
      );

      // Don't fail the request - proceed without tenant info
      req.tenant = null;
      req.isTenantPortal = true;
      req.requestedSubdomain = subdomain;

      return next();
    }

  } catch (err) {
    logger.error(
      `${LOG.TRANSACTION_PREFIX} Unexpected error in tenant resolver`,
      {
        error: err.message,
        stack: err.stack,
        host: req.headers.host
      }
    );

    // Don't block request on middleware error
    req.tenant = null;
    req.isTenantPortal = false;

    return next();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = tenantResolver;
module.exports.getSubdomainFromHost = getSubdomainFromHost;