const {
  getConversations,
  getConversationById,
  getMessages,
  sendMessage,
  markAsRead,
  updateStatus,
} = require('../controllers/conversationController');

const { Conversation, Message, Contact, WhatsAppAccount } = require('../models');
const WhatsAppService = require('../services/whatsappService');

async function testConversations() {
  console.log('🧪 Testing NexaFlow Real-Time Conversation & Inbox Suite...\n');

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

  const workspaceId = '65d3c3333333333333333333';
  const contactId = '65d6f6666666666666666666';
  const convId = '65d7a7777777777777777777';

  // Mock Data
  const mockContact = {
    _id: contactId,
    workspaceId,
    phoneNumber: '15551234567',
    name: 'Sarah Connor',
    tags: [],
    save: async function () { return this; },
  };

  const mockConversation = {
    _id: convId,
    workspaceId,
    contactId: mockContact,
    status: 'open',
    unreadCount: 3,
    lastMessage: {
      body: 'Need help with order',
      direction: 'inbound',
      status: 'received',
      timestamp: new Date(),
    },
    lastMessageAt: new Date(),
    save: async function () { return this; },
  };

  const mockMessagesList = [
    {
      _id: 'msg_1',
      conversationId: convId,
      workspaceId,
      direction: 'inbound',
      body: 'Need help with order',
      status: 'received',
      createdAt: new Date(Date.now() - 60000),
    },
  ];

  // Model Mocks
  Conversation.countDocuments = async () => 1;
  Conversation.find = () => ({
    populate: () => ({
      populate: () => ({
        sort: () => ({
          skip: () => ({
            limit: async () => [mockConversation],
          }),
        }),
      }),
    }),
  });

  Conversation.findOne = (q) => ({
    populate: () => ({
      populate: async () => (q._id === convId ? mockConversation : null),
      then: (res) => res(q._id === convId ? mockConversation : null),
    }),
    then: (res) => res(q._id === convId ? mockConversation : null),
  });

  Conversation.findOneAndUpdate = (q, update) => {
    if (update.$set) {
      Object.assign(mockConversation, update.$set);
    }
    const chain = {
      populate: () => chain,
      then: (res) => res(mockConversation),
    };
    return chain;
  };

  Message.countDocuments = async () => mockMessagesList.length;
  Message.find = () => ({
    sort: () => ({
      skip: () => ({
        limit: async () => mockMessagesList,
      }),
    }),
  });

  Message.create = async (d) => {
    const doc = { _id: `msg_${Date.now()}`, ...d };
    mockMessagesList.push(doc);
    return doc;
  };

  WhatsAppAccount.findById = async () => ({
    _id: 'acc_1',
    phoneNumberId: '10987654321',
    accessTokenEncrypted: 'mock_token',
  });
  WhatsAppAccount.findOne = async () => ({
    _id: 'acc_1',
    phoneNumberId: '10987654321',
    accessTokenEncrypted: 'mock_token',
  });

  // Mock Meta Service
  const origSend = WhatsAppService.sendTextMessage;
  WhatsAppService.sendTextMessage = async () => ({
    messages: [{ id: 'wamid.HBgLMTU1NTEyMzQ1NjcVAgARGBI0MTA3' }],
  });

  let resStatus = 200;
  let resData = null;
  const res = {
    status(c) { resStatus = c; return this; },
    json(d) { resData = d; return this; },
  };

  try {
    // TEST 1: GET /api/conversations
    const reqGetConvs = { workspaceId, query: { status: 'all' } };
    await getConversations(reqGetConvs, res, (e) => { if (e) throw e; });
    assert(resData.data.conversations.length === 1, 'GET /api/conversations retrieves workspace conversations');
    assert(resData.data.conversations[0].unreadCount === 3, 'Unread count populated');

    // TEST 2: GET /api/conversations/:id/messages
    const reqGetMsgs = { workspaceId, params: { id: convId }, query: { limit: 50 } };
    await getMessages(reqGetMsgs, res, (e) => { if (e) throw e; });
    assert(resData.data.messages.length >= 1, 'GET /api/conversations/:id/messages returns message history');
    assert(mockConversation.unreadCount === 0, 'Opening messages automatically marks conversation unreadCount as 0');

    // TEST 3: POST /api/conversations/:id/messages (Outbound Message)
    const reqSend = {
      workspaceId,
      params: { id: convId },
      body: {
        text: 'Hello Sarah! I can help you with your order.',
        type: 'text',
      },
    };
    await sendMessage(reqSend, res, (e) => { if (e) throw e; });
    assert(resStatus === 201, 'POST /api/conversations/:id/messages returns 201 Created');
    assert(resData.data.message.direction === 'outbound', 'Dispatched message is outbound');
    assert(resData.data.message.status === 'sent', 'Message status is set to sent');

    // TEST 4: PATCH /api/conversations/:id/read
    const reqRead = { workspaceId, params: { id: convId } };
    await markAsRead(reqRead, res, (e) => { if (e) throw e; });
    assert(resData.data.conversation.unreadCount === 0, 'PATCH /api/conversations/:id/read resets unread count');

    // TEST 5: PATCH /api/conversations/:id/status
    const reqStatus = { workspaceId, params: { id: convId }, body: { status: 'resolved' } };
    await updateStatus(reqStatus, res, (e) => { if (e) throw e; });
    assert(resData.data.conversation.status === 'resolved', 'PATCH /api/conversations/:id/status updates conversation status to resolved');

    console.log(`\n🎉 ALL ${passed}/${total} CONVERSATION & INBOX TESTS PASSED!`);
  } finally {
    WhatsAppService.sendTextMessage = origSend;
  }
}

testConversations().catch((e) => {
  console.error(e);
  process.exit(1);
});
