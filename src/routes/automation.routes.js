const express = require('express');
const {
  getAutomations,
  createAutomationHandler,
  enrollLeadHandler,
  pauseAutomation,
  resumeAutomation,
  getEnrollments
} = require('../controllers/automationController');

const router = express.Router();

router.get('/',                       getAutomations);
router.post('/',                      createAutomationHandler);
router.post('/:id/enroll',            enrollLeadHandler);
router.put('/:id/pause',              pauseAutomation);
router.put('/:id/resume',             resumeAutomation);
router.get('/:id/enrollments',        getEnrollments);

module.exports = router;