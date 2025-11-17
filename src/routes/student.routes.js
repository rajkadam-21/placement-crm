const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/studentController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// Single registration
router.post('/register', StudentController.registerStudent);

// Bulk registration - only admin can do this
router.post('/bulk', authMiddleware, requireRole('admin'), StudentController.bulkRegisterStudents);

// Student login
router.post('/login', StudentController.loginStudent);

module.exports = router;
