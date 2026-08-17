const express = require('express');
const router = express.Router();
const {
  sendWhatsAppTestMessage,
  seedWelcomeAutomation,
  getAutomationTestStatus,
} = require('../controllers/testController');

// Test Endpoints
router.post('/whatsapp/send', sendWhatsAppTestMessage);
router.get('/automation/status', getAutomationTestStatus);
router.post('/automation/seed', seedWelcomeAutomation);

module.exports = router;
