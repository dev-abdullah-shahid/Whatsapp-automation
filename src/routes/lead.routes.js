const express = require('express');
const {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getEnrichedLeadById
} = require('../controllers/leadController');

const router = express.Router();

router.get('/', getLeads);
router.get('/:id/enriched', getEnrichedLeadById);
router.get('/:id', getLeadById);
router.post('/', createLead);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);

module.exports = router;