const Bull = require('bull');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create queues
const messageQueue = new Bull('messages', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

const campaignQueue = new Bull('campaigns', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 50
  }
});

const followUpQueue = new Bull('followups', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

// Queue event logging
[messageQueue, campaignQueue, followUpQueue].forEach(queue => {
  queue.on('failed', (job, err) => {
    logger.error(`Queue job failed`, {
      queue: queue.name,
      jobId: job.id,
      error: err.message,
      attempts: job.attemptsMade
    });
  });

  queue.on('completed', (job) => {
    logger.info(`Queue job completed`, {
      queue: queue.name,
      jobId: job.id
    });
  });
});

/**
 * Add a message send job to the queue
 */
async function queueMessage({ to, body, leadId, campaignId }) {
  return messageQueue.add({ to, body, leadId, campaignId });
}

/**
 * Add a campaign job to the queue
 */
async function queueCampaign({ campaignId, leads }) {
  return campaignQueue.add({ campaignId, leads });
}

/**
 * Schedule a follow-up job with a delay
 */
async function queueFollowUp({ leadId, message, delayMinutes = 60 }) {
  const delayMs = delayMinutes * 60 * 1000;
  return followUpQueue.add({ leadId, message }, { delay: delayMs });
}

module.exports = {
  messageQueue,
  campaignQueue,
  followUpQueue,
  queueMessage,
  queueCampaign,
  queueFollowUp
};