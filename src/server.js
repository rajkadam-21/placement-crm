/**
 * ============================================================================
 * SERVER.JS - Application Entry Point
 * ============================================================================
 * Starts HTTP server and handles graceful shutdown
 * ============================================================================
 */

const http = require('http');
const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
const { closeAllPools } = require('./config/db');

const server = http.createServer(app);

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  server.close(async () => {
    try {
      await closeAllPools();
      logger.info('Database pools closed');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { error: err.message });
      process.exit(1);
    }
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  server.close(async () => {
    try {
      await closeAllPools();
      logger.info('Database pools closed');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { error: err.message });
      process.exit(1);
    }
  });
});

// ============================================================================
// START SERVER
// ============================================================================

server.listen(config.port, () => {
  logger.info('Server started', {
    port: config.port,
    environment: config.nodeEnv,
    timestamp: new Date().toISOString()
  });
});