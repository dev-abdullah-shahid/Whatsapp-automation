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
const { prisma } = require('../db');
const logger = require('../utils/logger');

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
  // Always respond 200 immediately — Meta retries if it doesn't get this
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
        error: err.message,
        stack: err.stack
      });
    }
  }
}

// ─── Inbound Message Handler ──────────────────────────────────────────────────

async function handleInboundMessage(event) {
  const { from, name, waMessageId, text, messageType } = event;

  logger.info('Inbound message', { from, messageType, preview: text?.substring(0, 40) });

  // 1. Mark message as read (shows blue ticks)
  await markAsRead(waMessageId);

  // Only handle text messages (Phase 3 scope)
  if (messageType !== 'text' || !text?.trim()) {
    logger.info('Non-text message — skipping AI', { messageType });
    return;
  }

  // 2. Find or create lead
  const lead = await findOrCreateLead({ phone: from, name });

  // 3. Save inbound message to DB
  await saveMessage({
    leadId: lead.id,
    direction: 'INBOUND',
    body: text,
    waMessageId,
    status: 'DELIVERED'
  });

  // 4. Update lead status to CONTACTED if still NEW
  if (lead.status === 'NEW') {
    await updateLeadStatus(lead.id, 'CONTACTED');
  }

  // 5. Load conversation history from DB
  const conversationHistory = await getConversationHistory(lead.id);

  // 6. Send typing indicator (cosmetic)
  await sendTypingIndicator(waMessageId);

  // 7. Generate AI reply
  const { reply, leadData } = await generateReply(
    text,
    conversationHistory,
    { name: lead.name, phone: lead.phone, tag: lead.tag }
  );

  // 8. Update lead based on AI analysis
  if (leadData) {
    await processLeadData(lead.id, leadData);
  }

  // 9. Save conversation turn to DB
  await saveConversationTurn(lead.id, text, reply);

  // 10. Send AI reply to customer
  const { messageId } = await sendTextMessage(from, reply);

  // 11. Save outbound message to DB
  await saveMessage({
    leadId: lead.id,
    direction: 'OUTBOUND',
    body: reply,
    waMessageId: messageId,
    status: 'SENT'
  });

  logger.info('AI reply sent', { to: from, tag: leadData?.tag });
}

// ─── Status Update Handler ────────────────────────────────────────────────────

async function handleStatusUpdate(event) {
  const { waMessageId, status, errorCode, errorMessage } = event;

  logger.info('Status update', { waMessageId, status });

  if (errorCode) {
    logger.error('Message error from Meta', { waMessageId, errorCode, errorMessage });
  }

  await updateMessageStatus(waMessageId, status);
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Load last 10 messages for this lead as OpenAI-format history
 */
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

/**
 * Save both sides of conversation turn to Conversation table
 */
async function saveConversationTurn(leadId, userMessage, assistantReply) {
  const existing = await prisma.conversation.findUnique({ where: { leadId } });
  const context = existing?.context || [];

  const updated = [
    ...context,
    { role: 'user', content: userMessage, ts: new Date().toISOString() },
    { role: 'assistant', content: assistantReply, ts: new Date().toISOString() }
  ].slice(-20); // Keep last 20 turns

  await prisma.conversation.upsert({
    where: { leadId },
    update: { context: updated, lastActivity: new Date() },
    create: { leadId, context: updated }
  });
}

/**
 * Apply AI-extracted lead data to the lead record
 */
async function processLeadData(leadId, leadData) {
  try {
    const updates = {};

    // Update tag if AI detected a change
    if (leadData.tag && ['HOT', 'WARM', 'COLD'].includes(leadData.tag)) {
      await updateLeadTag(leadId, leadData.tag);
    }

    // Update name if AI extracted it and we don't have it
    if (leadData.extractedName) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!lead.name) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { name: leadData.extractedName }
        });
      }
    }

    // Update email if extracted
    if (leadData.extractedEmail) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { email: leadData.extractedEmail }
      });
    }

    // Save intent to metadata
    if (leadData.intent) {
      await updateLeadMetadata(leadId, {
        lastIntent: leadData.intent,
        lastAiConfidence: leadData.confidence,
        lastActivityAt: new Date().toISOString()
      });
    }
  } catch (err) {
    logger.error('processLeadData error', { leadId, error: err.message });
  }
}

module.exports = { verifyWebhook, receiveWebhook };