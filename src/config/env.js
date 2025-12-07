/**
 * ============================================================================
 * ENV.JS - Environment Configuration
 * ============================================================================
 * Loads environment variables and provides configuration
 * 
 * Single Database Architecture:
 * - DATABASE_URL: Main PostgreSQL connection string
 * - No multi-tenant database URLs needed
 * ============================================================================
 */

const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
  path: process.env.NODE_ENV === 'production'
    ? '.env'
    : path.resolve(process.cwd(), '.env')
});

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sysadminEmail: process.env.SYSADMIN_EMAIL,
  sysadminPassword: process.env.SYSADMIN_PASSWORD,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL,
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
};