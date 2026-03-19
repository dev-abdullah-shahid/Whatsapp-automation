require('dotenv').config();
const { messageQueue } = require('../services/queue.service');
const { sendTextMessage } = require('../services/whatsapp.service');
const { saveMessage } = require('../services/message.service');
const logger = require('../utils/logger');

logger.info('Message worker started');

messageQueue.process(async (job) => {
  const { to, body, leadId, campaignId } = job.data;

  logger.info('Processing message job', { jobId: job.id, to });

  const { messageId } = await sendTextMessage(to, body);

  if (leadId) {
    await saveMessage({
      leadId,
      direction: 'OUTBOUND',
      body,
      waMessageId: messageId,
      status: 'SENT',
      campaignId
    });
  }

  return { messageId, to };
});