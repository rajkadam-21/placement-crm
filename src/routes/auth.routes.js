/**
 * ============================================================================
 * AUTH ROUTES - Authentication API
 * ============================================================================
 * - POST /login  - System admin and college user login
 * - POST /logout - Logout endpoint
 * - GET /verify  - Verify token validity
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const validate = require('../middleware/validateRequest');
const { authLimiter } = require('../config/rateLimiter');
const { loginSchema } = require('../validators/authValidator');

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  authController.login
);

router.post(
  '/logout',
  authMiddleware,
  authLimiter,
  authController.logout
);

router.get(
  '/verify',
  authMiddleware,
  authController.verifyToken
);

module.exports = router;
