/**
 * ============================================================================
 * CONSTANTS.JS - Centralized Application Constants
 * ============================================================================
 * All magic strings, configuration values, and constants are defined here
 * to ensure maintainability, reduce duplication, and enable single-point updates.
 * ============================================================================
 */

// ============================================================================
// DATABASE CONSTANTS
// ============================================================================
const DB = {
    TENANT_DEFAULT_ID: 'T1',
    TENANT_DEFAULT_NAME: 'default',
    CONNECTION_TIMEOUT: 5000, // ms
    QUERY_TIMEOUT: 30000, // ms
    POOL_MIN_CONNECTIONS: 2,
    POOL_MAX_CONNECTIONS: 20,
    POOL_IDLE_TIMEOUT: 30000, // ms
    POOL_REUSE_COUNT: 1000
};

// ============================================================================
// USER & AUTHENTICATION CONSTANTS
// ============================================================================
const AUTH = {
    SYSTEM_ADMIN_ID: 'system-admin-001',
    SALT_ROUNDS: 10,
    JWT_TOKEN_SPLIT_INDEX: 1,
    SYSTEM_ADMIN_ID: 'sysadmin',
    PASSWORD_MIN_LENGTH: 8,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    SUBDOMAIN_REGEX: /^[a-z0-9-]+$/,
    SUBDOMAIN_MIN_LENGTH: 2,
    SUBDOMAIN_MAX_LENGTH: 50
};

// ============================================================================
// USER ROLES & PERMISSIONS
// ============================================================================
const ROLES = {
    SYSADMIN: 'sysadmin',
    ADMIN: 'admin',
    TEACHER: 'teacher',
    STUDENT: 'student',
    OTHER: 'other'
};

const ROLE_HIERARCHY = {
    [ROLES.SYSADMIN]: 100,
    [ROLES.ADMIN]: 80,
    [ROLES.TEACHER]: 50,
    [ROLES.STUDENT]: 10,
    [ROLES.OTHER]: 5
};

const VALID_ROLES = Object.values(ROLES);

// ============================================================================
// STATUS CONSTANTS
// ============================================================================
const STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
    PENDING: 'pending'
};

const COLLEGE_STATUSES = [STATUS.ACTIVE, STATUS.INACTIVE, STATUS.SUSPENDED];
const USER_STATUSES = [STATUS.ACTIVE, STATUS.INACTIVE, STATUS.SUSPENDED];
const STUDENT_STATUSES = [STATUS.ACTIVE, STATUS.INACTIVE];

// ============================================================================
// HTTP STATUS CODES
// ============================================================================
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};

// ============================================================================
// ERROR MESSAGES
// ============================================================================
const ERROR_MESSAGES = {
    // Authentication
    MISSING_AUTH_HEADER: 'Missing Authorization header',
    INVALID_AUTH_HEADER: 'Invalid Authorization header format',
    INVALID_TOKEN: 'Invalid or expired token',
    INVALID_CREDENTIALS: 'Invalid email or password',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Forbidden - insufficient permissions',
    ACCESS_DENIED_COLLEGE: 'Access denied - Invalid college',
    ACCESS_DENIED_TENANT: 'Access denied to this tenant',

    // Validation
    MISSING_REQUIRED_FIELDS: 'Missing required fields',
    INVALID_EMAIL_FORMAT: 'Invalid email format',
    INVALID_SUBDOMAIN_FORMAT: 'Subdomain must be lowercase alphanumeric with hyphens only',
    PASSWORD_TOO_SHORT: 'Password must be at least 8 characters',
    INVALID_ROLE: 'Invalid user role provided',
    INVALID_STATUS: 'Invalid status value',
    INVALID_ARRAY: 'Expected array data type',

    // Resource conflicts
    EMAIL_ALREADY_EXISTS: 'Email already exists in system',
    SUBDOMAIN_ALREADY_EXISTS: 'College subdomain already exists',
    DUPLICATE_ENTRY: 'Duplicate entry detected',
    COLLEGE_NOT_FOUND: 'College not found',
    USER_NOT_FOUND: 'User not found',
    STUDENT_NOT_FOUND: 'Student not found',
    TENANT_NOT_FOUND: 'Tenant not found',

    // Permissions
    ONLY_SYSADMIN: 'Only system administrator can perform this action',
    ONLY_ADMIN: 'Only college admin can perform this action',
    CANNOT_UPDATE_OTHER_COLLEGE: 'Cannot update user from another college',
    CANNOT_DELETE_SELF: 'Cannot delete your own account',

    // Database
    DATABASE_ERROR: 'Database operation failed',
    TRANSACTION_FAILED: 'Transaction failed - operation rolled back',
    CONNECTION_POOL_ERROR: 'Database connection pool error',

    // General
    SERVER_ERROR: 'Internal server error',
    TOO_MANY_REQUESTS: 'Too many requests, please try again later',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',

    RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
    LOGIN_RATE_LIMIT: 'Too many login attempts. Please try again in 15 minutes',
    UPLOAD_RATE_LIMIT: 'Upload limit exceeded. Maximum 10 uploads per hour',
    SEARCH_RATE_LIMIT: 'Search limit exceeded. Please try again in a few moments',
};

