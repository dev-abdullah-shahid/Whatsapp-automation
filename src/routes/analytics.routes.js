const express = require('express');
const {
  getOverview,
  getFunnel
} = require('../controllers/analyticsController');

const router = express.Router();

router.get('/overview', getOverview);
router.get('/funnel', getFunnel);

module.exports = router;