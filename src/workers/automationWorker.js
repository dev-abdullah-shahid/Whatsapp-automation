require('dotenv').config();
const {
  processDueEnrollments,
  autoEnrollNoReplyLeads
} = require('../services/automation.service');
const logger = require('../utils/logger');

logger.info('Automation worker started');

// Process due automation steps every minute
async function runAutomationCycle() {
  try {
    await processDueEnrollments();
    await autoEnrollNoReplyLeads();
  } catch (err) {
    logger.error('Automation cycle error', { error: err.message });
  }
}

// Run immediately on start
runAutomationCycle();

// Then every 60 seconds
setInterval(runAutomationCycle, 60 * 1000);