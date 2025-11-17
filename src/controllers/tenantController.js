/**
 * ============================================================================
 * TENANT CONTROLLER - Multi-Tenant Management
 * ============================================================================
 * Handles tenant CRUD operations (T1, T2, T3...)
 * - Create tenant (system admin only)
 * - List all tenants
 * - Get single tenant
 * - Update tenant
 * ============================================================================
 */

const { getMainPool } = require('../config/db');
const logger = require('../config/logger');
const { success, error } = require('../utils/responseHelper');
const {
  ROLES,
  STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  LOG,
  HTTP_STATUS,
  DB_ERROR_CODES
} = require('../config/constants');
const tenantService = require('../services/tenantService');

/**
 * POST /api/v1/admin/tenants
 * Create new tenant (system admin only)
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function createTenant(req, res) {
  const requestId = `${LOG.API_START_PREFIX} POST /admin/tenants`;
  const startTime = Date.now();

  logger.info(requestId, {
    user_id: req.user?.id,
    user_role: req.user?.role,
    ip: req.ip
  });

  try {
    // Authorization check
    if (req.user?.role !== ROLES.SYSADMIN) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} Unauthorized tenant creation attempt`,
        {
          user_id: req.user?.id,
          user_role: req.user?.role,
          ip: req.ip
        }
      );
      return error(res, ERROR_MESSAGES.ONLY_SYSADMIN, HTTP_STATUS.FORBIDDEN);
    }

    const { tenant_name, db_url } = req.validated;

    // Call service
    const newTenant = await tenantService.create({
      tenant_name,
      db_url: db_url || null
    });

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} POST /admin/tenants - Tenant created successfully`,
      {
        tenant_id: newTenant.tenant_id,
        tenant_name: newTenant.tenant_name,
        has_separate_db: !!newTenant.db_url,
        created_by: req.user.id,
        duration_ms: duration
      }
    );

    return success(
      res,
      newTenant,
      SUCCESS_MESSAGES.TENANT_CREATED,
      HTTP_STATUS.CREATED
    );

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} POST /admin/tenants - Error`,
      {
        error: err.message,
        user_id: req.user?.id,
        duration_ms: duration,
        stack: err.stack
      }
    );

    if (err.message.includes('already exists')) {
      return error(res, err.message, HTTP_STATUS.CONFLICT);
    }

    return error(res, ERROR_MESSAGES.SERVER_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * GET /api/v1/admin/tenants
 * List all tenants (system admin only)
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function listTenants(req, res) {
  const requestId = `${LOG.API_START_PREFIX} GET /admin/tenants`;
  const startTime = Date.now();

  logger.info(requestId, {
    user_id: req.user?.id,
    user_role: req.user?.role,
    query_params: req.query
  });

  try {
    // Authorization check
    if (req.user?.role !== ROLES.SYSADMIN) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} Unauthorized tenant list attempt`,
        { user_id: req.user?.id }
      );
      return error(res, ERROR_MESSAGES.ONLY_SYSADMIN, HTTP_STATUS.FORBIDDEN);
    }

    const page = req.validated?.page || 1;
    const limit = req.validated?.limit || 20;

    const result = await tenantService.list(page, limit);

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} GET /admin/tenants - Retrieved ${result.data.length} tenants`,
      {
        total: result.pagination.total,
        page: page,
        limit: limit,
        duration_ms: duration
      }
    );

    return success(res, result.data, 'Tenants retrieved', HTTP_STATUS.OK);

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} GET /admin/tenants - Error`,
      {
        error: err.message,
        duration_ms: duration
      }
    );

    return error(res, err, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * GET /api/v1/admin/tenants/:tenantId
 * Get single tenant by ID (system admin only)
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function getTenant(req, res) {
  const requestId = `${LOG.API_START_PREFIX} GET /admin/tenants/:tenantId`;
  const startTime = Date.now();

  logger.info(requestId, {
    tenant_id: req.params.tenantId,
    user_id: req.user?.id
  });

  try {
    // Authorization check
    if (req.user?.role !== ROLES.SYSADMIN) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} Unauthorized tenant retrieval attempt`,
        { user_id: req.user?.id, tenant_id: req.params.tenantId }
      );
      return error(res, ERROR_MESSAGES.ONLY_SYSADMIN, HTTP_STATUS.FORBIDDEN);
    }

    const tenant = await tenantService.getById(req.params.tenantId);

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} GET /admin/tenants/:tenantId - Retrieved successfully`,
      {
        tenant_id: tenant.tenant_id,
        duration_ms: duration
      }
    );

    return success(res, tenant, 'Tenant retrieved', HTTP_STATUS.OK);

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} GET /admin/tenants/:tenantId - Error`,
      {
        error: err.message,
        tenant_id: req.params.tenantId,
        duration_ms: duration
      }
    );

    if (err.message.includes('not found')) {
      return error(res, ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    return error(res, ERROR_MESSAGES.SERVER_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * PUT /api/v1/admin/tenants/:tenantId
 * Update tenant (system admin only)
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function updateTenant(req, res) {
  const requestId = `${LOG.API_START_PREFIX} PUT /admin/tenants/:tenantId`;
  const startTime = Date.now();

  logger.info(requestId, {
    tenant_id: req.params.tenantId,
    user_id: req.user?.id,
    updated_fields: Object.keys(req.validated)
  });

  try {
    // Authorization check
    if (req.user?.role !== ROLES.SYSADMIN) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} Unauthorized tenant update attempt`,
        { user_id: req.user?.id, tenant_id: req.params.tenantId }
      );
      return error(res, ERROR_MESSAGES.ONLY_SYSADMIN, HTTP_STATUS.FORBIDDEN);
    }

    const updatedTenant = await tenantService.update(
      req.params.tenantId,
      req.validated
    );

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} PUT /admin/tenants/:tenantId - Updated successfully`,
      {
        tenant_id: updatedTenant.tenant_id,
        updated_by: req.user.id,
        duration_ms: duration
      }
    );

    return success(res, updatedTenant, SUCCESS_MESSAGES.TENANT_UPDATED, HTTP_STATUS.OK);

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} PUT /admin/tenants/:tenantId - Error`,
      {
        error: err.message,
        tenant_id: req.params.tenantId,
        duration_ms: duration
      }
    );

    if (err.message.includes('not found')) {
      return error(res, ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    return error(res, ERROR_MESSAGES.SERVER_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

module.exports = {
  createTenant,
  listTenants,
  getTenant,
  updateTenant
};
