/**
 * ============================================================================
 * STUDENT VALIDATORS - Request Validation Schemas (UPDATED)
 * ============================================================================
 * Joi schemas for student API endpoints
 */

const Joi = require('joi');
const { VALIDATION, STATUS } = require('../config/constants');

/**
 * Register student schema
 * Validates student registration request body
 */
const registerStudentSchema = Joi.object({
  college_id: Joi.string()
    .required()
    .messages({
      'string.empty': 'College ID is required',
      'any.required': 'College ID is required'
    }),

  student_name: Joi.string()
    .min(VALIDATION.STRING_MIN_LENGTH)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Student name is required',
      'string.min': `Minimum ${VALIDATION.STRING_MIN_LENGTH} characters`,
      'string.max': 'Student name cannot exceed 100 characters',
      'any.required': 'Student name is required'
    }),

  student_email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Student email is required',
      'string.email': 'Invalid email format',
      'any.required': 'Student email is required'
    }),

  student_password: Joi.string()
    .min(VALIDATION.PASSWORD_MIN_LENGTH)
    .max(VALIDATION.PASSWORD_MAX_LENGTH)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.empty': 'Student password is required',
      'string.min': `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`,
      'string.max': `Password cannot exceed ${VALIDATION.PASSWORD_MAX_LENGTH} characters`,
      'string.pattern.base': 'Password must contain uppercase, lowercase, and numeric characters',
      'any.required': 'Student password is required'
    }),

  student_department: Joi.string()
    .min(VALIDATION.STRING_MIN_LENGTH)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Student department is required',
      'string.min': `Minimum ${VALIDATION.STRING_MIN_LENGTH} characters`,
      'string.max': 'Student department cannot exceed 50 characters',
      'any.required': 'Student department is required'
    }),

  student_year: Joi.number()
    .integer()
    .min(1)
    .max(4)
    .required()
    .messages({
      'number.base': 'Student year must be a number',
      'number.min': 'Student year must be at least 1',
      'number.max': 'Student year cannot exceed 4',
      'any.required': 'Student year is required'
    })
});

/**
 * Bulk register students schema
 * Validates bulk registration request body
 */
const bulkRegisterStudentsSchema = Joi.object({
  students: Joi.array()
    .items(
      Joi.object({
        student_name: Joi.string()
          .min(VALIDATION.STRING_MIN_LENGTH)
          .max(100)
          .required(),
        student_email: Joi.string()
          .email()
          .required(),
        student_password: Joi.string()
          .min(VALIDATION.PASSWORD_MIN_LENGTH)
          .max(VALIDATION.PASSWORD_MAX_LENGTH)
          .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
          .required(),
        student_department: Joi.string()
          .min(VALIDATION.STRING_MIN_LENGTH)
          .max(50)
          .required(),
        student_year: Joi.number()
          .integer()
          .min(1)
          .max(4)
          .required()
      })
    )
    .min(1)
    .required()
    .messages({
      'array.base': 'Students must be an array',
      'array.min': 'At least one student is required',
      'any.required': 'Students array is required'
    })
});

/**
 * Login student schema
 * Validates student login request body
 */
const loginStudentSchema = Joi.object({
  college_id: Joi.string()
    .required()
    .messages({
      'string.empty': 'College ID is required',
      'any.required': 'College ID is required'
    }),

  student_email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Student email is required',
      'string.email': 'Invalid email format',
      'any.required': 'Student email is required'
    }),

  student_password: Joi.string()
    .min(VALIDATION.PASSWORD_MIN_LENGTH)
    .max(VALIDATION.PASSWORD_MAX_LENGTH)
    .required()
    .messages({
      'string.empty': 'Student password is required',
      'string.min': `Minimum ${VALIDATION.PASSWORD_MIN_LENGTH} characters`,
      'string.max': `Maximum ${VALIDATION.PASSWORD_MAX_LENGTH} characters`,
      'any.required': 'Student password is required'
    })
});

/**
 * Update password schema
 * Validates password change request body
 */
const updatePasswordSchema = Joi.object({
  old_password: Joi.string()
    .min(VALIDATION.PASSWORD_MIN_LENGTH)
    .max(VALIDATION.PASSWORD_MAX_LENGTH)
    .required()
    .messages({
      'string.empty': 'Old password is required',
      'any.required': 'Old password is required'
    }),

  new_password: Joi.string()
    .min(VALIDATION.PASSWORD_MIN_LENGTH)
    .max(VALIDATION.PASSWORD_MAX_LENGTH)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.empty': 'New password is required',
      'string.min': `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`,
      'string.max': `Password cannot exceed ${VALIDATION.PASSWORD_MAX_LENGTH} characters`,
      'string.pattern.base': 'Password must contain uppercase, lowercase, and numeric characters',
      'any.required': 'New password is required'
    })
});

/**
 * Update profile schema
 * Validates student profile update request body
 */
const updateProfileSchema = Joi.object({
  student_name: Joi.string()
    .min(VALIDATION.STRING_MIN_LENGTH)
    .max(100)
    .optional()
    .messages({
      'string.min': `Minimum ${VALIDATION.STRING_MIN_LENGTH} characters`,
      'string.max': 'Student name cannot exceed 100 characters'
    }),

  student_department: Joi.string()
    .min(VALIDATION.STRING_MIN_LENGTH)
    .max(50)
    .optional()
    .messages({
      'string.min': `Minimum ${VALIDATION.STRING_MIN_LENGTH} characters`,
      'string.max': 'Student department cannot exceed 50 characters'
    }),

  student_year: Joi.number()
    .integer()
    .min(1)
    .max(4)
    .optional()
    .messages({
      'number.base': 'Student year must be a number',
      'number.min': 'Student year must be at least 1',
      'number.max': 'Student year cannot exceed 4'
    }),

  student_status: Joi.string()
    .valid(STATUS.ACTIVE, 'inactive')
    .optional()
    .messages({
      'any.only': `Student status must be one of: ${STATUS.ACTIVE}, inactive`
    })
}).min(1).messages({
  'object.min': 'At least one field must be updated'
});


const updateCollegeFeaturesSchema = Joi.object({
  enabled_features: Joi.array()
    .items(Joi.string().min(1))
    .min(1)
    .required()
    .messages({
      'array.base': 'Enabled features must be an array of strings',
      'array.min': 'At least one feature is required',
      'string.min': 'Each feature must be a non-empty string',
      'any.required': 'Enabled features are required'
    })
});

module.exports = {
  registerStudentSchema,
  bulkRegisterStudentsSchema,
  loginStudentSchema,
  updatePasswordSchema,
  updateProfileSchema,
   updateCollegeFeaturesSchema
};