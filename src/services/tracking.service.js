const { prisma } = require('../db');
const logger = require('../utils/logger');

// ─── Get Full Campaign Report ─────────────────────────────────────────────────

async function getCampaignReport(campaignId) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign) throw new Error('Campaign not found');

  const messages = await prisma.message.findMany({
    where: { campaignId },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          tag: true,
          status: true,
          metadata: true
        }
      }
    }
  });

  // ── Delivery stats ──────────────────────────────────────────────────────────
  const total     = messages.length;
  const sent      = messages.filter(m => ['SENT','DELIVERED','READ'].includes(m.status)).length;
  const delivered = messages.filter(m => ['DELIVERED','READ'].includes(m.status)).length;
  const read      = messages.filter(m => m.status === 'READ').length;
  const failed    = messages.filter(m => m.status === 'FAILED').length;

  // ── Reply tracking ──────────────────────────────────────────────────────────
  const leadIds = [...new Set(messages.map(m => m.leadId))];

  const replies = await prisma.message.findMany({
    where: {
      leadId:    { in: leadIds },
      direction: 'INBOUND',
      sentAt:    { gte: campaign.createdAt }
    },
    include: {
      lead: { select: { name: true, phone: true, tag: true } }
    }
  });

  // ── Conversion tracking ─────────────────────────────────────────────────────
  const convertedLeads = await prisma.lead.findMany({
    where: {
      id:     { in: leadIds },
      status: 'CONVERTED'
    }
  });

  // ── Time-to-reply analysis ──────────────────────────────────────────────────
  const replyTimes = [];
  for (const reply of replies) {
    const outbound = messages.find(m => m.leadId === reply.leadId);
    if (outbound) {
      const diffMinutes = (reply.sentAt - outbound.sentAt) / 1000 / 60;
      replyTimes.push(Math.round(diffMinutes));
    }
  }

  const avgReplyTime = replyTimes.length > 0
    ? Math.round(replyTimes.reduce((a, b) => a + b, 0) / replyTimes.length)
    : null;

  // ── HOT leads generated ─────────────────────────────────────────────────────
  const hotLeads = await prisma.lead.count({
    where: { id: { in: leadIds }, tag: 'HOT' }
  });

  return {
    campaign: {
      id:        campaign.id,
      name:      campaign.name,
      status:    campaign.status,
      createdAt: campaign.createdAt
    },
    delivery: {
      total,
      sent,
      delivered,
      read,
      failed,
      deliveryRate:  total > 0 ? ((delivered / total) * 100).toFixed(1) + '%' : '0%',
      readRate:      total > 0 ? ((read      / total) * 100).toFixed(1) + '%' : '0%',
      failureRate:   total > 0 ? ((failed    / total) * 100).toFixed(1) + '%' : '0%'
    },
    engagement: {
      totalReplies:    replies.length,
      replyRate:       total > 0 ? ((replies.length / total) * 100).toFixed(1) + '%' : '0%',
      avgReplyMinutes: avgReplyTime,
      hotLeadsGenerated: hotLeads
    },
    conversion: {
      converted:       convertedLeads.length,
      conversionRate:  total > 0 ? ((convertedLeads.length / total) * 100).toFixed(1) + '%' : '0%'
    },
    timeline: buildTimeline(messages)
  };
}

// ─── Get Lead Journey ─────────────────────────────────────────────────────────

