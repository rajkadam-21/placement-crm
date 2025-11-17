/**
 * ============================================================================
 * ROUTES - Tenant and College Management
 * ============================================================================
 * Centralized API routes with:
 * - Authorization middleware
 * - Rate limiting
 * - Request validation
 * ============================================================================
 */

const express = require('express');
const router = express.Router();

const tenantController = require('../controllers/tenantController');
const collegeController = require('../controllers/collegeController');

const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const validate = require('../middleware/validateRequest');
const { apiLimiter, tenantLimiter } = require('../config/rateLimiter');

const {
  createTenantSchema,
  updateTenantSchema,
  listTenantSchema,
  createCollegeSchema,
  updateCollegeSchema,
  listCollegeSchema
} = require('../validators/tenantCollegeValidators');

const { ROLES } = require('../config/constants');

// ============================================================================
// TENANT ROUTES
// ============================================================================

/**
 * POST /api/v1/admin/tenants
 * Create new tenant (system admin only)
 */
router.post(
  '/tenants',
  authMiddleware,
  requireRole(ROLES.SYSADMIN),
  apiLimiter,
  validate(createTenantSchema),
  tenantController.createTenant
);

/**
 * GET /api/v1/admin/tenants
 * List all tenants (system admin only)
 */
router.get(
  '/tenants',
  authMiddleware,
  requireRole(ROLES.SYSADMIN),
  apiLimiter,
  validate(listTenantSchema),
  tenantController.listTenants
);

/**
 * GET /api/v1/admin/tenants/:tenantId
 * Get single tenant (system admin only)
 */
router.get(
  '/tenants/:tenantId',
  authMiddleware,
  requireRole(ROLES.SYSADMIN),
  apiLimiter,
  tenantController.getTenant
);

/**
 * PUT /api/v1/admin/tenants/:tenantId
 * Update tenant (system admin only)
 */
router.put(
  '/tenants/:tenantId',
  authMiddleware,
  requireRole(ROLES.SYSADMIN),
  apiLimiter,
  validate(updateTenantSchema),
  tenantController.updateTenant
);

// ============================================================================
// COLLEGE ROUTES
// ============================================================================

/**
 * POST /api/v1/admin/colleges
 * Create college linked to tenant (system admin only)
 */
router.post(
  '/colleges',
  authMiddleware,
  requireRole(ROLES.SYSADMIN),
  apiLimiter,
  validate(createCollegeSchema),
  collegeController.createCollege
);

/**
 * GET /api/v1/admin/colleges
 * List all colleges (system admin only)
 */
router.get(
  '/colleges',
  authMiddleware,
  requireRole(ROLES.SYSADMIN),
  apiLimiter,
  validate(listCollegeSchema),
  collegeController.listColleges
);

/**
 * GET /api/v1/admin/colleges/:collegeId
 * Get single college (system admin only)
 */
router.get(
  '/colleges/:collegeId',
  authMiddleware,
  requireRole(ROLES.SYSADMIN),
  apiLimiter,
  collegeController.getCollege
);

/**
 * PUT /api/v1/admin/colleges/:collegeId
 * Update college (system admin only)
 */
router.put(
  '/colleges/:collegeId',
  authMiddleware,
  requireRole(ROLES.SYSADMIN),
  apiLimiter,
  validate(updateCollegeSchema),
  collegeController.updateCollege
);

module.exports = router;