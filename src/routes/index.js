const express = require('express');
const authRoutes = require('./auth.routes');
const tenantCollegeRoutes = require('./tenantCollege.routes');
const studentRoutes = require('./student.routes');
const userRoutes = require('./user.routes'); // ✅ NEW

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin', tenantCollegeRoutes);
router.use('/students', studentRoutes);
router.use('/users', userRoutes); // ✅ NEW

module.exports = router;
