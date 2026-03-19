const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Sarah, a friendly and professional sales assistant on WhatsApp.

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
- If asked something you don't know say "Great question, let me check that for you"
- Never send more than 3 sentences per reply
- Always end with either a question OR a clear next step

LEAD SCORING — assess after every message:
- HOT: mentions budget, asks about pricing/availability, urgent timeline, ready to decide
- WARM: interested, asking questions, comparing options, no urgency
- COLD: just browsing, vague interest, no clear need

At the END of every response add this hidden tag (user never sees it):
[META:{"tag":"HOT|WARM|COLD","intent":"one sentence","extractedName":"or null","extractedEmail":"or null","extractedBudget":"or null","extractedProduct":"or null","confidence":0.0-1.0}]`;

// ─── Generate Reply ───────────────────────────────────────────────────────────

async function generateReply(userMessage, conversationHistory = [], leadInfo = {}) {
  try {
    const contextNote = leadInfo.name
      ? `\n\nKNOWN INFO: Customer name is ${leadInfo.name}.`
      : '';

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + contextNote },
      ...conversationHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: userMessage }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 300,
      temperature: 0.75
    });

    const fullResponse = response.choices[0].message.content;

    // Extract hidden metadata
    const metaMatch = fullResponse.match(/\[META:(.*?)\]/s);
    let leadData = null;

    if (metaMatch) {
      try {
        leadData = JSON.parse(metaMatch[1]);
      } catch (e) {
        logger.warn('Could not parse AI meta tag');
      }
    }

    const cleanReply = fullResponse.replace(/\[META:.*?\]/s, '').trim();

    logger.info('AI reply generated', {
      tokens: response.usage?.total_tokens,
      tag: leadData?.tag,
      intent: leadData?.intent
    });

    return { reply: cleanReply, leadData };
  } catch (error) {
    logger.error('OpenAI error', { error: error.message });
    return {
      reply: "Thank you for reaching out! 👋 Our team has received your message and will get back to you within a few minutes. Please stay tuned!",
      leadData: null
    };
  }
}

// ─── Extract Lead Info ────────────────────────────────────────────────────────

/**
 * Deeply analyze full conversation to extract structured lead data
 * Called after every few messages to progressively build lead profile
 */
async function extractLeadInfo(conversationHistory, existingLead = {}) {
  try {
    const conversationText = conversationHistory
      .map(m => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Analyze this WhatsApp sales conversation and extract lead information.

CONVERSATION:
${conversationText}

Extract and return ONLY a JSON object with these fields:
{
  "name": "full name if mentioned, else null",
  "email": "email if mentioned, else null",
  "budget": "budget range if mentioned, else null",
  "product": "what product/service they want, else null",
  "timeline": "when they need it, else null",
  "useCase": "personal or business, else null",
  "painPoint": "their main problem or need, else null",
  "tag": "HOT or WARM or COLD based on buying intent",
  "qualificationScore": 0-100,
  "status": "NEW or CONTACTED or QUALIFIED or CONVERTED",
  "notes": "one sentence summary of this lead"
}

Rules:
- Only extract what is clearly stated, never guess
- qualificationScore: 0=no intent, 50=interested, 80=ready to buy, 100=confirmed purchase
- Return ONLY the JSON, no other text`
      }],
      max_tokens: 400,
      temperature: 0
    });

    const content = response.choices[0].message.content.trim();
    const cleaned = content.replace(/```json|```/g, '').trim();
    const extracted = JSON.parse(cleaned);

    logger.info('Lead info extracted', {
      name: extracted.name,
      tag: extracted.tag,
      score: extracted.qualificationScore
    });

    return extracted;
  } catch (error) {
    logger.error('Lead extraction error', { error: error.message });
    return null;
  }
}

// ─── Personalize Message ──────────────────────────────────────────────────────

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
- Interest: ${lead.metadata?.product || 'not specified'}
- Previous intent: ${lead.metadata?.lastIntent || 'none'}

Rules:
- Max 3 sentences
- Sound personal not like a mass message
- Keep the core offer intact
- Return ONLY the final message`
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

// ─── Detect Intent ────────────────────────────────────────────────────────────

async function detectIntent(message) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Classify this WhatsApp message intent in one word:
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

module.exports = {
  generateReply,
  extractLeadInfo,
  personalizeMessage,
  detectIntent
};