async function getLeadJourney(leadId) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      messages: { orderBy: { sentAt: 'asc' } },
      conversation: true,
      enrollments: {
        include: { automation: true }
      }
    }
  });

  if (!lead) throw new Error('Lead not found');

  // Build chronological timeline
  const events = [];

  // Lead created
  events.push({
    type:      'LEAD_CREATED',
    timestamp: lead.createdAt,
    data:      { phone: lead.phone, name: lead.name }
  });

  // All messages
  for (const msg of lead.messages) {
    events.push({
      type:      msg.direction === 'INBOUND' ? 'MESSAGE_RECEIVED' : 'MESSAGE_SENT',
      timestamp: msg.sentAt,
      data: {
        body:        msg.body.substring(0, 100),
        status:      msg.status,
        campaignId:  msg.campaignId,
        deliveredAt: msg.deliveredAt,
        readAt:      msg.readAt
      }
    });
  }

  // Automation enrollments
  for (const enrollment of lead.enrollments) {
    events.push({
      type:      'AUTOMATION_ENROLLED',
      timestamp: enrollment.enrolledAt,
      data: {
        automationName: enrollment.automation.name,
        status:         enrollment.status,
        currentStep:    enrollment.currentStep
      }
    });
  }

  // Sort by timestamp
  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return {
    lead: {
      id:                 lead.id,
      name:               lead.name,
      phone:              lead.phone,
      email:              lead.email,
      tag:                lead.tag,
      status:             lead.status,
      qualificationScore: lead.metadata?.qualificationScore || 0,
      metadata:           lead.metadata
    },
    journey:       events,
    totalMessages: lead.messages.length,
    automations:   lead.enrollments.length
  };
}

// ─── Get Overall Tracking Dashboard ──────────────────────────────────────────

async function getTrackingDashboard() {
  const [
    totalCampaigns,
    activeCampaigns,
    totalMessages,
    deliveredMessages,
    readMessages,
    totalLeads,
    hotLeads,
    convertedLeads
  ] = await Promise.all([
    prisma.campaign.count(),
    prisma.campaign.count({ where: { status: 'RUNNING' } }),
    prisma.message.count({ where: { direction: 'OUTBOUND' } }),
    prisma.message.count({ where: { status: 'DELIVERED' } }),
    prisma.message.count({ where: { status: 'READ' } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { tag: 'HOT' } }),
    prisma.lead.count({ where: { status: 'CONVERTED' } })
  ]);

  // Messages per day (last 7 days)
  const msgPerDay = await getMessagesPerDay(7);

  // Top performing campaigns
  const topCampaigns = await getTopCampaigns(5);

  return {
    summary: {
      totalCampaigns,
      activeCampaigns,
      totalMessages,
      deliveredMessages,
      readMessages,
      totalLeads,
      hotLeads,
      convertedLeads,
      overallDeliveryRate: totalMessages > 0
        ? ((deliveredMessages / totalMessages) * 100).toFixed(1) + '%'
        : '0%',
      overallReadRate: totalMessages > 0
        ? ((readMessages / totalMessages) * 100).toFixed(1) + '%'
        : '0%'
    },
    msgPerDay,
    topCampaigns
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTimeline(messages) {
  const byHour = {};

  for (const msg of messages) {
    const hour = new Date(msg.sentAt).toISOString().substring(0, 13);
    if (!byHour[hour]) byHour[hour] = { sent: 0, delivered: 0, read: 0 };

    if (['SENT','DELIVERED','READ'].includes(msg.status)) byHour[hour].sent++;
    if (['DELIVERED','READ'].includes(msg.status))        byHour[hour].delivered++;
    if (msg.status === 'READ')                            byHour[hour].read++;
  }

  return Object.entries(byHour).map(([hour, counts]) => ({
    hour, ...counts
  }));
}

async function getMessagesPerDay(days) {
  const results = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const [sent, received] = await Promise.all([
      prisma.message.count({
        where: { direction: 'OUTBOUND', sentAt: { gte: date, lt: nextDate } }
      }),
      prisma.message.count({
        where: { direction: 'INBOUND', sentAt: { gte: date, lt: nextDate } }
      })
    ]);

    results.push({
      date: date.toISOString().split('T')[0],
      sent,
      received
    });
  }

  return results;
}

async function getTopCampaigns(limit) {
  const campaigns = await prisma.campaign.findMany({
    where: { status: 'COMPLETED' },
    include: { _count: { select: { messages: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return campaigns.map(c => ({
    id:       c.id,
    name:     c.name,
    messages: c._count.messages,
    status:   c.status
  }));
}

module.exports = {
  getCampaignReport,
  getLeadJourney,
  getTrackingDashboard
};