const express = require('express');
const router = express.Router();
const {
  getWhatsAppStatus,
  connectWhatsAppAccount,
  sendTestMessage,
  simulateIncomingMessage,
  getWebhookLogs,
} = require('../controllers/whatsappController');
const { authenticateUser, requireWorkspaceMember } = require('../middleware/auth');

router.use(authenticateUser);
router.use(requireWorkspaceMember);

router.get('/', getWhatsAppStatus);
router.get('/webhook-logs', getWebhookLogs);
router.post('/connect', connectWhatsAppAccount);
router.post('/send-test', sendTestMessage);
router.post('/simulate-incoming', simulateIncomingMessage);

module.exports = router;
