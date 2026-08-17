const { verifyWebhook, handleWebhookEvent } = require('../webhooks/whatsappWebhook');
const {
  Workspace,
  WhatsAppAccount,
  Contact,
  Conversation,
  Message,
} = require('../models');

async function testWebhookSuite() {
  console.log('🧪 Testing Meta WhatsApp Webhooks (GET & POST Flows)...\n');

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

  process.env.META_VERIFY_TOKEN = 'nexaflow_verify_token_test_123';

  // MOCK MongoDB Documents at the start
  const mockWorkspace = {
    _id: '65d3c3333333333333333333',
    name: 'Main Workspace',
  };
  const mockAccount = {
    _id: '65d5e5555555555555555555',
    workspaceId: mockWorkspace._id,
    phoneNumberId: '109876543210987',
  };

  Workspace.findById = async () => mockWorkspace;
  Workspace.findOne = () => ({ sort: async () => mockWorkspace });
  WhatsAppAccount.findOne = async (q) => {
    if (q && q['metadata.verifyToken']) {
      return null;
    }
    return mockAccount;
  };
  const { Automation, AutomationExecution, CampaignRecipient, Tag } = require('../models');
  Automation.find = async () => [];
  AutomationExecution.create = async (d) => ({ ...d, save: async function() { return this; } });
  CampaignRecipient.findOneAndUpdate = async () => ({});
  Tag.findOne = async () => null;

  let storedContacts = new Map();
  Contact.findOne = async (q) => storedContacts.get(q.phoneNumber) || null;
  Contact.create = async (d) => {
    const doc = { _id: '65d6f6666666666666666666', ...d, save: async function () { return this; } };
    storedContacts.set(d.phoneNumber, doc);
    return doc;
  };

  let storedConversations = new Map();
  Conversation.findOne = async (q) => storedConversations.get(String(q.contactId)) || null;
  Conversation.create = async (d) => {
    const doc = { _id: '65d7a7777777777777777777', ...d, save: async function () { return this; } };
    storedConversations.set(String(d.contactId), doc);
    return doc;
  };
  Conversation.findOneAndUpdate = async () => ({});

  let storedMessages = new Map();
  Message.findOne = async (q) => storedMessages.get(q.whatsappMessageId) || null;
  Message.create = async (d) => {
    const doc = { _id: `msg_${Date.now()}_${Math.random()}`, ...d, save: async function () { return this; } };
    storedMessages.set(d.whatsappMessageId, doc);
    return doc;
  };

  // TEST 1: GET /api/webhooks/whatsapp (Valid Verification)
  const reqValidGet = {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'nexaflow_verify_token_test_123',
      'hub.challenge': '11559955',
    },
  };
  const resValidGet = {
    statusCode: 200,
    body: '',
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = b; return this; },
    json(j) { this.body = j; return this; },
  };

  await verifyWebhook(reqValidGet, resValidGet);
  assert(
    resValidGet.statusCode === 200 && resValidGet.body === '11559955',
    'GET webhook verification succeeds with valid verify token'
  );

  // TEST 2: GET /api/webhooks/whatsapp (Invalid Verification)
  const reqInvalidGet = {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong_token',
      'hub.challenge': '11559955',
    },
  };
  const resInvalidGet = {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = b; return this; },
    json(j) { this.body = j; return this; },
  };

  await verifyWebhook(reqInvalidGet, resInvalidGet);
  assert(
    resInvalidGet.statusCode === 403,
    'GET webhook verification rejects invalid token with 403 Forbidden'
  );

  // TEST 3: POST /api/webhooks/whatsapp (Inbound Text Message)
  const incomingTextMessageId = 'wamid.HBgLMTU1NTAwMTAwMDFVAgARGBI0MTA3';
  const reqPostText = {
    headers: {},
    body: {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ID',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550234567',
                  phone_number_id: '109876543210987',
                },
                contacts: [
                  {
                    profile: { name: 'Alice Cooper' },
                    wa_id: '15550010001',
                  },
                ],
                messages: [
                  {
                    from: '15550010001',
                    id: incomingTextMessageId,
                    timestamp: '1720000000',
                    type: 'text',
                    text: { body: 'I want to inquire about your product pricing' },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  };

  const resPost = {
    statusCode: 200,
    body: '',
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = b; return this; },
  };

  await handleWebhookEvent(reqPostText, resPost);

  const createdMsg = storedMessages.get(incomingTextMessageId);
  assert(resPost.statusCode === 200 && resPost.body === 'EVENT_RECEIVED', 'POST webhook immediately returns 200 EVENT_RECEIVED');
  assert(Boolean(createdMsg), 'Inbound message is saved to MongoDB');
  assert(createdMsg.direction === 'inbound', 'Message direction is set to inbound');
  assert(createdMsg.body === 'I want to inquire about your product pricing', 'Message body contains text content');
  assert(createdMsg.status === 'received', 'Inbound message status is set to received');

  // TEST 4: Idempotency (Sending same webhook twice must NOT create duplicate message)
  const initialCount = storedMessages.size;
  await handleWebhookEvent(reqPostText, resPost);
  assert(storedMessages.size === initialCount, 'Idempotency verified: Duplicate webhook did not create duplicate MongoDB message');

  // TEST 5: Inbound Media Message (Image with Caption)
  const imageMsgId = 'wamid.HBgLMTU1NTAwMTAwMDFVAgARGBI0SU1BR0U=';
  const reqPostImage = {
    headers: {},
    body: {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '109876543210987' },
                contacts: [{ profile: { name: 'Alice Cooper' }, wa_id: '15550010001' }],
                messages: [
                  {
                    from: '15550010001',
                    id: imageMsgId,
                    type: 'image',
                    image: {
                      id: 'media_img_123',
                      caption: 'Receipt screenshot',
                      mime_type: 'image/jpeg',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  };

  await handleWebhookEvent(reqPostImage, resPost);
  const createdImgMsg = storedMessages.get(imageMsgId);
  assert(
    createdImgMsg && createdImgMsg.type === 'image' && createdImgMsg.media.id === 'media_img_123',
    'Inbound image message successfully parsed and saved with media metadata'
  );

  // TEST 6: Inbound Interactive Button Reply
  const interactiveMsgId = 'wamid.HBgLMTU1NTAwMTAwMDFVAgARGBI0QlRO';
  const reqPostInteractive = {
    headers: {},
    body: {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '109876543210987' },
                contacts: [{ profile: { name: 'Alice Cooper' }, wa_id: '15550010001' }],
                messages: [
                  {
                    from: '15550010001',
                    id: interactiveMsgId,
                    type: 'interactive',
                    interactive: {
                      type: 'button_reply',
                      button_reply: {
                        id: 'opt_talk_to_sales',
                        title: 'Talk to Sales',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  };

  await handleWebhookEvent(reqPostInteractive, resPost);
  const createdInteractiveMsg = storedMessages.get(interactiveMsgId);
  assert(
    createdInteractiveMsg && createdInteractiveMsg.body === 'Talk to Sales',
    'Interactive button reply correctly saved with button title as body'
  );

  // TEST 7: Status Update Event (Delivered / Read)
  const outboundMessageId = 'wamid.HBgLMTU1NTAwMTAwMDFVAgARGBI0TUVE';
  storedMessages.set(outboundMessageId, {
    _id: '65d8b8888888888888888888',
    whatsappMessageId: outboundMessageId,
    status: 'sent',
    save: async function () { return this; },
  });

  const reqPostStatus = {
    headers: {},
    body: {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                statuses: [
                  {
                    id: outboundMessageId,
                    status: 'delivered',
                    timestamp: '1720000050',
                    recipient_id: '15550010001',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  };

  await handleWebhookEvent(reqPostStatus, resPost);
  const updatedOutbound = storedMessages.get(outboundMessageId);
  assert(updatedOutbound.status === 'delivered', 'Message status successfully updated to delivered');

  // TEST 8: Unknown/Malformed event does not crash server
  let crashed = false;
  try {
    await handleWebhookEvent({ body: { object: 'unknown_object_type', randomData: 123 } }, resPost);
    await handleWebhookEvent({ body: null }, resPost);
  } catch (e) {
    crashed = true;
  }
  assert(!crashed, 'Server does not crash on malformed or unexpected webhook events');

  console.log(`\n🎉 ALL ${passed}/${total} META WEBHOOK SUITE TESTS PASSED!`);
}

testWebhookSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
