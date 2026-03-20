const express = require('express');
const {
  getDashboard,
  getCampaignTrackingReport,
  getCampaignMessageList,
  getLeadJourneyHandler
} = require('../controllers/trackingController');

const router = express.Router();

router.get('/dashboard',                  getDashboard);
router.get('/campaigns/:id',              getCampaignTrackingReport);
router.get('/campaigns/:id/messages',     getCampaignMessageList);
router.get('/leads/:leadId/journey',      getLeadJourneyHandler);

module.exports = router;