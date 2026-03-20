const { prisma } = require('../db');
const { sendTextMessage } = require('./whatsapp.service');
const { saveMessage } = require('./message.service');
const logger = require('../utils/logger');

// ─── Create Automation ────────────────────────────────────────────────────────

async function createAutomation({ name, trigger, steps }) {
  return prisma.automation.create({
    data: { name, trigger, steps, status: 'ACTIVE' }
  });
}

// ─── Enroll Lead in Automation ────────────────────────────────────────────────

async function enrollLead(automationId, leadId) {
  try {
    const automation = await prisma.automation.findUnique({
      where: { id: automationId }
    });

    if (!automation || automation.status !== 'ACTIVE') return null;

    const steps = automation.steps;
    if (!steps || steps.length === 0) return null;

    // Calculate when to send first message
    const firstDelay = steps[0].delayMinutes || 0;
    const nextSendAt = new Date(Date.now() + firstDelay * 60 * 1000);

    // Upsert — don't double-enroll
    const enrollment = await prisma.automationEnrollment.upsert({
      where: { automationId_leadId: { automationId, leadId } },
      update: {
        status: 'ACTIVE',
        currentStep: 0,
        nextSendAt,
        completedAt: null
      },
      create: {
        automationId,
        leadId,
        currentStep: 0,
        status: 'ACTIVE',
        nextSendAt
      }
    });

    logger.info('Lead enrolled in automation', { leadId, automationId, nextSendAt });
    return enrollment;
  } catch (err) {
    logger.error('Enroll lead error', { error: err.message });
    throw err;
  }
}

// ─── Cancel Enrollment (when lead replies) ────────────────────────────────────

async function cancelEnrollment(leadId) {
  try {
    const result = await prisma.automationEnrollment.updateMany({
      where: { leadId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', completedAt: new Date() }
    });

    if (result.count > 0) {
      logger.info('Automation cancelled — lead replied', { leadId, count: result.count });
    }

    return result;
  } catch (err) {
    logger.error('Cancel enrollment error', { error: err.message });
  }
}

// ─── Process Due Enrollments (called every minute by worker) ──────────────────

async function processDueEnrollments() {
  const now = new Date();

  const dueEnrollments = await prisma.automationEnrollment.findMany({
    where: {
      status: 'ACTIVE',
      nextSendAt: { lte: now }
    },
    include: {
      automation: true,
      lead: true
    }
  });

  logger.info(`Processing ${dueEnrollments.length} due enrollments`);

  for (const enrollment of dueEnrollments) {
    await processEnrollmentStep(enrollment);
  }
}

async function processEnrollmentStep(enrollment) {
  const { automation, lead } = enrollment;
  const steps = automation.steps;
  const stepIndex = enrollment.currentStep;

  // No more steps — complete enrollment
  if (stepIndex >= steps.length) {
    await prisma.automationEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });
    logger.info('Automation completed', { leadId: lead.id, automationId: automation.id });
    return;
  }

  const step = steps[stepIndex];

  try {
    // Check if lead replied recently — if so cancel
    const recentReply = await prisma.message.findFirst({
      where: {
        leadId: lead.id,
        direction: 'INBOUND',
        sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      orderBy: { sentAt: 'desc' }
    });

    // If lead replied after enrollment, cancel automation
    if (recentReply && recentReply.sentAt > enrollment.enrolledAt) {
      await prisma.automationEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'CANCELLED', completedAt: new Date() }
      });
      logger.info('Automation cancelled — lead replied', { leadId: lead.id });
      return;
    }

    // Personalize message with lead name
    const message = step.message.replace('{name}', lead.name || 'there');

    // Send message
    const { messageId } = await sendTextMessage(lead.phone, message);

    // Save to DB
    await saveMessage({
      leadId: lead.id,
      direction: 'OUTBOUND',
      body: message,
      waMessageId: messageId,
      status: 'SENT'
    });

    logger.info('Automation step sent', {
      leadId: lead.id,
      step: stepIndex + 1,
      total: steps.length
    });

    // Move to next step
    const nextStepIndex = stepIndex + 1;
    const hasNextStep = nextStepIndex < steps.length;

    if (hasNextStep) {
      const nextDelay = steps[nextStepIndex].delayMinutes || 60;
      const nextSendAt = new Date(Date.now() + nextDelay * 60 * 1000);

      await prisma.automationEnrollment.update({
        where: { id: enrollment.id },
        data: { currentStep: nextStepIndex, nextSendAt }
      });
    } else {
      // Last step — mark complete
      await prisma.automationEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          currentStep: nextStepIndex
        }
      });
    }
  } catch (err) {
    logger.error('Automation step failed', {
      enrollmentId: enrollment.id,
      leadId: lead.id,
      error: err.message
    });
  }
}

// ─── Auto-enroll new leads ────────────────────────────────────────────────────

async function autoEnrollNewLead(leadId) {
  try {
    // Find all active automations with NEW_LEAD trigger
    const automations = await prisma.automation.findMany({
      where: { trigger: 'NEW_LEAD', status: 'ACTIVE' }
    });

    for (const automation of automations) {
      await enrollLead(automation.id, leadId);
    }
  } catch (err) {
    logger.error('Auto enroll error', { leadId, error: err.message });
  }
}

// ─── Auto-enroll no-reply leads ───────────────────────────────────────────────

async function autoEnrollNoReplyLeads() {
  try {
    const automations = await prisma.automation.findMany({
      where: { trigger: 'NO_REPLY', status: 'ACTIVE' }
    });

    if (automations.length === 0) return;

    // Find leads contacted 1+ hour ago with no reply
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const noReplyLeads = await prisma.lead.findMany({
      where: {
        status: 'CONTACTED',
        updatedAt: { lte: oneHourAgo },
        messages: {
          none: { direction: 'INBOUND' }
        }
      }
    });

    for (const lead of noReplyLeads) {
      for (const automation of automations) {
        await enrollLead(automation.id, lead.id);
      }
    }

    if (noReplyLeads.length > 0) {
      logger.info('No-reply leads enrolled', { count: noReplyLeads.length });
    }
  } catch (err) {
    logger.error('Auto enroll no-reply error', { error: err.message });
  }
}

module.exports = {
  createAutomation,
  enrollLead,
  cancelEnrollment,
  processDueEnrollments,
  autoEnrollNewLead,
  autoEnrollNoReplyLeads
};