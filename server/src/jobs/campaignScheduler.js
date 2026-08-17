const { Campaign } = require('../models');
const CampaignWorker = require('../services/campaignWorker');
const logger = require('../utils/logger');

let intervalId = null;

/**
 * Periodically checks for scheduled campaigns ready for dispatch
 */
const startScheduler = (intervalMs = 15000) => {
  if (intervalId) return;

  logger.info(`[CampaignScheduler] Background scheduler started (Polling interval: ${intervalMs / 1000}s)`);

  intervalId = setInterval(async () => {
    try {
      const now = new Date();
      const scheduledCampaigns = await Campaign.find({
        status: { $in: ['SCHEDULED', 'scheduled'] },
        scheduledAt: { $lte: now },
      });

      for (const campaign of scheduledCampaigns) {
        logger.info(`[CampaignScheduler] Launching scheduled broadcast campaign "${campaign.name}" (${campaign._id})`);

        // Update status to PROCESSING to prevent re-picking
        campaign.status = 'PROCESSING';
        campaign.startedAt = new Date();
        await campaign.save();

        // Dispatch background worker
        CampaignWorker.startBackgroundJob(campaign._id);
      }
    } catch (err) {
      logger.error(`[CampaignScheduler Error] ${err.message}`);
    }
  }, intervalMs);
};

const stopScheduler = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[CampaignScheduler] Scheduler stopped');
  }
};

module.exports = {
  startScheduler,
  stopScheduler,
};
