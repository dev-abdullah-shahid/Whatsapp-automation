const { extractLeadInfo } = require('./ai.service');
const { prisma } = require('../db');
const logger = require('../utils/logger');

/**
 * Full lead capture pipeline — runs after every inbound message
 * Progressively builds the lead profile from conversation
 */
async function captureLeadData(leadId, conversationHistory) {
  try {
    // Only run extraction every 2nd message to save OpenAI costs
    if (conversationHistory.length % 2 !== 0) return null;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return null;

    // Extract structured data from full conversation
    const extracted = await extractLeadInfo(conversationHistory, lead);
    if (!extracted) return null;

    // Build update object — only update fields we extracted
    const updates = {};
    const metadataUpdates = { ...lead.metadata };

    // Update name if we learned it
    if (extracted.name && !lead.name) {
      updates.name = extracted.name;
    }

    // Update email if we learned it
    if (extracted.email && !lead.email) {
      updates.email = extracted.email;
    }

    // Update tag (HOT/WARM/COLD)
    if (extracted.tag) {
      updates.tag = extracted.tag;
    }

    // Update status if qualification improved
    if (extracted.status && shouldUpgradeStatus(lead.status, extracted.status)) {
      updates.status = extracted.status;
    }

    // Store rich data in metadata
    if (extracted.budget)            metadataUpdates.budget = extracted.budget;
    if (extracted.product)           metadataUpdates.product = extracted.product;
    if (extracted.timeline)          metadataUpdates.timeline = extracted.timeline;
    if (extracted.useCase)           metadataUpdates.useCase = extracted.useCase;
    if (extracted.painPoint)         metadataUpdates.painPoint = extracted.painPoint;
    if (extracted.notes)             metadataUpdates.notes = extracted.notes;
    if (extracted.qualificationScore !== undefined) {
      metadataUpdates.qualificationScore = extracted.qualificationScore;
    }

    metadataUpdates.lastUpdated = new Date().toISOString();
    updates.metadata = metadataUpdates;

    // Save all updates in one DB call
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: updates
    });

    logger.info('Lead profile updated', {
      leadId,
      tag: updatedLead.tag,
      score: extracted.qualificationScore,
      name: updatedLead.name
    });

    return updatedLead;
  } catch (error) {
    logger.error('Lead capture error', { leadId, error: error.message });
    return null;
  }
}

/**
 * Only upgrade status, never downgrade
 * NEW → CONTACTED → QUALIFIED → CONVERTED
 */
function shouldUpgradeStatus(current, proposed) {
  const order = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED'];
  return order.indexOf(proposed) > order.indexOf(current);
}

/**
 * Calculate a lead score 0-100 based on profile completeness + intent
 */
function calculateLeadScore(lead) {
  let score = 0;

  // Profile completeness
  if (lead.name)              score += 10;
  if (lead.email)             score += 10;
  if (lead.metadata?.budget)  score += 15;
  if (lead.metadata?.product) score += 15;
  if (lead.metadata?.timeline)score += 10;
  if (lead.metadata?.useCase) score += 5;
  if (lead.metadata?.painPoint) score += 5;

  // Intent scoring
  if (lead.tag === 'HOT')  score += 30;
  if (lead.tag === 'WARM') score += 15;
  if (lead.tag === 'COLD') score += 0;

  return Math.min(score, 100);
}

/**
 * Get fully enriched lead with score
 */
async function getEnrichedLead(leadId) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      messages: { orderBy: { sentAt: 'desc' }, take: 5 },
      conversation: true
    }
  });

  if (!lead) return null;

  return {
    ...lead,
    qualificationScore: calculateLeadScore(lead),
    messageCount: lead.messages.length
  };
}

module.exports = { captureLeadData, calculateLeadScore, getEnrichedLead };