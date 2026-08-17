const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from server/.env or root .env
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const { initSocketIO } = require('./sockets/socketServer');
const { startScheduler } = require('./jobs/campaignScheduler');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
initSocketIO(server);

// Start server after connecting to MongoDB
const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      logger.info(`[SERVER] Backend started on port ${PORT}`);
      const isMetaConfigured = Boolean(
        process.env.META_ACCESS_TOKEN &&
        process.env.META_PHONE_NUMBER_ID &&
        process.env.META_BUSINESS_ACCOUNT_ID
      );
      if (isMetaConfigured) {
        logger.info(`[WHATSAPP] Cloud API configured`);
      } else {
        logger.info(`[WHATSAPP] Cloud API credentials not fully set in environment`);
      }

      // Start background campaign scheduler
      startScheduler();
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
