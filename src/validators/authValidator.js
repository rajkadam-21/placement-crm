/**
 * ============================================================================
 * AUTH VALIDATORS
 * ============================================================================
 * Request validation schemas for auth API
 * ============================================================================
 */

const Joi = require('joi');
const { VALIDATION } = require('../config/constants');

/**
 * Login schema
 * Validates login request body
 */
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Invalid email format',
      'any.required': 'Email is required'
    }),

  password: Joi.string()
    .min(VALIDATION.PASSWORD_MIN_LENGTH)
    .max(VALIDATION.PASSWORD_MAX_LENGTH)
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.min': `Minimum ${VALIDATION.PASSWORD_MIN_LENGTH} characters`,
      'string.max': `Maximum ${VALIDATION.PASSWORD_MAX_LENGTH} characters`,
      'any.required': 'Password is required'
    })
});

module.exports = {
  loginSchema
};
