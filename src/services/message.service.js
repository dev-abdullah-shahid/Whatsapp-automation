const { prisma } = require('../db');
const logger = require('../utils/logger');

async function saveMessage({ leadId, direction, body, waMessageId, status = 'SENT', campaignId }) {
  try {
    // Use upsert to handle duplicate waMessageId gracefully
    return await prisma.message.upsert({
      where: { waMessageId: waMessageId || `no-id-${Date.now()}` },
      update: { status },
      create: {
        leadId,
        direction,
        body,
        waMessageId: waMessageId || `no-id-${Date.now()}`,
        status,
        campaignId: campaignId || null
      }
    });
  } catch (err) {
    logger.error('saveMessage error', { error: err.message, leadId });
    throw err;
  }
}

async function updateMessageStatus(waMessageId, status) {
  if (!waMessageId) return;

  const updateData = { status };
  if (status === 'DELIVERED') updateData.deliveredAt = new Date();
  if (status === 'READ') updateData.readAt = new Date();

  try {
    return await prisma.message.update({
      where: { waMessageId },
      data: updateData
    });
  } catch (err) {
    logger.warn('updateMessageStatus — message not found', { waMessageId, status });
  }
}

async function getMessagesByLead(leadId) {
  return prisma.message.findMany({
    where: { leadId },
    orderBy: { sentAt: 'asc' }
  });
}

async function getLastInboundMessage(leadId) {
  return prisma.message.findFirst({
    where: { leadId, direction: 'INBOUND' },
    orderBy: { sentAt: 'desc' }
  });
}

module.exports = {
  saveMessage,
  updateMessageStatus,
  getMessagesByLead,
  getLastInboundMessage
};