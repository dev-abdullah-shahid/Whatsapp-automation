const { prisma } = require('../db');

class Message {
  static async create({ leadId, direction, body, waMessageId, status = 'SENT', campaignId }) {
    return prisma.message.create({
      data: { leadId, direction, body, waMessageId, status, campaignId }
    });
  }

  static async findByLeadId(leadId) {
    return prisma.message.findMany({
      where: { leadId },
      orderBy: { sentAt: 'asc' }
    });
  }

  static async findByWaMessageId(waMessageId) {
    return prisma.message.findUnique({ where: { waMessageId } });
  }

  static async updateStatus(waMessageId, status) {
    const updateData = { status };
    if (status === 'DELIVERED') updateData.deliveredAt = new Date();
    if (status === 'READ') updateData.readAt = new Date();

    return prisma.message.update({
      where: { waMessageId },
      data: updateData
    });
  }

  static async findByCampaignId(campaignId) {
    return prisma.message.findMany({ where: { campaignId } });
  }

  static async getStats(campaignId) {
    const messages = await this.findByCampaignId(campaignId);
    return {
      total: messages.length,
      sent: messages.filter(m => m.status === 'SENT').length,
      delivered: messages.filter(m => m.status === 'DELIVERED').length,
      read: messages.filter(m => m.status === 'READ').length,
      failed: messages.filter(m => m.status === 'FAILED').length
    };
  }
}

module.exports = Message;