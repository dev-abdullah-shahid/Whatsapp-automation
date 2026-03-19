require('dotenv').config();
const { campaignQueue, followUpQueue } = require('../services/queue.service');
const { runCampaign } = require('../services/campaign.service');
const { processDueFollowUps } = require('../services/automation.service');
const logger = require('../utils/logger');

logger.info('Campaign worker started');

// Process campaign send jobs
campaignQueue.process(async (job) => {
  const { campaignId, leads } = job.data;
  logger.info('Processing campaign job', { jobId: job.id, campaignId, leads: leads.length });
  return runCampaign(campaignId, leads);
});

// Process follow-up jobs
followUpQueue.process(async (job) => {
  const { leadId, message } = job.data;
  logger.info('Processing follow-up job', { jobId: job.id, leadId });
  await processDueFollowUps();
  return { leadId };
});

// Also poll for due follow-ups every minute
setInterval(async () => {
  try {
    await processDueFollowUps();
  } catch (err) {
    logger.error('Follow-up polling error', { error: err.message });
  }
}, 60 * 1000);