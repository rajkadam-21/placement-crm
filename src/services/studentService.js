/**
 * ============================================================================
 * STUDENT CONTROLLER - Student Management
 * ============================================================================
 * Handles HTTP requests:
 * - Student registration (single & bulk)
 * - Student authentication
 * - Response formatting
 * - Calls StudentService for business logic
 * ============================================================================
 */

const studentService = require('../services/studentService');
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
 * POST /api/v1/students/register
 * Register single student
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function registerStudent(req, res) {
  const requestId = `${LOG.API_START_PREFIX} POST /students/register`;
  const startTime = Date.now();

  logger.info(requestId, {
    ip: req.ip,
    college_id: req.validated?.college_id
  });

  try {
    const {
      student_name,
      student_email,
      student_password,
      student_department,
      student_year,
      college_id
    } = req.validated;

    // Call service
    const newStudent = await studentService.registerStudent(
      {
        college_id,
        student_name,
        student_email,
        student_password,
        student_department,
        student_year
      },
      req.tenant
    );

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} POST /students/register - Student registered successfully`,
      {
        student_id: newStudent.student_id,
        student_email: newStudent.student_email,
        college_id: newStudent.college_id,
        duration_ms: duration
      }
    );

    return success(
      res,
      {
        student_id: newStudent.student_id,
        student_name: newStudent.student_name,
        student_email: newStudent.student_email
      },
      SUCCESS_MESSAGES.STUDENT_REGISTERED,
      HTTP_STATUS.CREATED
    );

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} POST /students/register - Error`,
      {
        error: err.message,
        college_id: req.validated?.college_id,
        duration_ms: duration,
        stack: err.stack
      }
    );

    if (err.message.includes('already exists')) {
      return error(
        res,
        ERROR_MESSAGES.EMAIL_ALREADY_EXISTS,
        HTTP_STATUS.CONFLICT
      );
    }

    if (err.message.includes('not found') || err.message.includes('inactive')) {
      return error(res, err.message, HTTP_STATUS.BAD_REQUEST);
    }

    if (err.message.includes('Access denied')) {
      return error(res, ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }

    return error(
      res,
      ERROR_MESSAGES.SERVER_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * POST /api/v1/students/bulk
 * Bulk register students (admin only)
 * 
 * @param {Object} req - Express request (authenticated)
 * @param {Object} res - Express response
 */
async function bulkRegisterStudents(req, res) {
  const requestId = `${LOG.API_START_PREFIX} POST /students/bulk`;
  const startTime = Date.now();

  logger.info(requestId, {
    user_id: req.user?.id,
    user_role: req.user?.role,
    college_id: req.validated?.college_id,
    total_students: req.validated?.students?.length
  });

  try {
    // Authorization check
    if (req.user?.role !== ROLES.ADMIN && req.user?.role !== ROLES.SYSADMIN) {
      logger.warn(
        `${LOG.SECURITY_PREFIX} Unauthorized bulk registration attempt`,
        {
          user_id: req.user?.id,
          user_role: req.user?.role
        }
      );
      return error(res, ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }

    const { students, college_id } = req.validated;

    // Call service
    const results = await studentService.bulkRegisterStudents(
      students,
      college_id,
      req.tenant
    );

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} POST /students/bulk - Bulk registration completed`,
      {
        total: students.length,
        success: results.success.length,
        failed: results.failed.length,
        college_id: college_id,
        duration_ms: duration
      }
    );

    return success(
      res,
      results,
      `${results.success.length} students registered, ${results.failed.length} failed`,
      HTTP_STATUS.OK
    );

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} POST /students/bulk - Error`,
      {
        error: err.message,
        user_id: req.user?.id,
        college_id: req.validated?.college_id,
        duration_ms: duration,
        stack: err.stack
      }
    );

    return error(
      res,
      ERROR_MESSAGES.SERVER_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * POST /api/v1/students/login
 * Student login
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function loginStudent(req, res) {
  const requestId = `${LOG.API_START_PREFIX} POST /students/login`;
  const startTime = Date.now();

  logger.info(requestId, {
    ip: req.ip,
    student_email: req.validated?.student_email
  });

  try {
    const { student_email, student_password } = req.validated;

    // Call service
    const authResult = await studentService.authenticateStudent(
      student_email,
      student_password,
      req.tenant
    );

    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} POST /students/login - Student login successful`,
      {
        student_id: authResult.student.student_id,
        college_id: authResult.student.college_id,
        ip: req.ip,
        duration_ms: duration
      }
    );

    return success(
      res,
      {
        token: authResult.token,
        role: 'student',
        student_email: authResult.student.student_email,
        student_name: authResult.student.student_name
      },
      SUCCESS_MESSAGES.LOGIN_SUCCESSFUL,
      HTTP_STATUS.OK
    );

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} POST /students/login - Error`,
      {
        error: err.message,
        ip: req.ip,
        duration_ms: duration,
        stack: err.stack
      }
    );

    if (
      err.message.includes('Invalid credentials') ||
      err.message.includes('not found')
    ) {
      return error(
        res,
        ERROR_MESSAGES.INVALID_CREDENTIALS,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (err.message.includes('Access denied')) {
      return error(res, ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }

    return error(
      res,
      ERROR_MESSAGES.SERVER_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * POST /api/v1/students/logout
 * Logout student (stateless JWT - optional endpoint)
 * 
 * @param {Object} req - Express request (authenticated)
 * @param {Object} res - Express response
 */
async function logoutStudent(req, res) {
  const requestId = `${LOG.API_START_PREFIX} POST /students/logout`;
  const startTime = Date.now();

  logger.info(requestId, {
    student_id: req.user?.id,
    ip: req.ip
  });

  try {
    const duration = Date.now() - startTime;

    logger.info(
      `${LOG.API_END_PREFIX} POST /students/logout - Logout successful`,
      {
        student_id: req.user?.id,
        duration_ms: duration
      }
    );

    return success(
      res,
      {},
      SUCCESS_MESSAGES.LOGOUT_SUCCESSFUL,
      HTTP_STATUS.OK
    );

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      `${LOG.API_ERROR_PREFIX} POST /students/logout - Error`,
      {
        error: err.message,
        student_id: req.user?.id,
        duration_ms: duration
      }
    );

    return error(
      res,
      ERROR_MESSAGES.SERVER_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

module.exports = {
  registerStudent,
  bulkRegisterStudents,
  loginStudent,
  logoutStudent
};
