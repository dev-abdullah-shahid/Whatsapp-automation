const { prisma } = require('../db');
const {
  createAutomation,
  enrollLead,
  cancelEnrollment
} = require('../services/automation.service');
const logger = require('../utils/logger');

async function getAutomations(req, res) {
  try {
    const automations = await prisma.automation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { enrollments: true } }
      }
    });
    res.json({ success: true, data: automations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createAutomationHandler(req, res) {
  try {
    const { name, trigger, steps } = req.body;

    if (!name || !trigger || !steps || !Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        error: 'name, trigger, and steps array are required'
      });
    }

    // Validate steps format
    for (const step of steps) {
      if (!step.message) {
        return res.status(400).json({
          success: false,
          error: 'Each step must have a message field'
        });
      }
    }

    const automation = await createAutomation({ name, trigger, steps });
    logger.info('Automation created', { id: automation.id, name });
    res.status(201).json({ success: true, data: automation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function enrollLeadHandler(req, res) {
  try {
    const { leadId } = req.body;
    if (!leadId) {
      return res.status(400).json({ success: false, error: 'leadId is required' });
    }

    const enrollment = await enrollLead(req.params.id, leadId);
    res.json({ success: true, data: enrollment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function pauseAutomation(req, res) {
  try {
    const automation = await prisma.automation.update({
      where: { id: req.params.id },
      data: { status: 'PAUSED' }
    });
    res.json({ success: true, data: automation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function resumeAutomation(req, res) {
  try {
    const automation = await prisma.automation.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' }
    });
    res.json({ success: true, data: automation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getEnrollments(req, res) {
  try {
    const enrollments = await prisma.automationEnrollment.findMany({
      where: { automationId: req.params.id },
      include: {
        lead: {
          select: { name: true, phone: true, tag: true }
        }
      },
      orderBy: { enrolledAt: 'desc' }
    });
    res.json({ success: true, data: enrollments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getAutomations,
  createAutomationHandler,
  enrollLeadHandler,
  pauseAutomation,
  resumeAutomation,
  getEnrollments
};