const {
  parseWebhookPayload,
  verifyWebhookChallenge,
  sendTextMessage,
  markAsRead,
  sendTypingIndicator
} = require('../services/whatsapp.service');

const { findOrCreateLead, updateLeadTag, updateLeadStatus, updateLeadMetadata } = require('../services/lead.service');
const { saveMessage, updateMessageStatus } = require('../services/message.service');
const { generateReply } = require('../services/ai.service');
const { captureLeadData } = require('../services/leadCapture.service');
const { prisma } = require('../db');
const logger = require('../utils/logger');
const { cancelEnrollment, autoEnrollNewLead } = require('../services/automation.service');

// ─── Webhook Verification ─────────────────────────────────────────────────────

async function verifyWebhook(req, res) {
  const { valid, challenge } = verifyWebhookChallenge(req.query);
  if (valid) {
    logger.info('Webhook verified by Meta');
    return res.status(200).send(challenge);
  }
  logger.warn('Webhook verification failed', { query: req.query });
  return res.status(403).json({ error: 'Verification failed' });
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────

async function receiveWebhook(req, res) {
  res.status(200).json({ status: 'ok' });

  const events = parseWebhookPayload(req.body);

  for (const event of events) {
    try {
      if (event.type === 'message') {
        await handleInboundMessage(event);
      } else if (event.type === 'status') {
        await handleStatusUpdate(event);
      }
    } catch (err) {
      logger.error('Webhook event error', {
        type: event.type,
        error: err.message
      });
    }
  }
}

// ─── Inbound Message Handler ──────────────────────────────────────────────────

async function handleInboundMessage(event) {
  const { from, name, waMessageId, text, messageType } = event;

  logger.info('Inbound message', {
    from,
    messageType,
    preview: text?.substring(0, 40)
  });

  await markAsRead(waMessageId);

  if (messageType !== 'text' || !text?.trim()) return;

  // 1. Find or create lead
  const lead = await findOrCreateLead({ phone: from, name });

  // 2. Save inbound message
try {
    await saveMessage({
      leadId:     lead.id,
      direction:  'INBOUND',
      body:       text,
      waMessageId: waMessageId,
      status:     'DELIVERED'
    });
    logger.info('Inbound message saved', { leadId: lead.id });
  } catch (err) {
    logger.error('Failed to save inbound message', { error: err.message });
  }


// 3. Cancel any active automations — lead replied
await cancelEnrollment(lead.id);

// 4. If brand new lead, auto-enroll in NEW_LEAD automations
if (lead.status === 'NEW') {
  await updateLeadStatus(lead.id, 'CONTACTED');
  autoEnrollNewLead(lead.id).catch(err =>
    logger.error('Auto enroll failed', { error: err.message })
  );
}
  // 4. Load conversation history
  const conversationHistory = await getConversationHistory(lead.id);

  // 5. Typing indicator
  await sendTypingIndicator(waMessageId);

  // 6. Generate AI reply
  const { reply, leadData } = await generateReply(
    text,
    conversationHistory,
    { name: lead.name, phone: lead.phone, tag: lead.tag }
  );

  // 7. Quick update from AI meta tag (fast)
  if (leadData) {
    await quickUpdateLead(lead.id, leadData);
  }

  // 8. Save conversation turn
  await saveConversationTurn(lead.id, text, reply);

  // 9. Deep lead capture (runs every 2nd message)
  const updatedHistory = [...conversationHistory,
    { role: 'user', content: text },
    { role: 'assistant', content: reply }
  ];
  captureLeadData(lead.id, updatedHistory).catch(err =>
    logger.error('Lead capture failed', { error: err.message })
  );

  // 10. Send reply
  const { messageId } = await sendTextMessage(from, reply);

  // 11. Save outbound message
  await saveMessage({
    leadId: lead.id,
    direction: 'OUTBOUND',
    body: reply,
    waMessageId: messageId,
    status: 'SENT'
  });

  logger.info('Reply sent', {
    to: from,
    tag: leadData?.tag,
    intent: leadData?.intent
  });
}

// ─── Status Update Handler ────────────────────────────────────────────────────

async function handleStatusUpdate(event) {
  const { waMessageId, status, errorCode, errorMessage } = event;
  logger.info('Status update', { waMessageId, status });
  if (errorCode) {
    logger.error('Meta delivery error', { waMessageId, errorCode, errorMessage });
  }
  await updateMessageStatus(waMessageId, status);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getConversationHistory(leadId) {
  const messages = await prisma.message.findMany({
    where: { leadId },
    orderBy: { sentAt: 'asc' },
    take: 10
  });

  return messages.map(m => ({
    role: m.direction === 'INBOUND' ? 'user' : 'assistant',
    content: m.body
  }));
}

async function saveConversationTurn(leadId, userMessage, assistantReply) {
  const existing = await prisma.conversation.findUnique({ where: { leadId } });
  const context = existing?.context || [];

  const updated = [
    ...context,
    { role: 'user', content: userMessage, ts: new Date().toISOString() },
    { role: 'assistant', content: assistantReply, ts: new Date().toISOString() }
  ].slice(-20);

  await prisma.conversation.upsert({
    where: { leadId },
    update: { context: updated, lastActivity: new Date() },
    create: { leadId, context: updated }
  });
}

async function quickUpdateLead(leadId, leadData) {
  try {
    const updates = {};

    if (leadData.tag) updates.tag = leadData.tag;
    if (leadData.extractedName) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!lead.name) updates.name = leadData.extractedName;
    }
    if (leadData.extractedEmail) updates.email = leadData.extractedEmail;

    if (Object.keys(updates).length > 0) {
      await prisma.lead.update({ where: { id: leadId }, data: updates });
    }

    if (leadData.intent) {
      await updateLeadMetadata(leadId, {
        lastIntent: leadData.intent,
        lastActivityAt: new Date().toISOString()
      });
    }
  } catch (err) {
    logger.error('quickUpdateLead error', { error: err.message });
  }
}

module.exports = { verifyWebhook, receiveWebhook };