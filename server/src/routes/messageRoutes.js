const express = require('express');
const router = express.Router();
const { sendMessage, getMessagesByConversation } = require('../controllers/messageController');
const { authenticateUser, requireWorkspaceMember } = require('../middleware/auth');

// Protect all message routes with authentication and workspace membership validation
router.use(authenticateUser);
router.use(requireWorkspaceMember);

/**
 * POST /api/messages/send
 * Authenticate -> Verify Workspace -> Find WhatsAppAccount -> Call Meta API -> Store Message -> Return response
 */
router.post('/send', sendMessage);

/**
 * GET /api/messages/:conversationId
 */
router.get('/:conversationId', getMessagesByConversation);

module.exports = router;
