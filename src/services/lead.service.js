const { prisma } = require('../db');
const logger = require('../utils/logger');

async function findOrCreateLead({ phone, name }) {
  try {
    let lead = await prisma.lead.findUnique({ where: { phone } });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          phone,
          name: name || null,
          status: 'NEW',
          tag: 'COLD'
        }
      });
      logger.info('New lead created', { phone, id: lead.id });
    }

    return lead;
  } catch (err) {
    logger.error('findOrCreateLead error', { error: err.message });
    throw err;
  }
}

async function getLeadWithHistory(leadId) {
  return prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      messages: { orderBy: { sentAt: 'asc' } },
      conversation: true
    }
  });
}

async function updateLeadTag(leadId, tag) {
  return prisma.lead.update({
    where: { id: leadId },
    data: { tag }
  });
}

async function updateLeadStatus(leadId, status) {
  return prisma.lead.update({
    where: { id: leadId },
    data: { status }
  });
}

async function updateLeadMetadata(leadId, metadata) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  const existing = lead?.metadata || {};

  return prisma.lead.update({
    where: { id: leadId },
    data: { metadata: { ...existing, ...metadata } }
  });
}

module.exports = {
  findOrCreateLead,
  getLeadWithHistory,
  updateLeadTag,
  updateLeadStatus,
  updateLeadMetadata
};