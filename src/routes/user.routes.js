/**
 * ============================================================================
 * USER ROUTES
 * ============================================================================
 * User management API endpoints with:
 * - Authentication middleware
 * - Role-based authorization
 * - Request validation
 * - Rate limiting
 * ============================================================================
 */

const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const validate = require('../middleware/validateRequest');
const { apiLimiter } = require('../config/rateLimiter');

const {
  createUserSchema,
  updateUserSchema,
  listUserSchema
} = require('../validators/userValidator');

const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/v1/users
 * Create new user (admin only)
 */
router.post(
  '/',
  requireRole(ROLES.ADMIN),
  apiLimiter,
  validate(createUserSchema),
  userController.createUser
);

/**
 * GET /api/v1/users
 * List users in college (admin/teacher)
 */
router.get(
  '/',
  requireRole(ROLES.ADMIN, ROLES.TEACHER),
  apiLimiter,
  validate(listUserSchema),
  userController.listUsers
);

/**
 * GET /api/v1/users/:userId
 * Get single user (admin/teacher)
 */
router.get(
  '/:userId',
  requireRole(ROLES.ADMIN, ROLES.TEACHER),
  apiLimiter,
  userController.getUser
);

/**
 * PUT /api/v1/users/:userId
 * Update user (admin only)
 */
router.put(
  '/:userId',
  requireRole(ROLES.ADMIN),
  apiLimiter,
  validate(updateUserSchema),
  userController.updateUser
);

/**
 * DELETE /api/v1/users/:userId
 * Soft delete user (admin only)
 */
router.delete(
  '/:userId',
  requireRole(ROLES.ADMIN),
  apiLimiter,
  userController.deleteUser
);

module.exports = router;
