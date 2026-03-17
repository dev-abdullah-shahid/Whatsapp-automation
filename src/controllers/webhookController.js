const {
  parseWebhookPayload,
  verifyWebhookChallenge,
  sendTextMessage,
  markAsRead,
  sendTypingIndicator
} = require('../services/whatsapp.service');

const { findOrCreateLead } = require('../services/lead.service');
const { saveMessage, updateMessageStatus } = require('../services/message.service');
const logger = require('../utils/logger');

/**
 * GET /webhook/whatsapp
 * Meta calls this once to verify your webhook URL is real.
 */
async function verifyWebhook(req, res) {
  const { valid, challenge } = verifyWebhookChallenge(req.query);

  if (valid) {
    logger.info('Webhook verified by Meta');
    return res.status(200).send(challenge);
  }

  logger.warn('Webhook verification failed', { query: req.query });
  return res.status(403).json({ error: 'Verification failed' });
}

/**
 * POST /webhook/whatsapp
 * Meta sends all events here — inbound messages + status updates.
 */
async function receiveWebhook(req, res) {
  // Meta requires a 200 response within 20 seconds or it retries
  // Always respond 200 immediately, process asynchronously
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
      logger.error('Error processing webhook event', {
        eventType: event.type,
        waMessageId: event.waMessageId,
        error: err.message
      });
    }
  }
}

// ─── Internal handlers ────────────────────────────────────────────────────────

async function handleInboundMessage(event) {
  const { from, name, waMessageId, text, messageType, timestamp } = event;

  logger.info('Inbound message', { from, messageType, text: text?.substring(0, 50) });

  // Mark as read immediately (shows blue ticks to user)
  await markAsRead(waMessageId);

  // Only handle text messages for now (Phase 3 will add media)
  if (messageType !== 'text' || !text) {
    logger.info('Non-text message received, skipping', { messageType, from });
    return;
  }

  // 1. Find or create lead
  const lead = await findOrCreateLead({ phone: from, name });

  // 2. Save inbound message
  await saveMessage({
    leadId: lead.id,
    direction: 'INBOUND',
    body: text,
    waMessageId,
    status: 'DELIVERED'
  });

  // 3. Send typing indicator (cosmetic — fires read receipt)
  await sendTypingIndicator(waMessageId);

  // 4. TODO Phase 3: AI reply engine goes here
  // For now: simple acknowledgment
  const replyBody = buildAcknowledgement(lead.name);
  const { messageId } = await sendTextMessage(from, replyBody);

  // 5. Save outbound message
  await saveMessage({
    leadId: lead.id,
    direction: 'OUTBOUND',
    body: replyBody,
    waMessageId: messageId,
    status: 'SENT'
  });
}

async function handleStatusUpdate(event) {
  const { waMessageId, status, errorCode, errorMessage } = event;

  logger.info('Status update', { waMessageId, status });

  if (errorCode) {
    logger.error('Message delivery error', { waMessageId, errorCode, errorMessage });
  }

  await updateMessageStatus(waMessageId, status);
}

function buildAcknowledgement(name) {
  const greeting = name ? `Hi ${name}!` : 'Hello!';
  return `${greeting} 👋 Thanks for reaching out. I'll get back to you in just a moment.`;
}

module.exports = { verifyWebhook, receiveWebhook };