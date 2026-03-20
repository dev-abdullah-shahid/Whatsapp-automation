const { prisma } = require('../db');
const logger = require('../utils/logger');

// ─── Save Message ─────────────────────────────────────────────────────────────

async function saveMessage({ leadId, direction, body, waMessageId, status = 'SENT', campaignId }) {
  try {
    return await prisma.message.upsert({
      where: { waMessageId: waMessageId || `no-id-${Date.now()}` },
      update: { status },
      create: {
        leadId,
        direction,
        body,
        waMessageId,
        status,
        campaignId: campaignId || null
      }
    });
  } catch (err) {
    logger.error('saveMessage error', { error: err.message, leadId });
    throw err;
  }
}

// ─── Update Message Status ────────────────────────────────────────────────────

async function updateMessageStatus(waMessageId, status) {
  if (!waMessageId) return;

  const updateData = { status };
  if (status === 'DELIVERED') updateData.deliveredAt = new Date();
  if (status === 'READ')      updateData.readAt      = new Date();

  try {
    const message = await prisma.message.update({
      where: { waMessageId },
      data: updateData
    });

    // If this message belongs to a campaign, log the tracking event
    if (message.campaignId) {
      logger.info('Campaign message status updated', {
        campaignId: message.campaignId,
        waMessageId,
        status
      });
    }

    return message;
  } catch (err) {
    logger.warn('updateMessageStatus — not found', { waMessageId, status });
  }
}

// ─── Get Messages By Lead ─────────────────────────────────────────────────────

async function getMessagesByLead(leadId) {
  return prisma.message.findMany({
    where: { leadId },
    orderBy: { sentAt: 'asc' }
  });
}

// ─── Get Last Inbound Message ─────────────────────────────────────────────────

async function getLastInboundMessage(leadId) {
  return prisma.message.findFirst({
    where: { leadId, direction: 'INBOUND' },
    orderBy: { sentAt: 'desc' }
  });
}

// ─── Get Campaign Messages with full tracking ─────────────────────────────────

async function getCampaignMessages(campaignId, { limit = 50, offset = 0 } = {}) {
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { campaignId },
      orderBy: { sentAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        lead: {
          select: { name: true, phone: true, tag: true, status: true }
        }
      }
    }),
    prisma.message.count({ where: { campaignId } })
  ]);

  return { messages, total };
}

module.exports = {
  saveMessage,
  updateMessageStatus,
  getMessagesByLead,
  getLastInboundMessage,
  getCampaignMessages
};