const axios = require('axios');
const { sendMessage } = require('../controllers/messageController');
const { WhatsAppAccount, Contact, Conversation, Message } = require('../models');

async function testMessageEndpoint() {
  console.log('🧪 Testing POST /api/messages/send Controller Flow...\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Intercept axios.post to mock Meta Cloud API response
  const originalPost = axios.post;
  axios.post = async () => ({
    status: 200,
    data: {
      messaging_product: 'whatsapp',
      contacts: [{ input: '15551234567', wa_id: '15551234567' }],
      messages: [{ id: 'wamid.HBgLMTU1NTEyMzQ1NjcVAgARGBI0MTA3' }],
    },
  });

  // Mock Mongoose models
  const mockWorkspaceId = '65d3c3333333333333333333';
  const mockUserId = '65d1a1111111111111111111';

  WhatsAppAccount.findOne = async () => ({
    _id: '65d5e5555555555555555555',
    phoneNumberId: '109876543210987',
    accessTokenEncrypted: 'EAAB_test_token_secret',
  });

  let createdContact = null;
  Contact.findOne = async () => null;
  Contact.create = async (data) => {
    createdContact = { _id: '65d6f6666666666666666666', ...data };
    return createdContact;
  };

  let createdConversation = null;
  Conversation.findOne = async () => null;
  Conversation.create = async (data) => {
    createdConversation = {
      _id: '65d7a7777777777777777777',
      ...data,
      save: async function () { return this; },
    };
    return createdConversation;
  };

  let createdMessage = null;
  Message.create = async (data) => {
    createdMessage = { _id: '65d8b8888888888888888888', ...data };
    return createdMessage;
  };

  // Mock Request & Response
  const req = {
    user: { _id: mockUserId },
    workspaceId: mockWorkspaceId,
    body: {
      to: '+1 (555) 123-4567',
      type: 'text',
      text: 'Order dispatched successfully!',
      contactName: 'Jane Smith',
    },
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  let nextErr = null;
  await sendMessage(req, res, (err) => { nextErr = err; });

  assert(!nextErr, 'sendMessage executed without unhandled errors');
  assert(res.statusCode === 201, 'sendMessage returns 201 Created');
  assert(createdContact !== null && createdContact.phoneNumber === '15551234567', 'Contact was created with normalized phone');
  assert(createdConversation !== null, 'Conversation was created');
  assert(createdMessage !== null && createdMessage.whatsappMessageId === 'wamid.HBgLMTU1NTEyMzQ1NjcVAgARGBI0MTA3', 'Message was stored with Meta wamid');
  assert(createdMessage.direction === 'outbound' && createdMessage.status === 'sent', 'Message marked as outbound and sent');

  axios.post = originalPost;
  console.log(`\n🎉 ALL ${passed}/${total} POST /api/messages/send TESTS PASSED!`);
}

testMessageEndpoint().catch((e) => {
  console.error(e);
  process.exit(1);
});
