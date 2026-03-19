const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getLeads(req, res) {
  try {
    const { tag, status, limit = 50, offset = 0 } = req.query;
    const where = {};
    if (tag) where.tag = tag.toUpperCase();
    if (status) where.status = status.toUpperCase();

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: { _count: { select: { messages: true } } }
    });

    const total = await prisma.lead.count({ where });
    res.json({ success: true, data: leads, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getLeadById(req, res) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        messages: { orderBy: { sentAt: 'asc' } },
        conversation: true
      }
    });
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createLead(req, res) {
  try {
    const { phone, name, email, tag, status } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone is required' });

    const lead = await prisma.lead.create({
      data: { phone, name, email, tag: tag || 'COLD', status: status || 'NEW' }
    });
    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Phone number already exists' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
}

async function updateLead(req, res) {
  try {
    const { name, email, tag, status, metadata } = req.body;
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: { name, email, tag, status, metadata }
    });
    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteLead(req, res) {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

const { getEnrichedLead, calculateLeadScore } = require('../services/leadCapture.service');

async function getEnrichedLeadById(req, res) {
  try {
    const lead = await getEnrichedLead(req.params.id);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getEnrichedLeadById
};