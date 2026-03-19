const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a friendly, professional sales assistant for a business on WhatsApp.

Your goals:
1. Welcome the customer warmly and make them feel heard
2. Ask questions to understand their needs (what product/service they want, budget, timeline)
3. Qualify the lead by detecting interest level
4. Guide them toward making a purchase or booking
5. Keep responses SHORT (2-3 sentences max) — this is WhatsApp, not email
6. Sound human, never robotic. Use casual but professional tone.
7. Never mention you are an AI unless directly asked

Lead qualification rules:
- HOT lead: Ready to buy, asking about price/availability, urgent need
- WARM lead: Interested but has questions, comparing options
- COLD lead: Just browsing, no clear intent yet

At the end of EVERY response, add a hidden JSON tag on a new line:
[LEAD_DATA:{"tag":"HOT|WARM|COLD","intent":"brief description","name":"if mentioned","email":"if mentioned"}]`;

/**
 * Generate an AI reply for an inbound message
 * @param {string} userMessage - The customer's message
 * @param {Array} conversationHistory - Previous messages [{role, content}]
 * @param {Object} leadInfo - Known info about the lead
 */
async function generateReply(userMessage, conversationHistory = [], leadInfo = {}) {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: userMessage }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 300,
      temperature: 0.7  // Slightly creative but consistent
    });

    const fullResponse = response.choices[0].message.content;

    // Extract hidden lead data tag
    const leadDataMatch = fullResponse.match(/\[LEAD_DATA:(.*?)\]/s);
    let leadData = null;

    if (leadDataMatch) {
      try {
        leadData = JSON.parse(leadDataMatch[1]);
      } catch (e) {
        logger.warn('Could not parse lead data from AI response');
      }
    }

    // Clean response (remove the hidden tag before sending to user)
    const cleanReply = fullResponse
      .replace(/\[LEAD_DATA:.*?\]/s, '')
      .trim();

    logger.info('AI reply generated', {
      tokens: response.usage?.total_tokens,
      leadTag: leadData?.tag
    });

    return { reply: cleanReply, leadData };
  } catch (error) {
    logger.error('OpenAI API error', { error: error.message });
    // Fallback reply so customer always gets a response
    return {
      reply: "Thanks for your message! I'll get back to you shortly. 😊",
      leadData: null
    };
  }
}

/**
 * Personalize a bulk outreach message for a specific lead
 * @param {string} template - Message template with {name}, {product} placeholders
 * @param {Object} lead - Lead data
 */
async function personalizeMessage(template, lead) {
  try {
    const prompt = `Personalize this WhatsApp message for a specific person.

Template: "${template}"

Person details:
- Name: ${lead.name || 'Unknown'}
- Previous interaction: ${lead.metadata?.lastIntent || 'None'}

Rules:
- Keep it under 150 words
- Sound personal and genuine, not like a mass message
- Keep the core message but make it feel tailored
- Only return the final message, nothing else`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.8
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Personalization error', { error: error.message });
    // Fall back to simple name replacement
    return template.replace('{name}', lead.name || 'there');
  }
}

/**
 * Detect intent from a message (used for quick classification)
 */
async function detectIntent(message) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Classify this WhatsApp message intent in one word:
"${message}"
Options: greeting, inquiry, pricing, complaint, purchase, support, spam, other
Reply with just the single word.`
      }],
      max_tokens: 10,
      temperature: 0
    });

    return response.choices[0].message.content.trim().toLowerCase();
  } catch (error) {
    return 'other';
  }
}

module.exports = { generateReply, personalizeMessage, detectIntent };