const { sendTextMessage } = require('../services/whatsapp.service');
const { saveMessage } = require('../services/message.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function sendMessage(req, res) {
  try {
    const { phone, message, leadId } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'phone and message are required' });
    }

    const { messageId } = await sendTextMessage(phone, message);

    if (leadId) {
      await saveMessage({
        leadId,
        direction: 'OUTBOUND',
        body: message,
        waMessageId: messageId,
        status: 'SENT'
      });
    }

    res.json({ success: true, data: { messageId } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getMessagesByLead(req, res) {
  try {
    const messages = await prisma.message.findMany({
      where: { leadId: req.params.leadId },
      orderBy: { sentAt: 'asc' }
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { sendMessage, getMessagesByLead };