/**
 * ============================================================================
 * STUDENT SERVICE - Student Management (UPDATED)
 * ============================================================================
 * Single Database Architecture
 * - Register single student
 * - Bulk register students
 * - Authenticate student (login)
 * - Update student password
 * - Update student profile (admin/teacher)
 * - Status checks: college active, student active
 */

const { getMainPool } = require('../config/db');
const passwordHelper = require('../utils/passwordHelper');
const jwtHelper = require('../utils/jwtHelper');
const logger = require('../config/logger');
const {
  LOG,
  STATUS,
  DB_ERROR_CODES
} = require('../config/constants');

class StudentService {
  /**
   * Register single student
   * 
   * Single Database:
   * 1. Verify college is active
   * 2. Hash password
   * 3. Check email uniqueness
   * 4. Create student
   * 
   * @param {Object} data - { college_id, student_name, student_email, student_password, student_department, student_year }
   * @returns {Object} Created student (without password)
   * @throws {Error} If validation fails
   */
  async registerStudent(data) {
    const {
      college_id,
      student_name,
      student_email,
      student_password,
      student_department,
      student_year
    } = data;

    const mainPool = getMainPool();
    const client = await mainPool.connect();

    try {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Starting student registration`,
        { college_id, student_email }
      );

      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // ====================================================================
      // Step 1: Verify college exists and is active
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Verifying college status`, {
        college_id
      });

      const collegeQuery = `
        SELECT college_id, college_status
        FROM colleges
        WHERE college_id = $1
        LIMIT 1
      `;

      const collegeResult = await client.query(collegeQuery, [college_id]);

      if (!collegeResult.rows.length) {
        await client.query('ROLLBACK');
        throw new Error('College not found');
      }

      const college = collegeResult.rows[0];

      if (college.college_status !== STATUS.ACTIVE) {
        await client.query('ROLLBACK');
        throw new Error('College is inactive');
      }

      // ====================================================================
      // Step 2: Hash password
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Hashing student password`);

      const hashedPassword = await passwordHelper.hashPassword(student_password);

      // ====================================================================
      // Step 3: Check email uniqueness
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Checking email uniqueness`, {
        student_email
      });

      const emailCheckQuery = `
        SELECT student_id FROM students
        WHERE LOWER(student_email) = LOWER($1)
        AND college_id = $2
        LIMIT 1
      `;

      const emailCheckResult = await client.query(emailCheckQuery, [
        student_email,
        college_id
      ]);

      if (emailCheckResult.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new Error('Email already exists');
      }

      // ====================================================================
      // Step 4: Create student
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Creating student record`, {
        college_id,
        student_email
      });

      const studentInsertQuery = `
        INSERT INTO students (
          college_id,
          student_name,
          student_email,
          student_password,
          student_department,
          student_year,
          student_status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING 
          student_id, 
          college_id, 
          student_name, 
          student_email, 
          student_department,
          student_year,
          student_status, 
          created_at
      `;

      const studentResult = await client.query(studentInsertQuery, [
        college_id,
        student_name,
        student_email,
        hashedPassword,
        student_department,
        student_year,
        STATUS.ACTIVE
      ]);

      await client.query('COMMIT');

      const student = studentResult.rows[0];

      logger.info(
        `${LOG.TRANSACTION_PREFIX} Student registered successfully`,
        {
          student_id: student.student_id,
          college_id: student.college_id,
          student_email: student.student_email
        }
      );

      return student;

    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        logger.error(
          `${LOG.TRANSACTION_PREFIX} Rollback failed`,
          { error: rollbackErr.message }
        );
      }

      logger.error(
        `${LOG.TRANSACTION_PREFIX} Student registration failed`,
        {
          error: err.message,
          code: err.code,
          college_id
        }
      );

      if (err.code === DB_ERROR_CODES.UNIQUE_VIOLATION) {
        throw new Error('Email already exists');
      }

      if (err.code === DB_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
        throw new Error('Invalid college reference');
      }

      throw err;

    } finally {
      client.release();
    }
  }

  /**
   * Bulk register students
   * 
   * @param {Array} students - Array of student objects
   * @param {string} collegeId - College ID
   * @returns {Object} { success, failed }
   */
  async bulkRegisterStudents(students, collegeId) {
    const mainPool = getMainPool();

    logger.debug(
      `${LOG.TRANSACTION_PREFIX} Starting bulk student registration`,
      { college_id: collegeId, total_students: students.length }
    );

    const success = [];
    const failed = [];

    for (const student of students) {
      try {
        const result = await this.registerStudent({
          college_id: collegeId,
          student_name: student.student_name,
          student_email: student.student_email,
          student_password: student.student_password,
          student_department: student.student_department,
          student_year: student.student_year
        });

        success.push({
          student_id: result.student_id,
          student_email: result.student_email,
          student_name: result.student_name
        });

      } catch (err) {
        failed.push({
          student_email: student.student_email,
          error: err.message
        });

        logger.warn(
          `${LOG.TRANSACTION_PREFIX} Failed to register student in bulk`,
          {
            student_email: student.student_email,
            error: err.message,
            college_id: collegeId
          }
        );
      }
    }

    logger.info(
      `${LOG.TRANSACTION_PREFIX} Bulk registration completed`,
      {
        college_id: collegeId,
        success_count: success.length,
        failed_count: failed.length
      }
    );

    return { success, failed };
  }

  /**
   * Authenticate student
   * 
   * Single Database:
   * 1. Query student by email and college
   * 2. Verify college is active
   * 3. Verify student is active
   * 4. Verify password
   * 5. Generate token
   * 
   * @param {string} email - Student email
   * @param {string} password - Student password
   * @param {string} collegeId - College ID
   * @returns {Object} { token, student }
   * @throws {Error} If authentication fails
   */
  async authenticateStudent(email, password, collegeId) {
    const mainPool = getMainPool();

    try {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Starting student authentication`,
        { student_email: email, college_id: collegeId }
      );

