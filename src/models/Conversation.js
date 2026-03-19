const { prisma } = require('../db');

class Conversation {
  static async findByLeadId(leadId) {
    return prisma.conversation.findUnique({ where: { leadId } });
  }

  static async getContext(leadId) {
    const conv = await this.findByLeadId(leadId);
    return conv?.context || [];
  }

  // Add a message to conversation context (used by AI engine)
  static async appendMessage(leadId, role, content) {
    const existing = await this.findByLeadId(leadId);
    const context = existing?.context || [];

    const updated = [
      ...context,
      { role, content, timestamp: new Date().toISOString() }
    ];

    // Keep only last 20 messages to stay within OpenAI context limits
    const trimmed = updated.slice(-20);

    if (existing) {
      return prisma.conversation.update({
        where: { leadId },
        data: { context: trimmed, lastActivity: new Date() }
      });
    }

    return prisma.conversation.create({
      data: { leadId, context: trimmed }
    });
  }

  static async clearContext(leadId) {
    return prisma.conversation.upsert({
      where: { leadId },
      update: { context: [], lastActivity: new Date() },
      create: { leadId, context: [] }
    });
  }
}

module.exports = Conversation;