/**
 * ============================================================================
 * VALIDATORS - Tenant and College
 * ============================================================================
 * Request validation using Joi schemas
 * ============================================================================
 */

const Joi = require('joi');
const { VALIDATION, STATUS } = require('../config/constants');

// ============================================================================
// TENANT VALIDATORS
// ============================================================================

const createTenantSchema = Joi.object({
  tenant_name: Joi.string()
    .min(VALIDATION.STRING_MIN_LENGTH)
    .max(VALIDATION.STRING_MAX_LENGTH)
    .required()
    .messages({
      'string.empty': 'Tenant name is required',
      'string.min': `Minimum ${VALIDATION.STRING_MIN_LENGTH} characters`
    }),

  db_url: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.uri': 'Invalid database URL format'
    })
});

const updateTenantSchema = Joi.object({
  tenant_name: Joi.string()
    .min(VALIDATION.STRING_MIN_LENGTH)
    .max(VALIDATION.STRING_MAX_LENGTH)
    .optional(),

  db_url: Joi.string()
    .uri()
    .optional(),

  status: Joi.string()
    .valid(...Object.values(STATUS))
    .optional()
}).min(1).messages({
  'object.min': 'At least one field must be updated'
});

const listTenantSchema = Joi.object({
  page: Joi.number()
    .positive()
    .optional()
    .default(1),

  limit: Joi.number()
    .positive()
    .max(100)
    .optional()
    .default(20)
});

// ============================================================================
// COLLEGE VALIDATORS
// ============================================================================

/**
 * Create college schema
 * Validates college creation request body
 */
const createCollegeSchema = Joi.object({
  tenant_id: Joi.string()
    .required()
    .messages({
      'string.empty': 'Tenant ID is required',
      'any.required': 'Tenant ID is required'
    }),

  college_name: Joi.string()
    .min(VALIDATION.STRING_MIN_LENGTH)
    .max(200)
    .required()
    .messages({
      'string.empty': 'College name is required',
      'string.min': `Minimum ${VALIDATION.STRING_MIN_LENGTH} characters`,
      'string.max': 'College name cannot exceed 200 characters'
    }),

  college_subdomain: Joi.string()
    .pattern(/^[a-z0-9-]+$/)
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'College subdomain is required',
      'string.pattern.base': 'Subdomain must contain only lowercase letters, numbers, and hyphens',
      'string.min': 'Subdomain must be at least 2 characters',
      'string.max': 'Subdomain cannot exceed 50 characters'
    }),

  admin_name: Joi.string()
    .min(VALIDATION.STRING_MIN_LENGTH)
    .max(100)
    .optional()
    .messages({
      'string.min': `Minimum ${VALIDATION.STRING_MIN_LENGTH} characters`,
      'string.max': 'Admin name cannot exceed 100 characters'
    }),

  admin_email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Admin email is required',
      'string.email': 'Invalid email format',
      'any.required': 'Admin email is required'
    }),

  admin_password: Joi.string()
    .min(VALIDATION.PASSWORD_MIN_LENGTH)
    .max(VALIDATION.PASSWORD_MAX_LENGTH)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.empty': 'Admin password is required',
      'string.min': `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`,
      'string.max': `Password cannot exceed ${VALIDATION.PASSWORD_MAX_LENGTH} characters`,
      'string.pattern.base': 'Password must contain uppercase, lowercase, and numeric characters',
      'any.required': 'Admin password is required'
    })
});

/**
 * Update college schema
 * Validates college update request body
 */
const updateCollegeSchema = Joi.object({
  college_name: Joi.string()
    .min(VALIDATION.STRING_MIN_LENGTH)
    .max(200)
    .optional()
    .messages({
      'string.min': `Minimum ${VALIDATION.STRING_MIN_LENGTH} characters`,
      'string.max': 'College name cannot exceed 200 characters'
    }),

  college_subdomain: Joi.string()
    .pattern(/^[a-z0-9-]+$/)
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.pattern.base': 'Subdomain must contain only lowercase letters, numbers, and hyphens',
      'string.min': 'Subdomain must be at least 2 characters',
      'string.max': 'Subdomain cannot exceed 50 characters'
    }),

  status: Joi.string()
    .valid(...Object.values(STATUS))
    .optional()
    .messages({
      'any.only': `Status must be one of: ${Object.values(STATUS).join(', ')}`
    })
}).min(1).messages({
  'object.min': 'At least one field must be updated'
});

/**
 * List college schema
 * Validates pagination query parameters
 */
const listCollegeSchema = Joi.object({
  page: Joi.number()
    .positive()
    .optional()
    .default(1)
    .messages({
      'number.positive': 'Page must be a positive number'
    }),

  limit: Joi.number()
    .positive()
    .max(100)
    .optional()
    .default(20)
    .messages({
      'number.positive': 'Limit must be a positive number',
      'number.max': 'Limit cannot exceed 100'
    })
});

module.exports = {
  // Tenant
  createTenantSchema,
  updateTenantSchema,
  listTenantSchema,
  // College
  createCollegeSchema,
  updateCollegeSchema,
  listCollegeSchema
};
