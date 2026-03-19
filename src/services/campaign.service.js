const { prisma } = require('../db');
const { sendTextMessage } = require('./whatsapp.service');
const { personalizeMessage } = require('./ai.service');
const { saveMessage } = require('./message.service');
const { campaignLimiter } = require('../utils/rateLimiter');
const logger = require('../utils/logger');

/**
 * Send a campaign to a list of leads
 * Rate limited to avoid WhatsApp bans
 */
async function runCampaign(campaignId, leads) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');

  logger.info('Campaign starting', { campaignId, totalLeads: leads.length });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'RUNNING' }
  });

  let sent = 0;
  let failed = 0;

  for (const lead of leads) {
    await campaignLimiter.throttle(async () => {
      try {
        // AI personalize each message
        const personalizedMessage = await personalizeMessage(
          campaign.template,
          lead
        );

        const { messageId } = await sendTextMessage(lead.phone, personalizedMessage);

        await saveMessage({
          leadId: lead.id,
          direction: 'OUTBOUND',
          body: personalizedMessage,
          waMessageId: messageId,
          status: 'SENT',
          campaignId
        });

        // Update lead status to CONTACTED
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: 'CONTACTED' }
        });

        sent++;
        logger.info('Campaign message sent', { phone: lead.phone, sent, total: leads.length });
      } catch (err) {
        failed++;
        logger.error('Campaign message failed', { phone: lead.phone, error: err.message });
      }
    });
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'COMPLETED' }
  });

  logger.info('Campaign completed', { campaignId, sent, failed });
  return { sent, failed };
}

/**
 * Upload leads from a CSV/array and attach to campaign
 */
async function importLeads(leadsArray) {
  const results = { created: 0, skipped: 0, errors: 0 };

  for (const row of leadsArray) {
    try {
      await prisma.lead.upsert({
        where: { phone: row.phone },
        update: { name: row.name || undefined },
        create: {
          phone: row.phone,
          name: row.name || null,
          email: row.email || null,
          status: 'NEW',
          tag: 'COLD'
        }
      });
      results.created++;
    } catch (err) {
      results.errors++;
      logger.warn('Lead import error', { phone: row.phone, error: err.message });
    }
  }

  return results;
}

module.exports = { runCampaign, importLeads };