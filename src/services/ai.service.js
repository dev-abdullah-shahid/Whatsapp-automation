const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── System Prompt ────────────────────────────────────────────────────────────
// This is the brain of your AI sales agent.
// Customize this for your specific business.

const SYSTEM_PROMPT = `You are Sarah, a friendly and professional sales assistant on WhatsApp for a business.

YOUR PERSONALITY:
- Warm, genuine, and helpful — never robotic or salesy
- Concise — WhatsApp messages should be 1-3 sentences max
- Ask one question at a time to avoid overwhelming the customer
- Use emojis sparingly (1 per message max)
- Mirror the customer's tone (formal/casual)

YOUR GOALS (in order):
1. Greet warmly and make them feel welcome
2. Understand their specific need or problem
3. Ask about budget and timeline naturally
4. Present the right solution confidently
5. Handle objections with empathy
6. Guide toward a purchase or booking

QUALIFICATION QUESTIONS TO ASK (pick naturally based on context):
- "What are you looking for exactly?"
- "Is this for personal or business use?"
- "Do you have a budget in mind?"
- "When do you need this by?"
- "Have you tried anything similar before?"

RULES:
- Never mention you are an AI unless directly asked
- Never make up prices — say "I'll get you the exact pricing shortly"
- If asked something you don't know, say "Great question, let me check that for you"
- Never send more than 3 sentences per reply
- Always end with either a question OR a clear next step

LEAD SCORING — after every message assess the lead:
- HOT: mentions budget, asks about pricing/availability, urgent timeline, ready to decide
- WARM: interested, asking questions, comparing options, no urgency
- COLD: just browsing, vague interest, no clear need

At the END of every response add this hidden tag (user never sees it):
[META:{"tag":"HOT|WARM|COLD","intent":"one sentence","extractedName":"or null","extractedEmail":"or null","confidence":0.0-1.0}]`;

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Generate an AI reply for an inbound WhatsApp message
 *
 * @param {string} userMessage       - The customer's message
 * @param {Array}  conversationHistory - [{role:'user'|'assistant', content:'...'}]
 * @param {Object} leadInfo          - Known lead data {name, phone, tag}
 * @returns {Promise<{reply, leadData}>}
 */
async function generateReply(userMessage, conversationHistory = [], leadInfo = {}) {
  try {
    // Inject known lead info into system context
    const contextNote = leadInfo.name
      ? `\n\nKNOWN INFO: Customer's name is ${leadInfo.name}.`
      : '';

    const messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT + contextNote
      },
      // Include conversation history (last 10 messages max)
      ...conversationHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      })),
      {
        role: 'user',
        content: userMessage
      }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 300,
      temperature: 0.75
    });

    const fullResponse = response.choices[0].message.content;

    // Extract hidden metadata tag
    const metaMatch = fullResponse.match(/\[META:(.*?)\]/s);
    let leadData = null;

    if (metaMatch) {
      try {
        leadData = JSON.parse(metaMatch[1]);
      } catch (e) {
        logger.warn('Could not parse AI meta tag');
      }
    }

    // Remove hidden tag before sending to customer
    const cleanReply = fullResponse
      .replace(/\[META:.*?\]/s, '')
      .trim();

    logger.info('AI reply generated', {
      tokens: response.usage?.total_tokens,
      tag: leadData?.tag,
      intent: leadData?.intent
    });

    return { reply: cleanReply, leadData };
  } catch (error) {
    logger.error('OpenAI error', { error: error.message });

    // Always return a fallback so customer gets a response
    return {
      reply: "Thanks for your message! 😊 I'll get back to you in just a moment.",
      leadData: null
    };
  }
}

/**
 * Personalize a bulk outreach message for a specific lead using AI
 */
async function personalizeMessage(template, lead) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Personalize this WhatsApp message for this specific person.

Template: "${template}"

Person:
- Name: ${lead.name || 'Unknown'}
- Previous interest: ${lead.metadata?.lastIntent || 'none mentioned'}

Rules:
- Max 3 sentences
- Sound personal, not like a mass blast
- Keep the core offer intact
- Return ONLY the final message, nothing else`
      }],
      max_tokens: 200,
      temperature: 0.8
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Personalization error', { error: error.message });
    return template.replace('{name}', lead.name || 'there');
  }
}

/**
 * Detect intent from a single message (fast, cheap call)
 */
async function detectIntent(message) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Classify this WhatsApp message into exactly one intent word:
"${message}"

Options: greeting, inquiry, pricing, complaint, purchase, support, spam, other
Reply with just the single lowercase word.`
      }],
      max_tokens: 5,
      temperature: 0
    });

    return response.choices[0].message.content.trim().toLowerCase();
  } catch (error) {
    return 'other';
  }
}

module.exports = { generateReply, personalizeMessage, detectIntent };