const express = require('express');
const router = express.Router();
const {
  getConversations,
  getConversationById,
  getMessages,
  sendMessage,
  markAsRead,
  updateStatus,
} = require('../controllers/conversationController');
const { authenticateUser, requireWorkspaceMember } = require('../middleware/auth');

// Apply workspace security to all conversation routes
router.use(authenticateUser);
router.use(requireWorkspaceMember);

router.get('/', getConversations);
router.get('/:id', getConversationById);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', sendMessage);
router.patch('/:id/read', markAsRead);
router.patch('/:id/status', updateStatus);
router.put('/:id/status', updateStatus);

module.exports = router;
