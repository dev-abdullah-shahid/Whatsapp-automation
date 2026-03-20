const express = require('express');
const {
  getCampaigns,
  createCampaign,
  uploadLeads,
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
  getCampaignAnalytics
} = require('../controllers/campaignController');

const router = express.Router();

router.get('/',                    getCampaigns);
router.post('/',                   createCampaign);
router.post('/:id/leads',          uploadLeads);
router.post('/:id/launch',         launchCampaign);
router.put('/:id/pause',           pauseCampaign);
router.put('/:id/resume',          resumeCampaign);
router.get('/:id/analytics',       getCampaignAnalytics);

module.exports = router;