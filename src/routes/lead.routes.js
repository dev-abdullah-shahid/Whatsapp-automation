const express = require('express');
const {
  getLeads,
  getLeadById,
  getEnrichedLeadById,
  createLead,
  updateLead,
  deleteLead,
  getLeadConversation,
  addNote,
  bulkUpdate,
  exportLeads
} = require('../controllers/leadController');

const router = express.Router();

router.get('/export',        exportLeads);
router.get('/',              getLeads);
router.get('/:id/enriched',  getEnrichedLeadById);
router.get('/:id/conversation', getLeadConversation);
router.post('/:id/notes',    addNote);
router.get('/:id',           getLeadById);
router.post('/',             createLead);
router.put('/bulk',          bulkUpdate);
router.put('/:id',           updateLead);
router.delete('/:id',        deleteLead);

module.exports = router;