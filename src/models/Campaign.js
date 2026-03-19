const { prisma } = require('../db');

class Campaign {
  static async create({ name, template, settings, scheduledAt }) {
    return prisma.campaign.create({
      data: { name, template, settings, scheduledAt }
    });
  }

  static async findById(id) {
    return prisma.campaign.findUnique({
      where: { id },
      include: { _count: { select: { messages: true } } }
    });
  }

  static async findAll() {
    return prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { messages: true } } }
    });
  }

  static async updateStatus(id, status) {
    return prisma.campaign.update({ where: { id }, data: { status } });
  }

  static async update(id, data) {
    return prisma.campaign.update({ where: { id }, data });
  }
}

module.exports = Campaign;