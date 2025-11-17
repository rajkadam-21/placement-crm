/**
 * ============================================================================
 * COLLEGE CONTROLLER - College Management
 * ============================================================================
 * Handles college CRUD operations
 * - Create college (link to existing tenant)
 * - Get all colleges
 * - Get college by ID
 * - Update college
 * ============================================================================
 */

const collegeService = require('../services/collegeService');
const logger = require('../config/logger');
const { success, error } = require('../utils/responseHelper');
const {
  LOG,
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  ROLES
} = require('../config/constants');

/**
 * POST /api/v1/admin/colleges
 * Create new college linked to existing tenant
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function createCollege(req, res) {
  const requestId = `${LOG.API_START_PREFIX} POST /admin/colleges`;
  const startTime = Date.now();

  logger.info(requestId, {
    user_id: req.user?.id,
    user_role: req.user?.role,
    tenant_id: req.validated?.tenant_id,
    ip: req.ip
  });

  try {
    // Authorization check
    if (req.user?.role !== ROLES.SYSADMIN) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} Unauthorized college creation attempt`,
        {
          user_id: req.user?.id,
          user_role: req.user?.role,
          ip: req.ip
        }
      );
      return error(res, ERROR_MESSAGES.ONLY_SYSADMIN, HTTP_STATUS.FORBIDDEN);
    }

    const {
      tenant_id,
      college_name,
      college_subdomain,
      admin_name,
      admin_email,
      admin_password
    } = req.validated;

    // Create college
    const newCollege = await collegeService.create({
      tenant_id,
      college_name,
      college_subdomain,
      admin_name,
      admin_email,
      admin_password
    });

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} POST /admin/colleges - College created successfully`,
      {
        college_id: newCollege.college.college_id,
        tenant_id: newCollege.college.tenant_id,
        admin_user_id: newCollege.admin.user_id,
        created_by: req.user.id,
        duration_ms: duration
      }
    );

    return success(
      res,
      newCollege,
      SUCCESS_MESSAGES.COLLEGE_CREATED,
      HTTP_STATUS.CREATED
    );

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} POST /admin/colleges - Error`,
      {
        error: err.message,
        user_id: req.user?.id,
        duration_ms: duration,
        stack: err.stack
      }
    );

    if (err.message.includes('not found')) {
      return error(res, err.message, HTTP_STATUS.BAD_REQUEST);
    }

    if (err.message.includes('already exists')) {
      return error(res, err.message, HTTP_STATUS.CONFLICT);
    }

    return error(res, ERROR_MESSAGES.SERVER_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * GET /api/v1/admin/colleges
 * List all colleges with pagination
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function listColleges(req, res) {
  const requestId = `${LOG.API_START_PREFIX} GET /admin/colleges`;
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
        `${LOG.SECURITY_PREFIX} Unauthorized college list attempt`,
        { user_id: req.user?.id }
      );
      return error(res, ERROR_MESSAGES.ONLY_SYSADMIN, HTTP_STATUS.FORBIDDEN);
    }

    const page = req.validated?.page || 1;
    const limit = req.validated?.limit || 20;

    const result = await collegeService.list(page, limit);

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} GET /admin/colleges - Retrieved ${result.data.length} colleges`,
      {
        total: result.pagination.total,
        page: page,
        limit: limit,
        duration_ms: duration
      }
    );

    return success(
      res,
      result.data,
      'Colleges retrieved',
      HTTP_STATUS.OK
    );

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} GET /admin/colleges - Error`,
      {
        error: err.message,
        duration_ms: duration
      }
    );

    return error(res, ERROR_MESSAGES.SERVER_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * GET /api/v1/admin/colleges/:collegeId
 * Get single college by ID
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function getCollege(req, res) {
  const requestId = `${LOG.API_START_PREFIX} GET /admin/colleges/:collegeId`;
  const startTime = Date.now();

  logger.info(requestId, {
    college_id: req.params.collegeId,
    user_id: req.user?.id
  });

  try {
    // Authorization check
    if (req.user?.role !== ROLES.SYSADMIN) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} Unauthorized college access attempt`,
        {
          user_id: req.user?.id,
          college_id: req.params.collegeId
        }
      );
      return error(res, ERROR_MESSAGES.ONLY_SYSADMIN, HTTP_STATUS.FORBIDDEN);
    }

    const college = await collegeService.getById(req.params.collegeId);

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} GET /admin/colleges/:collegeId - Retrieved successfully`,
      {
        college_id: college.college_id,
        duration_ms: duration
      }
    );

    return success(res, college, 'College retrieved', HTTP_STATUS.OK);

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} GET /admin/colleges/:collegeId - Error`,
      {
        error: err.message,
        college_id: req.params.collegeId,
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
 * PUT /api/v1/admin/colleges/:collegeId
 * Update college
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function updateCollege(req, res) {
  const requestId = `${LOG.API_START_PREFIX} PUT /admin/colleges/:collegeId`;
  const startTime = Date.now();

  logger.info(requestId, {
    college_id: req.params.collegeId,
    user_id: req.user?.id,
    updated_fields: Object.keys(req.validated)
  });

  try {
    // Authorization check
    if (req.user?.role !== ROLES.SYSADMIN) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} Unauthorized college update attempt`,
        {
          user_id: req.user?.id,
          college_id: req.params.collegeId
        }
      );
      return error(res, ERROR_MESSAGES.ONLY_SYSADMIN, HTTP_STATUS.FORBIDDEN);
    }

    const updatedCollege = await collegeService.update(
      req.params.collegeId,
      req.validated
    );

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} PUT /admin/colleges/:collegeId - Updated successfully`,
      {
        college_id: updatedCollege.college_id,
        updated_by: req.user.id,
        duration_ms: duration
      }
    );

    return success(res, updatedCollege, SUCCESS_MESSAGES.COLLEGE_UPDATED, HTTP_STATUS.OK);

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} PUT /admin/colleges/:collegeId - Error`,
      {
        error: err.message,
        college_id: req.params.collegeId,
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
  createCollege,
  listColleges,
  getCollege,
  updateCollege
};