      // ====================================================================
      // Step 1: Query student with college details
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Querying student credentials`, {
        email,
        college_id: collegeId
      });

      const studentQuery = `
        SELECT 
          s.student_id,
          s.student_email,
          s.student_password,
          s.student_name,
          s.college_id,
          s.student_status,
          c.college_id,
          c.college_status,
          c.college_name
        FROM students s
        JOIN colleges c ON s.college_id = c.college_id
        WHERE LOWER(s.student_email) = LOWER($1)
        AND s.college_id = $2
        LIMIT 1
      `;

      const { rows } = await mainPool.query(studentQuery, [email, collegeId]);

      if (!rows || rows.length === 0) {
        logger.warn(
          `${LOG.SECURITY_PREFIX} Authentication failed - student not found`,
          { email, college_id: collegeId }
        );
        throw new Error('Invalid credentials');
      }

      const studentRecord = rows[0];

      // ====================================================================
      // Step 2: Check college is active
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Checking college status`, {
        college_id: studentRecord.college_id,
        college_status: studentRecord.college_status
      });

      if (studentRecord.college_status !== STATUS.ACTIVE) {
        logger.warn(
          `${LOG.SECURITY_PREFIX} Authentication failed - college not active`,
          {
            student_id: studentRecord.student_id,
            college_id: studentRecord.college_id
          }
        );
        throw new Error('College is inactive');
      }

      // ====================================================================
      // Step 3: Check student is active
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Checking student status`, {
        student_id: studentRecord.student_id,
        student_status: studentRecord.student_status
      });

      if (studentRecord.student_status !== STATUS.ACTIVE) {
        logger.warn(
          `${LOG.SECURITY_PREFIX} Authentication failed - student not active`,
          {
            student_id: studentRecord.student_id,
            student_status: studentRecord.student_status
          }
        );
        throw new Error('Student account is inactive');
      }

      // ====================================================================
      // Step 4: Validate password
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Validating password`, {
        student_id: studentRecord.student_id
      });

      const passwordMatch = await passwordHelper.compare(
        password,
        studentRecord.student_password
      );

      if (!passwordMatch) {
        logger.warn(
          `${LOG.SECURITY_PREFIX} Authentication failed - invalid password`,
          { student_id: studentRecord.student_id, email }
        );
        throw new Error('Invalid credentials');
      }

      // ====================================================================
      // Step 5: Generate JWT token
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Generating JWT token`, {
        student_id: studentRecord.student_id
      });

      const studentToken = jwtHelper.sign({
        id: studentRecord.student_id,
        role: 'student',
        email: studentRecord.student_email,
        college_id: studentRecord.college_id,
        timestamp: Date.now()
      });

      logger.info(
        `${LOG.TRANSACTION_PREFIX} Student authenticated successfully`,
        {
          student_id: studentRecord.student_id,
          college_id: studentRecord.college_id
        }
      );

      return {
        token: studentToken,
        student: {
          student_id: studentRecord.student_id,
          student_email: studentRecord.student_email,
          student_name: studentRecord.student_name,
          college_id: studentRecord.college_id
        }
      };

    } catch (err) {
      logger.error(
        `${LOG.TRANSACTION_PREFIX} Student authentication failed`,
        { error: err.message, email, college_id: collegeId }
      );

      throw err;
    }
  }

  /**
   * Update student password
   * 
   * @param {string} studentId - Student ID
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @throws {Error} If password verification fails
   */
  async updatePassword(studentId, oldPassword, newPassword) {
    const mainPool = getMainPool();
    const client = await mainPool.connect();

    try {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Starting password update`,
        { student_id: studentId }
      );

      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // ====================================================================
      // Step 1: Get student's current password
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Fetching student password hash`, {
        student_id: studentId
      });

      const studentQuery = `
        SELECT student_id, student_password, student_status
        FROM students
        WHERE student_id = $1
        LIMIT 1
      `;

      const studentResult = await client.query(studentQuery, [studentId]);

      if (!studentResult.rows.length) {
        await client.query('ROLLBACK');
        throw new Error('Student not found');
      }

      const student = studentResult.rows[0];

      // ====================================================================
      // Step 2: Verify old password
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Verifying old password`, {
        student_id: studentId
      });

      const passwordMatch = await passwordHelper.compare(
        oldPassword,
        student.student_password
      );

      if (!passwordMatch) {
        await client.query('ROLLBACK');
        logger.warn(
          `${LOG.SECURITY_PREFIX} Password update failed - invalid old password`,
          { student_id: studentId }
        );
        throw new Error('Invalid old password');
      }

      // ====================================================================
      // Step 3: Hash new password
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Hashing new password`);

      const hashedNewPassword = await passwordHelper.hashPassword(newPassword);

      // ====================================================================
      // Step 4: Update password
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Updating password`, {
        student_id: studentId
      });

      const updateQuery = `
        UPDATE students
        SET student_password = $1, updated_at = NOW()
        WHERE student_id = $2
        RETURNING student_id
      `;

      await client.query(updateQuery, [hashedNewPassword, studentId]);

      await client.query('COMMIT');

      logger.info(
        `${LOG.TRANSACTION_PREFIX} Password updated successfully`,
        { student_id: studentId }
      );

    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        logger.error(
          `${LOG.TRANSACTION_PREFIX} Rollback failed`,
          { error: rollbackErr.message }
        );
      }

      logger.error(
        `${LOG.TRANSACTION_PREFIX} Password update failed`,
        {
          error: err.message,
          student_id: studentId
        }
      );

      throw err;

    } finally {
      client.release();
    }
  }

  /**
   * Update student profile (admin/teacher)
   * 
   * @param {string} studentId - Student ID
   * @param {string} collegeId - College ID (for isolation)
   * @param {Object} data - { student_name, student_department, student_year, student_status }
   * @returns {Object} Updated student
   * @throws {Error} If not found or access denied
   */
  async updateProfile(studentId, collegeId, data) {
    const mainPool = getMainPool();
    const client = await mainPool.connect();

    try {
      logger.debug(
        `${LOG.TRANSACTION_PREFIX} Starting student profile update`,
        { student_id: studentId, college_id: collegeId }
      );

      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // ====================================================================
      // Step 1: Verify student exists and belongs to college
      // ====================================================================
      logger.debug(`${LOG.TRANSACTION_PREFIX} Verifying student access`, {
        student_id: studentId,
        college_id: collegeId
      });

      const checkQuery = `
        SELECT student_id, college_id FROM students
        WHERE student_id = $1
        AND college_id = $2
        LIMIT 1
      `;

      const checkResult = await client.query(checkQuery, [studentId, collegeId]);

      if (!checkResult.rows.length) {
        await client.query('ROLLBACK');
        throw new Error('Student not found');
      }

      // ====================================================================
      // Step 2: Update student profile
      // ====================================================================
      const updateQuery = `
        UPDATE students
        SET
          student_name = COALESCE($1, student_name),
          student_department = COALESCE($2, student_department),
          student_year = COALESCE($3, student_year),
          student_status = COALESCE($4, student_status),
          updated_at = NOW()
        WHERE student_id = $5
        AND college_id = $6
        RETURNING 
          student_id, 
          college_id, 
          student_name, 
          student_email, 
          student_department,
          student_year,
          student_status
      `;

      const updateResult = await client.query(updateQuery, [
        data.student_name || null,
        data.student_department || null,
        data.student_year || null,
        data.student_status || null,
        studentId,
        collegeId
      ]);

      await client.query('COMMIT');

      logger.info(
        `${LOG.TRANSACTION_PREFIX} Student profile updated successfully`,
        {
          student_id: studentId,
          college_id: collegeId
        }
      );

      return updateResult.rows[0];

    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        logger.error(
          `${LOG.TRANSACTION_PREFIX} Rollback failed`,
          { error: rollbackErr.message }
        );
      }

      logger.error(
        `${LOG.TRANSACTION_PREFIX} Student profile update failed`,
        {
          error: err.message,
          student_id: studentId,
          college_id: collegeId
        }
      );

      throw err;

    } finally {
      client.release();
    }
  }
}

module.exports = new StudentService();