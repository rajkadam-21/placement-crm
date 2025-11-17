const http = require('http');
const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');

const server = http.createServer(app);

// process.on('SIGTERM', async () => {
//   logger.info('SIGTERM received, shutting down gracefully');
//   server.close(async () => {
//     const { closeAllPools } = require('./config/db');
//     await closeAllPools();
//     process.exit(0);
//   });
// });

server.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
});
