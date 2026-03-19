const express = require('express');
const {
  getCampaigns,
  createCampaign,
  launchCampaign,
  pauseCampaign,
  getCampaignAnalytics
} = require('../controllers/campaignController');

const router = express.Router();

router.get('/', getCampaigns);
router.post('/', createCampaign);
router.post('/:id/launch', launchCampaign);
router.put('/:id/pause', pauseCampaign);
router.get('/:id/analytics', getCampaignAnalytics);

module.exports = router;