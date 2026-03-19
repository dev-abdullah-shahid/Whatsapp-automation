const { prisma } = require('../db');
const { getEnrichedLead, calculateLeadScore } = require('../services/leadCapture.service');
const logger = require('../utils/logger');

// ─── Get All Leads (with search, filter, pagination) ─────────────────────────

async function getLeads(req, res) {
  try {
    const {
      tag,
      status,
      search,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const where = {};

    if (tag)    where.tag    = tag.toUpperCase();
    if (status) where.status = status.toUpperCase();

    // Search by name or phone
    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          _count: { select: { messages: true } },
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1
          }
        }
      }),
      prisma.lead.count({ where })
    ]);

    // Add qualification score to each lead
    const enrichedLeads = leads.map(lead => ({
      ...lead,
      qualificationScore: calculateLeadScore(lead),
      lastMessage: lead.messages[0] || null,
      messages: undefined
    }));

    res.json({
      success: true,
      data: enrichedLeads,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (err) {
    logger.error('getLeads error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Get Single Lead ──────────────────────────────────────────────────────────

async function getLeadById(req, res) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        messages: { orderBy: { sentAt: 'asc' } },
        conversation: true,
        _count: { select: { messages: true } }
      }
    });

    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

    res.json({
      success: true,
      data: {
        ...lead,
        qualificationScore: calculateLeadScore(lead)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Get Enriched Lead ────────────────────────────────────────────────────────

async function getEnrichedLeadById(req, res) {
  try {
    const lead = await getEnrichedLead(req.params.id);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Create Lead ──────────────────────────────────────────────────────────────

async function createLead(req, res) {
  try {
    const { phone, name, email, tag, status, metadata } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone is required' });

    const lead = await prisma.lead.create({
      data: {
        phone,
        name:     name     || null,
        email:    email    || null,
        tag:      tag      || 'COLD',
        status:   status   || 'NEW',
        metadata: metadata || {}
      }
    });

    logger.info('Lead created manually', { id: lead.id, phone });
    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Phone number already exists' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Update Lead ──────────────────────────────────────────────────────────────

async function updateLead(req, res) {
  try {
    const { name, email, tag, status, metadata, notes } = req.body;

    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Lead not found' });

    // Merge metadata instead of replacing
    const mergedMetadata = {
      ...existing.metadata,
      ...metadata,
      ...(notes ? { notes } : {})
    };

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...(name   !== undefined && { name }),
        ...(email  !== undefined && { email }),
        ...(tag    !== undefined && { tag }),
        ...(status !== undefined && { status }),
        metadata: mergedMetadata
      }
    });

    logger.info('Lead updated', { id: lead.id, tag: lead.tag, status: lead.status });
    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Delete Lead ──────────────────────────────────────────────────────────────

async function deleteLead(req, res) {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    logger.info('Lead deleted', { id: req.params.id });
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Get Lead Conversation ────────────────────────────────────────────────────

async function getLeadConversation(req, res) {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const messages = await prisma.message.findMany({
      where: { leadId: id },
      orderBy: { sentAt: 'asc' },
      take: parseInt(limit)
    });

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { name: true, phone: true, tag: true, status: true }
    });

    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

    res.json({
      success: true,
      data: {
        lead,
        messages,
        totalMessages: messages.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Add Note to Lead ─────────────────────────────────────────────────────────

async function addNote(req, res) {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ success: false, error: 'Note is required' });

    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Lead not found' });

    const notes = existing.metadata?.notes || [];
    const updatedNotes = [
      ...notes,
      {
        text: note,
        createdAt: new Date().toISOString()
      }
    ];

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        metadata: {
          ...existing.metadata,
          notes: updatedNotes
        }
      }
    });

    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Bulk Update Leads ────────────────────────────────────────────────────────

async function bulkUpdate(req, res) {
  try {
    const { ids, tag, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array is required' });
    }

    const updateData = {};
    if (tag)    updateData.tag    = tag;
    if (status) updateData.status = status;

    await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: updateData
    });

    logger.info('Bulk update completed', { count: ids.length, tag, status });
    res.json({ success: true, message: `${ids.length} leads updated` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Export Leads to CSV ──────────────────────────────────────────────────────

async function exportLeads(req, res) {
  try {
    const { tag, status } = req.query;
    const where = {};
    if (tag)    where.tag    = tag.toUpperCase();
    if (status) where.status = status.toUpperCase();

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Build CSV
    const headers = ['ID', 'Phone', 'Name', 'Email', 'Tag', 'Status', 'Score', 'Budget', 'Product', 'Created'];
    const rows = leads.map(lead => [
      lead.id,
      lead.phone,
      lead.name        || '',
      lead.email       || '',
      lead.tag,
      lead.status,
      calculateLeadScore(lead),
      lead.metadata?.budget  || '',
      lead.metadata?.product || '',
      lead.createdAt.toISOString()
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getLeads,
  getLeadById,
  getEnrichedLeadById,
  createLead,
  updateLead,
  deleteLead,
  getLeadConversation,
  addNote,
  bulkUpdate,
  exportLeads
};