// ============================================================================
// SUCCESS MESSAGES
// ============================================================================
const SUCCESS_MESSAGES = {
    LOGIN_SUCCESSFUL: 'Login successful',
    LOGOUT_SUCCESSFUL: 'Logout successful',
    USER_CREATED: 'User created successfully',
    USER_UPDATED: 'User updated successfully',
    USER_DELETED: 'User deactivated successfully',
    STUDENT_REGISTERED: 'Student registered successfully',
    BULK_REGISTRATION_COMPLETED: 'Bulk student registration completed',
    TENANT_CREATED: 'Tenant created successfully',
    TENANT_UPDATED: 'Tenant updated successfully',
    COLLEGE_CREATED: 'College created successfully',
    COLLEGE_UPDATED: 'College updated successfully',
    USER_CREATED: 'User created successfully',
    USER_UPDATED: 'User updated successfully',
    USER_DELETED: 'User deactivated successfully'

};

// ============================================================================
// LOGGING CONSTANTS
// ============================================================================
const LOG = {
    API_START_PREFIX: '[API_START]',
    API_END_PREFIX: '[API_END]',
    API_ERROR_PREFIX: '[API_ERROR]',
    TRANSACTION_PREFIX: '[TRANSACTION]',
    AUTH_PREFIX: '[AUTH]',
    VALIDATION_PREFIX: '[VALIDATION]',
    SECURITY_PREFIX: '[SECURITY]',
    DATABASE_PREFIX: '[DATABASE]',
    CACHE_PREFIX: '[CACHE]',
    EXTERNAL_PREFIX: '[EXTERNAL_API]'
};

const LOG_LEVELS = {
    ERROR: 'error',      // 0 - System errors, exceptions
    WARN: 'warn',        // 1 - Warnings, validation failures
    INFO: 'info',        // 2 - API calls, successful operations
    DEBUG: 'debug'       // 3 - Detailed flow information
};
// ============================================================================
// DATABASE QUERY CONSTANTS
// ============================================================================
const DB_QUERY = {
    LIMIT_DEFAULT: 1,
    LIMIT_MAX: 1000
};

// ============================================================================
// REQUEST VALIDATION CONSTRAINTS
// ============================================================================
const VALIDATION = {
    STRING_MIN_LENGTH: 2,
    STRING_MAX_LENGTH: 200,
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 100,
    EMAIL_MAX_LENGTH: 255,
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_MAX_LENGTH: 128,
    BULK_STUDENTS_MAX: 5000,
    EMPTY_ARRAY_ERROR: 'Students array cannot be empty'
};

// ============================================================================
// DATABASE ERROR CODES (PostgreSQL)
// ============================================================================
const DB_ERROR_CODES = {
    UNIQUE_VIOLATION: '23505',
    FOREIGN_KEY_VIOLATION: '23503',
    NOT_NULL_VIOLATION: '23502',
    CHECK_VIOLATION: '23514',
    INVALID_TEXT_REPRESENTATION: '22P02'
};

// ============================================================================
// APPLICATION CONFIGURATION
// ============================================================================
const APP = {
    NAME: 'College Placement CRM',
    VERSION: '1.0.0',
    API_PREFIX: '/api/v1',
    HEALTH_CHECK_PATH: '/health',
    DEFAULT_HOST_DOMAIN: 'pcrm.in',
    ADMIN_SUBDOMAIN_PREFIX: 'admin',
    WWW_SUBDOMAIN_PREFIX: 'www'
};

