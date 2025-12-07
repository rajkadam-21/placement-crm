/**
 * ============================================================================
 * PASSWORD HELPER - Password Hashing & Verification
 * ============================================================================
 * Secure password handling with bcrypt
 */

const bcrypt = require('bcrypt');
const logger = require('../config/logger');
const { LOG } = require('../config/constants');

const SALT_ROUNDS = 10;

/**
 * Hash plain text password
 * 
 * @param {string} plain - Plain text password
 * @returns {Promise<string>} Hashed password
 * @throws {Error} If hashing fails
 */
async function hashPassword(plain) {
  try {
    logger.debug(`${LOG.TRANSACTION_PREFIX} Hashing password`);

    return await bcrypt.hash(plain, SALT_ROUNDS);

  } catch (err) {
    logger.error(
      `${LOG.TRANSACTION_PREFIX} Error hashing password`,
      { error: err.message }
    );
    throw err;
  }
}

/**
 * Compare plain text password with hashed password
 * 
 * @param {string} plain - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if passwords match
 * @throws {Error} If comparison fails
 */
async function compare(plain, hash) {
  try {
    logger.debug(`${LOG.TRANSACTION_PREFIX} Comparing passwords`);

    return await bcrypt.compare(plain, hash);

  } catch (err) {
    logger.error(
      `${LOG.TRANSACTION_PREFIX} Error comparing passwords`,
      { error: err.message }
    );
    throw err;
  }
}

module.exports = { hashPassword, compare };