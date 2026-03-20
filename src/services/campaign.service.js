const { prisma } = require('../db');
const { sendTextMessage } = require('./whatsapp.service');
const { personalizeMessage } = require('./ai.service');
const { saveMessage } = require('./message.service');
const { campaignLimiter } = require('../utils/rateLimiter');
const logger = require('../utils/logger');

// ─── Run Campaign ─────────────────────────────────────────────────────────────

async function runCampaign(campaignId) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'COMPLETED') throw new Error('Campaign already completed');

  // Get all leads attached to this campaign
  const leads = await prisma.lead.findMany({
    where: {
      metadata: {
        path: ['campaignId'],
        equals: campaignId
      }
    }
  });

  if (leads.length === 0) {
    throw new Error('No leads found for this campaign');
  }

  logger.info('Campaign starting', {
    campaignId,
    name: campaign.name,
    totalLeads: leads.length
  });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'RUNNING' }
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const lead of leads) {
    // Check if campaign was paused mid-run
    const currentCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true }
    });

    if (currentCampaign.status === 'PAUSED') {
      logger.info('Campaign paused mid-run', { campaignId, sent, remaining: leads.length - sent - failed });
      return { sent, failed, skipped, status: 'PAUSED' };
    }

    await campaignLimiter.throttle(async () => {
      try {
        // Check if already messaged this lead in this campaign
        const alreadySent = await prisma.message.findFirst({
          where: { leadId: lead.id, campaignId }
        });

        if (alreadySent) {
          skipped++;
          return;
        }

        // AI personalize the message
        let personalizedMsg = campaign.template;
        try {
          personalizedMsg = await personalizeMessage(campaign.template, lead);
        } catch (e) {
          // Fallback to simple name replacement if AI fails
          personalizedMsg = campaign.template.replace('{name}', lead.name || 'there');
        }

        // Send via WhatsApp
        const { messageId } = await sendTextMessage(lead.phone, personalizedMsg);

        // Save message record
        await saveMessage({
          leadId: lead.id,
          direction: 'OUTBOUND',
          body: personalizedMsg,
          waMessageId: messageId,
          status: 'SENT',
          campaignId
        });

        // Update lead status
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: 'CONTACTED' }
        });

        sent++;
        logger.info('Campaign message sent', {
          phone: lead.phone,
          sent,
          total: leads.length
        });
      } catch (err) {
        failed++;
        logger.error('Campaign message failed', {
          phone: lead.phone,
          error: err.message
        });
      }
    });
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'COMPLETED' }
  });

  logger.info('Campaign completed', { campaignId, sent, failed, skipped });
  return { sent, failed, skipped, status: 'COMPLETED' };
}

// ─── Import Leads from Array ──────────────────────────────────────────────────

async function importLeadsForCampaign(leadsArray, campaignId) {
  const results = { created: 0, existing: 0, errors: 0, leads: [] };

  for (const row of leadsArray) {
    if (!row.phone) continue;

    // Clean phone number — remove spaces, dashes, +
    const phone = row.phone.toString().replace(/[\s\-\+\(\)]/g, '');

    try {
      const lead = await prisma.lead.upsert({
        where: { phone },
        update: {
          name: row.name || undefined,
          metadata: {
            campaignId,
            importedAt: new Date().toISOString()
          }
        },
        create: {
          phone,
          name:   row.name  || null,
          email:  row.email || null,
          status: 'NEW',
          tag:    'COLD',
          metadata: {
            campaignId,
            importedAt: new Date().toISOString(),
            source: row.source || 'campaign_import'
          }
        }
      });

      results.leads.push(lead);

      if (lead.createdAt === lead.updatedAt) {
        results.created++;
      } else {
        results.existing++;
      }
    } catch (err) {
      results.errors++;
      logger.warn('Lead import error', { phone, error: err.message });
    }
  }

  logger.info('Leads imported for campaign', {
    campaignId,
    created: results.created,
    existing: results.existing,
    errors: results.errors
  });

  return results;
}

// ─── Get Campaign Stats ───────────────────────────────────────────────────────

async function getCampaignStats(campaignId) {
  const messages = await prisma.message.findMany({
    where: { campaignId }
  });

  const stats = {
    total:     messages.length,
    sent:      messages.filter(m => ['SENT','DELIVERED','READ'].includes(m.status)).length,
    delivered: messages.filter(m => ['DELIVERED','READ'].includes(m.status)).length,
    read:      messages.filter(m => m.status === 'READ').length,
    failed:    messages.filter(m => m.status === 'FAILED').length
  };

  stats.deliveryRate  = stats.total > 0 ? ((stats.delivered / stats.total) * 100).toFixed(1) + '%' : '0%';
  stats.readRate      = stats.total > 0 ? ((stats.read      / stats.total) * 100).toFixed(1) + '%' : '0%';

  // Count replies (inbound messages from campaign leads)
  const campaignLeadIds = [...new Set(messages.map(m => m.leadId))];
  const replies = await prisma.message.count({
    where: {
      leadId:    { in: campaignLeadIds },
      direction: 'INBOUND',
      sentAt:    { gte: messages[0]?.sentAt || new Date() }
    }
  });

  stats.replies     = replies;
  stats.replyRate   = stats.total > 0 ? ((replies / stats.total) * 100).toFixed(1) + '%' : '0%';

  return stats;
}

module.exports = { runCampaign, importLeadsForCampaign, getCampaignStats };