// ============================================================================
// RATE LIMITING DEFAULTS (can be overridden by env vars)
// ============================================================================
// Consolidated detailed rate limit configuration
const RATE_LIMIT = {
    // Global rate limiting (per IP)
    WINDOW_MS_DEFAULT: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS_DEFAULT: 100,

    // Authentication endpoints (very strict)
    WINDOW_MS_AUTH: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS_AUTH: 5, // 5 attempts

    // General API endpoints (moderate)
    WINDOW_MS_API: 1 * 60 * 1000, // 1 minute
    MAX_REQUESTS_API: 50, // 50 requests

    // File upload endpoints (strict)
    WINDOW_MS_UPLOAD: 60 * 60 * 1000, // 1 hour
    MAX_REQUESTS_UPLOAD: 10, // 10 uploads

    // Tenant-level rate limiting (per tenant)
    WINDOW_MS_TENANT: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS_TENANT: 100,

    // College-level rate limiting (per college)
    WINDOW_MS_COLLEGE: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS_COLLEGE: 200,

    // Search endpoints (moderate)
    // RATE_LIMIT consolidated above
    // Authentication endpoints (very strict)
    WINDOW_MS_AUTH: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS_AUTH: 5, // 5 attempts

    // General API endpoints (moderate)
    WINDOW_MS_API: 1 * 60 * 1000, // 1 minute
    MAX_REQUESTS_API: 50, // 50 requests

    // File upload endpoints (strict)
    WINDOW_MS_UPLOAD: 60 * 60 * 1000, // 1 hour
    MAX_REQUESTS_UPLOAD: 10, // 10 uploads

    // Tenant-level rate limiting (per tenant)
    WINDOW_MS_TENANT: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS_TENANT: 100,

    // College-level rate limiting (per college)
    WINDOW_MS_COLLEGE: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS_COLLEGE: 200,

    // Search endpoints (moderate)
    WINDOW_MS_SEARCH: 1 * 60 * 1000, // 1 minute
    MAX_REQUESTS_SEARCH: 30,

    // Webhook endpoints (moderate)
    WINDOW_MS_WEBHOOK: 1 * 60 * 1000, // 1 minute
    MAX_REQUESTS_WEBHOOK: 100,

    // Data export endpoints (strict)
    WINDOW_MS_EXPORT: 60 * 60 * 1000, // 1 hour
    MAX_REQUESTS_EXPORT: 5
};


// ============================================================================
// LOG CONFIGURATION
// ============================================================================

const LOG_CONFIG = {
    // Log levels (0 = only errors, 1 = errors + warnings, 2 = info, 3 = debug)
    LEVELS: {
        production: LOG_LEVELS.INFO,
        staging: LOG_LEVELS.DEBUG,
        development: LOG_LEVELS.DEBUG
    },

    // Max file size before rotation (10MB)
    MAX_FILE_SIZE: 10485760,

    // Number of log files to keep
    MAX_FILES: {
        error: 5,
        info: 5,
        combined: 10,
        exceptions: 5,
        rejections: 5
    },

    // Log directories
    LOG_DIR: 'logs',

    // File names
    LOG_FILES: {
        error: 'error.log',
        info: 'info.log',
        combined: 'combined.log',
        exceptions: 'exceptions.log',
        rejections: 'rejections.log'
    },

    // Timestamp format
    TIMESTAMP_FORMAT: 'YYYY-MM-DD HH:mm:ss.SSS',

    // Service metadata
    SERVICE: {
        name: process.env.SERVICE_NAME || 'college-crm-api',
        version: process.env.API_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    }
};

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    DB,
    AUTH,
    ROLES,
    ROLE_HIERARCHY,
    VALID_ROLES,
    STATUS,
    COLLEGE_STATUSES,
    USER_STATUSES,
    STUDENT_STATUSES,
    HTTP_STATUS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    LOG,
    LOG_LEVELS,
    RATE_LIMIT,
    DB_QUERY,
    VALIDATION,
    DB_ERROR_CODES,
    APP,
    RATE_LIMIT,
    // PAGINATION,
    // CORS_CONFIG,
    LOG_CONFIG
};