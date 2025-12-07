/**
 * ============================================================================
 * VALIDATE REQUEST MIDDLEWARE
 * ============================================================================
 * Validates request data using Joi schemas
 * 
 * Usage: validate(createUserSchema)
 * Validates req.body by default
 * On success: Attaches validated data to req.validated
 * On error: Returns 400 with validation details
 */

const Joi = require('joi');
const logger = require('../config/logger');
const { LOG } = require('../config/constants');

/**
 * Validation middleware factory
 * 
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      const data = req.body;

      const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        logger.warn(
          `${LOG.VALIDATION_PREFIX} Request validation failed`,
          {
            path: req.path,
            errors: error.details.map(d => d.message)
          }
        );

        const details = error.details.map(d => d.message);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          details: details
        });
      }

      req.validated = value;
      next();

    } catch (err) {
      logger.error(
        `${LOG.TRANSACTION_PREFIX} Unexpected error in validation middleware`,
        { error: err.message }
      );
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}

module.exports = validate;