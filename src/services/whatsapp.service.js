const axios = require('axios');
const logger = require('../utils/logger');

// Base URL for all Meta Graph API calls
const META_API_BASE = `https://graph.facebook.com/${process.env.META_API_VERSION}`;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

// Axios instance with auth header pre-set
const metaClient = axios.create({
  baseURL: META_API_BASE,
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// ─── Sending ──────────────────────────────────────────────────────────────────

/**
 * Send a plain text WhatsApp message
 * @param {string} to  - Phone in E.164 format e.g. 923001234567 (no +)
 * @param {string} text - Message body
 */
async function sendTextMessage(to, text) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: text
      }
    };

    const { data } = await metaClient.post(`/${PHONE_NUMBER_ID}/messages`, payload);

    logger.info('Message sent via Meta', {
      to,
      messageId: data.messages?.[0]?.id,
      status: data.messages?.[0]?.message_status
    });

    return {
      messageId: data.messages?.[0]?.id,
      status: 'SENT'
    };
  } catch (error) {
    const errDetail = error.response?.data?.error || error.message;
    logger.error('Failed to send Meta WhatsApp message', { to, error: errDetail });
    throw new Error(`WhatsApp send failed: ${JSON.stringify(errDetail)}`);
  }
}

/**
 * Send a template message (required for first outreach / 24hr window expired)
 * @param {string} to
 * @param {string} templateName  - Must be approved in Meta Business Manager
 * @param {string} languageCode  - e.g. 'en_US'
 * @param {Array}  components    - Template variable substitutions
 */
async function sendTemplateMessage(to, templateName, languageCode = 'en_US', components = []) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components
      }
    };

    const { data } = await metaClient.post(`/${PHONE_NUMBER_ID}/messages`, payload);

    logger.info('Template message sent', { to, templateName, messageId: data.messages?.[0]?.id });

    return {
      messageId: data.messages?.[0]?.id,
      status: 'SENT'
    };
  } catch (error) {
    const errDetail = error.response?.data?.error || error.message;
    logger.error('Failed to send template message', { to, templateName, error: errDetail });
    throw new Error(`Template send failed: ${JSON.stringify(errDetail)}`);
  }
}

/**
 * Mark a message as read (shows double blue ticks)
 * @param {string} waMessageId - The message ID from Meta
 */
async function markAsRead(waMessageId) {
  try {
    await metaClient.post(`/${PHONE_NUMBER_ID}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: waMessageId
    });
  } catch (error) {
    // Non-critical — log and continue
    logger.warn('Could not mark message as read', { waMessageId, error: error.message });
  }
}

/**
 * Send a "typing..." indicator to the user
 * Implemented by sending a read receipt (Meta doesn't have a separate typing API)
 */
async function sendTypingIndicator(waMessageId) {
  return markAsRead(waMessageId);
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parse the full Meta webhook payload into a clean array of events.
 * Meta batches multiple events in one webhook call.
 *
 * Returns array of objects shaped as:
 * {
 *   type: 'message' | 'status',
 *   from, text, waMessageId, name,      // for type='message'
 *   waMessageId, status, timestamp      // for type='status'
 * }
 */
function parseWebhookPayload(body) {
  const events = [];

  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) return events;

    // ── Inbound messages ──────────────────────────────────────────────────
    if (value.messages && value.messages.length > 0) {
      for (const msg of value.messages) {
        const contact = value.contacts?.find(c => c.wa_id === msg.from);

        events.push({
          type: 'message',
          from: msg.from,               // e.g. "923001234567"
          name: contact?.profile?.name || null,
          waMessageId: msg.id,
          timestamp: new Date(parseInt(msg.timestamp, 10) * 1000),
          messageType: msg.type,        // 'text', 'image', 'audio', etc.
          text: msg.type === 'text' ? msg.text?.body : null,
          media: msg.type !== 'text' ? {
            type: msg.type,
            id: msg[msg.type]?.id,
            mimeType: msg[msg.type]?.mime_type,
            caption: msg[msg.type]?.caption
          } : null
        });
      }
    }

    // ── Delivery / read status updates ────────────────────────────────────
    if (value.statuses && value.statuses.length > 0) {
      for (const s of value.statuses) {
        events.push({
          type: 'status',
          waMessageId: s.id,
          status: s.status.toUpperCase(),  // 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
          timestamp: new Date(parseInt(s.timestamp, 10) * 1000),
          errorCode: s.errors?.[0]?.code || null,
          errorMessage: s.errors?.[0]?.message || null
        });
      }
    }
  } catch (err) {
    logger.error('Error parsing Meta webhook payload', { error: err.message });
  }

  return events;
}

/**
 * Verify Meta's webhook verification handshake
 * Called once when you register the webhook URL in Meta dashboard
 */
function verifyWebhookChallenge(query) {
  const {
    'hub.mode': mode,
    'hub.verify_token': token,
    'hub.challenge': challenge
  } = query;

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return { valid: true, challenge };
  }

  return { valid: false };
}

module.exports = {
  sendTextMessage,
  sendTemplateMessage,
  markAsRead,
  sendTypingIndicator,
  parseWebhookPayload,
  verifyWebhookChallenge
};