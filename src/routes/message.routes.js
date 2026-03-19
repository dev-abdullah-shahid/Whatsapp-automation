const express = require('express');
const {
  sendMessage,
  getMessagesByLead
} = require('../controllers/messageController');

const router = express.Router();

router.post('/send', sendMessage);
router.get('/:leadId', getMessagesByLead);

module.exports = router;