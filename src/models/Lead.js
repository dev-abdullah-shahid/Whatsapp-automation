const { prisma } = require('../db');

class Lead {
  static async findById(id) {
    return prisma.lead.findUnique({
      where: { id },
      include: { messages: true, conversation: true }
    });
  }

  static async findByPhone(phone) {
    return prisma.lead.findUnique({ where: { phone } });
  }

  static async findAll({ tag, status, limit = 50, offset = 0 } = {}) {
    const where = {};
    if (tag) where.tag = tag;
    if (status) where.status = status;

    return prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { _count: { select: { messages: true } } }
    });
  }

  static async create({ phone, name, email, tag = 'COLD', status = 'NEW', metadata }) {
    return prisma.lead.create({
      data: { phone, name, email, tag, status, metadata }
    });
  }

  static async update(id, data) {
    return prisma.lead.update({ where: { id }, data });
  }

  static async delete(id) {
    return prisma.lead.delete({ where: { id } });
  }

  static async findOrCreate({ phone, name }) {
    let lead = await this.findByPhone(phone);
    if (!lead) {
      lead = await this.create({ phone, name });
    }
    return lead;
  }

  static async updateTag(id, tag) {
    return prisma.lead.update({ where: { id }, data: { tag } });
  }

  static async updateStatus(id, status) {
    return prisma.lead.update({ where: { id }, data: { status } });
  }

  static async count(where = {}) {
    return prisma.lead.count({ where });
  }
}

module.exports = Lead;