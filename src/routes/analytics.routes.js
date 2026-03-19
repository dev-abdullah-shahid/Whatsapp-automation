const express = require('express');
const { getOverview, getFunnel, getLeadGrowth } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/overview', getOverview);
router.get('/funnel',   getFunnel);
router.get('/growth',   getLeadGrowth);

module.exports = router;