const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCampaigns(req, res) {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { messages: true } } }
    });
    res.json({ success: true, data: campaigns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createCampaign(req, res) {
  try {
    const { name, template, settings, scheduledAt } = req.body;
    if (!name || !template) {
      return res.status(400).json({ success: false, error: 'name and template are required' });
    }
    const campaign = await prisma.campaign.create({
      data: { name, template, settings, scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
    });
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function launchCampaign(req, res) {
  try {
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status: 'RUNNING' }
    });
    // Phase 7: bulk send logic goes here
    res.json({ success: true, data: campaign, message: 'Campaign launched' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function pauseCampaign(req, res) {
  try {
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status: 'PAUSED' }
    });
    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getCampaignAnalytics(req, res) {
  try {
    const messages = await prisma.message.findMany({
      where: { campaignId: req.params.id }
    });

    const analytics = {
      total: messages.length,
      sent: messages.filter(m => m.status === 'SENT').length,
      delivered: messages.filter(m => m.status === 'DELIVERED').length,
      read: messages.filter(m => m.status === 'READ').length,
      failed: messages.filter(m => m.status === 'FAILED').length
    };

    res.json({ success: true, data: analytics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getCampaigns, createCampaign, launchCampaign, pauseCampaign, getCampaignAnalytics };