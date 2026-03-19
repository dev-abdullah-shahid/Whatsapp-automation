const { prisma } = require('../db');
const { sendTextMessage } = require('./whatsapp.service');
const { saveMessage } = require('./message.service');
const logger = require('../utils/logger');

/**
 * Schedule a follow-up message for a lead after X minutes
 */
async function scheduleFollowUp(leadId, message, delayMinutes = 60) {
  const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000);

  logger.info('Follow-up scheduled', { leadId, delayMinutes, sendAt });

  // Store in DB for the worker to pick up
  await prisma.campaign.create({
    data: {
      name: `followup_${leadId}_${Date.now()}`,
      template: message,
      status: 'RUNNING',
      scheduledAt: sendAt,
      settings: { type: 'followup', leadId }
    }
  });
}

/**
 * Process due follow-ups — called by the worker every minute
 */
async function processDueFollowUps() {
  const now = new Date();

  const dueCampaigns = await prisma.campaign.findMany({
    where: {
      status: 'RUNNING',
      scheduledAt: { lte: now },
      settings: { path: ['type'], equals: 'followup' }
    }
  });

  for (const campaign of dueCampaigns) {
    const leadId = campaign.settings?.leadId;
    if (!leadId) continue;

    try {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!lead) continue;

      // Don't send if lead already replied recently
      const recentReply = await prisma.message.findFirst({
        where: {
          leadId,
          direction: 'INBOUND',
          sentAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
        }
      });

      if (recentReply) {
        logger.info('Skipping follow-up — lead replied recently', { leadId });
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'COMPLETED' }
        });
        continue;
      }

      const { messageId } = await sendTextMessage(lead.phone, campaign.template);

      await saveMessage({
        leadId,
        direction: 'OUTBOUND',
        body: campaign.template,
        waMessageId: messageId,
        status: 'SENT',
        campaignId: campaign.id
      });

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'COMPLETED' }
      });

      logger.info('Follow-up sent', { leadId, phone: lead.phone });
    } catch (err) {
      logger.error('Follow-up send failed', { leadId, error: err.message });
    }
  }
}

module.exports = { scheduleFollowUp, processDueFollowUps };