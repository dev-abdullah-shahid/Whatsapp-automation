const { prisma } = require('../db');
const { runCampaign, importLeadsForCampaign, getCampaignStats } = require('../services/campaign.service');
const logger = require('../utils/logger');
const csv = require('csv-parser');
const { Readable } = require('stream');
const multer = require('multer');

// Multer setup — store in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/json' ||
      file.originalname.endsWith('.csv') ||
      file.originalname.endsWith('.json')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and JSON files are allowed'));
    }
  }
});

// ─── Get All Campaigns ────────────────────────────────────────────────────────

async function getCampaigns(req, res) {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { messages: true } }
      }
    });

    res.json({ success: true, data: campaigns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Create Campaign ──────────────────────────────────────────────────────────

async function createCampaign(req, res) {
  try {
    const { name, template, scheduledAt } = req.body;

    if (!name || !template) {
      return res.status(400).json({
        success: false,
        error: 'name and template are required'
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        template,
        status: 'DRAFT',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null
      }
    });

    logger.info('Campaign created', { id: campaign.id, name });
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Upload Leads to Campaign ─────────────────────────────────────────────────

async function uploadLeads(req, res) {
  try {
    const { id: campaignId } = req.params;

    // Verify campaign exists
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    let leads = [];

    // Handle JSON body upload
    if (req.body.leads && Array.isArray(req.body.leads)) {
      leads = req.body.leads;
    }
    // Handle file upload
    else if (req.file) {
      if (req.file.originalname.endsWith('.json')) {
        leads = JSON.parse(req.file.buffer.toString());
      } else if (
        req.file.originalname.endsWith('.csv') ||
        req.file.mimetype === 'text/csv'
      ) {
        leads = await parseCSV(req.file.buffer);
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Provide leads array in body or upload a CSV/JSON file'
      });
    }

    if (leads.length === 0) {
      return res.status(400).json({ success: false, error: 'No leads found in upload' });
    }

    const results = await importLeadsForCampaign(leads, campaignId);

    res.json({
      success: true,
      message: `${results.created + results.existing} leads ready for campaign`,
      data: {
        created:  results.created,
        existing: results.existing,
        errors:   results.errors,
        total:    results.created + results.existing
      }
    });
  } catch (err) {
    logger.error('Upload leads error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Launch Campaign ──────────────────────────────────────────────────────────

async function launchCampaign(req, res) {
  try {
    const { id: campaignId } = req.params;

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (campaign.status === 'RUNNING') {
      return res.status(400).json({ success: false, error: 'Campaign is already running' });
    }

    if (campaign.status === 'COMPLETED') {
      return res.status(400).json({ success: false, error: 'Campaign already completed' });
    }

    // Respond immediately — campaign runs in background
    res.json({
      success: true,
      message: 'Campaign launched successfully',
      data: { campaignId, status: 'RUNNING' }
    });

    // Run campaign in background (non-blocking)
    runCampaign(campaignId).catch(err => {
      logger.error('Campaign run error', { campaignId, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Pause Campaign ───────────────────────────────────────────────────────────

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

// ─── Resume Campaign ──────────────────────────────────────────────────────────

async function resumeCampaign(req, res) {
  try {
    const { id: campaignId } = req.params;

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' }
    });

    res.json({ success: true, message: 'Campaign resumed', data: { campaignId } });

    // Re-run from where it left off
    runCampaign(campaignId).catch(err => {
      logger.error('Campaign resume error', { campaignId, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Get Campaign Analytics ───────────────────────────────────────────────────

async function getCampaignAnalytics(req, res) {
  try {
    const [campaign, stats] = await Promise.all([
      prisma.campaign.findUnique({ where: { id: req.params.id } }),
      getCampaignStats(req.params.id)
    ]);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, data: { campaign, stats } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── CSV Parser Helper ────────────────────────────────────────────────────────

function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString());

    stream
      .pipe(csv())
      .on('data', row => results.push(row))
      .on('end', () => resolve(results))
      .on('error', err => reject(err));
  });
}

// Export multer middleware for routes
module.exports = {
  getCampaigns,
  createCampaign,
  uploadLeads: [upload.single('file'), uploadLeads],
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
  getCampaignAnalytics
};