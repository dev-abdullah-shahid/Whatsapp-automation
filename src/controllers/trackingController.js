const {
  getCampaignReport,
  getLeadJourney,
  getTrackingDashboard
} = require('../services/tracking.service');
const { getCampaignMessages } = require('../services/message.service');
const logger = require('../utils/logger');

async function getDashboard(req, res) {
  try {
    const data = await getTrackingDashboard();
    res.json({ success: true, data });
  } catch (err) {
    logger.error('getDashboard error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getCampaignTrackingReport(req, res) {
  try {
    const report = await getCampaignReport(req.params.id);
    res.json({ success: true, data: report });
  } catch (err) {
    logger.error('getCampaignReport error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getCampaignMessageList(req, res) {
  try {
    const { limit, offset } = req.query;
    const { messages, total } = await getCampaignMessages(
      req.params.id,
      { limit, offset }
    );
    res.json({ success: true, data: messages, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getLeadJourneyHandler(req, res) {
  try {
    const journey = await getLeadJourney(req.params.leadId);
    res.json({ success: true, data: journey });
  } catch (err) {
    logger.error('getLeadJourney error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getDashboard,
  getCampaignTrackingReport,
  getCampaignMessageList,
  getLeadJourneyHandler
};