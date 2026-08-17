const mongoose = require('mongoose');
const {
  Workspace,
  Contact,
  Conversation,
  Message,
  Automation,
  AutomationExecution,
  WhatsAppAccount,
} = require('../models');
const AutomationEngine = require('../services/automationEngine');
const { handleWebhookEvent } = require('../webhooks/whatsappWebhook');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`❌ FAIL: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
};

const runCompleteWhatsAppFlowTest = async () => {
  console.log('\n======================================================================');
  console.log('🧪 NexaFlow Complete WhatsApp Automation Flow Verification');
  console.log('======================================================================\n');

  // Setup User, Workspace & Account
  const { User } = require('../models');
  let user = await User.findOne();
  if (!user) {
    user = await User.create({
      name: 'Test Owner',
      email: `test_owner_${Date.now()}@nexaflow.io`,
      passwordHash: 'dummy_hash',
    });
  }

  let workspace = await Workspace.findOne();
  if (!workspace) {
    workspace = await Workspace.create({
      name: 'Flow Verification Workspace',
      ownerId: user._id,
    });
  }

  const testPhoneNumberId = '100200300400';
  let account = await WhatsAppAccount.findOne({ phoneNumberId: testPhoneNumberId });
  if (!account) {
    account = await WhatsAppAccount.create({
      workspaceId: workspace._id,
      phoneNumberId: testPhoneNumberId,
      businessAccountId: '200300400500',
      phoneNumber: '+15550001111',
      displayName: 'Flow Test Business',
      status: 'connected',
    });
  }

  // Setup "Test Welcome Automation"
  const welcomeText = 'Hello {{contact.name}} 👋\n\nWelcome to NexaFlow!\n\nThis message was sent automatically.';
  let automation = await Automation.findOne({
    workspaceId: workspace._id,
    name: 'Test Welcome Automation',
  });

  if (!automation) {
    automation = await Automation.create({
      workspaceId: workspace._id,
      name: 'Test Welcome Automation',
      enabled: true,
      trigger: {
        type: 'keyword',
        config: { keywords: ['hi'] },
      },
      nodes: [
        { id: 't1', type: 'trigger', data: { type: 'trigger' } },
        { id: 'a1', type: 'send_message', data: { text: welcomeText, messageText: welcomeText } },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'a1' }],
    });
  } else {
    automation.enabled = true;
    automation.trigger = { type: 'keyword', config: { keywords: ['hi'] } };
    automation.nodes = [
      { id: 't1', type: 'trigger', data: { type: 'trigger' } },
      { id: 'a1', type: 'send_message', data: { text: welcomeText, messageText: welcomeText } },
    ];
    automation.edges = [{ id: 'e1', source: 't1', target: 'a1' }];
    await automation.save();
  }

  assert(automation && automation.enabled === true, 'Test Welcome Automation is active in MongoDB');

  const customerPhone = '919988776655';
  const customerName = 'Priya Sharma';

  // Helper to build simulated Meta Webhook request
  const createMetaWebhookReq = (wamid, text) => ({
    body: {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '200300400500',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+15550001111',
                  phone_number_id: testPhoneNumberId,
                },
                contacts: [
                  {
                    profile: { name: customerName },
                    wa_id: customerPhone,
                  },
                ],
                messages: [
                  {
                    from: customerPhone,
                    id: wamid,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    text: { body: text },
                    type: 'text',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  });

  const mockRes = {
    status: (code) => ({
      send: () => {},
      json: () => {},
    }),
  };

  // --------------------------------------------------------------------
  // TEST 1: Customer sends "Hi" -> Trigger Matched -> Auto-Reply Sent
  // --------------------------------------------------------------------
  console.log('\n--- TEST 1: Customer sends "Hi" (Trigger Matched) ---');
  const wamid1 = `wamid_test_1_${Date.now()}`;
  await handleWebhookEvent(createMetaWebhookReq(wamid1, 'Hi'), mockRes);

  // Give a small moment for async automation execution to complete
  await new Promise((r) => setTimeout(r, 200));

  const contact1 = await Contact.findOne({ workspaceId: workspace._id, phoneNumber: customerPhone });
  assert(contact1 !== null, 'Contact found/created in MongoDB');
  assert(contact1.name === customerName, `Contact profile name recorded as "${customerName}"`);

  const conversation1 = await Conversation.findOne({ workspaceId: workspace._id, contactId: contact1._id });
  assert(conversation1 !== null, 'Conversation found/created in MongoDB');

  const incomingMsg1 = await Message.findOne({ whatsappMessageId: wamid1 });
  assert(incomingMsg1 !== null, 'Incoming WhatsApp message saved in MongoDB');
  assert(incomingMsg1.direction === 'inbound', 'Message direction is inbound');

  const replyMsg1 = await Message.findOne({
    conversationId: conversation1._id,
    direction: 'outbound',
    'metadata.automated': true,
  }).sort({ createdAt: -1 });

  assert(replyMsg1 !== null, 'Automatic reply message created and saved in MongoDB');
  assert(replyMsg1.body.includes(`Hello ${customerName} 👋`), `Variable {{contact.name}} interpolated correctly: "${replyMsg1.body}"`);
  assert(replyMsg1.status === 'sent', 'Reply message status marked as sent');

  const exec1 = await AutomationExecution.findOne({
    automationId: automation._id,
    'triggerData.whatsappMessageId': wamid1,
  });
  assert(exec1 !== null, 'AutomationExecution record stored in MongoDB');
  assert(exec1.status === 'completed', 'AutomationExecution status is completed');

  // --------------------------------------------------------------------
  // TEST 2: Customer sends "Hello" -> Trigger does NOT match -> No Auto-Reply
  // --------------------------------------------------------------------
  console.log('\n--- TEST 2: Customer sends "Hello" (No Trigger Match) ---');
  const wamid2 = `wamid_test_2_${Date.now()}`;
  const repliesBefore2 = await Message.countDocuments({
    conversationId: conversation1._id,
    direction: 'outbound',
    'metadata.automated': true,
  });

  await handleWebhookEvent(createMetaWebhookReq(wamid2, 'Hello'), mockRes);
  await new Promise((r) => setTimeout(r, 200));

  const incomingMsg2 = await Message.findOne({ whatsappMessageId: wamid2 });
  assert(incomingMsg2 !== null, 'Inbound message "Hello" saved to MongoDB');

  const repliesAfter2 = await Message.countDocuments({
    conversationId: conversation1._id,
    direction: 'outbound',
    'metadata.automated': true,
  });
  assert(repliesAfter2 === repliesBefore2, 'No automatic reply sent because "Hello" does not match "hi" trigger');

  // --------------------------------------------------------------------
  // TEST 3: Customer sends "Hi" again -> Normal Automation Execution
  // --------------------------------------------------------------------
  console.log('\n--- TEST 3: Customer sends "Hi" again (New Normal Execution) ---');
  const wamid3 = `wamid_test_3_${Date.now()}`;
  await handleWebhookEvent(createMetaWebhookReq(wamid3, 'Hi there!'), mockRes);
  await new Promise((r) => setTimeout(r, 200));

  const incomingMsg3 = await Message.findOne({ whatsappMessageId: wamid3 });
  assert(incomingMsg3 !== null, 'Third message saved to MongoDB');

  const exec3 = await AutomationExecution.findOne({
    automationId: automation._id,
    'triggerData.whatsappMessageId': wamid3,
  });
  assert(exec3 !== null, 'Second automation execution recorded successfully');
  assert(exec3.status === 'completed', 'Second automation execution completed');

  // --------------------------------------------------------------------
  // TEST 4: Send exact same Meta webhook payload twice -> Idempotency Check
  // --------------------------------------------------------------------
  console.log('\n--- TEST 4: Duplicate Webhook Payload Protection (Idempotency) ---');
  const wamid4 = `wamid_duplicate_test_${Date.now()}`;

  // First delivery
  await handleWebhookEvent(createMetaWebhookReq(wamid4, 'Hi'), mockRes);
  await new Promise((r) => setTimeout(r, 200));

  const countMsgFirst = await Message.countDocuments({ whatsappMessageId: wamid4 });
  const countExecFirst = await AutomationExecution.countDocuments({ 'triggerData.whatsappMessageId': wamid4 });
  assert(countMsgFirst === 1, 'First webhook delivery saved 1 message record');
  assert(countExecFirst === 1, 'First webhook delivery created 1 execution record');

  // Second duplicate delivery with same message ID
  await handleWebhookEvent(createMetaWebhookReq(wamid4, 'Hi'), mockRes);
  await new Promise((r) => setTimeout(r, 200));

  const countMsgSecond = await Message.countDocuments({ whatsappMessageId: wamid4 });
  const countExecSecond = await AutomationExecution.countDocuments({ 'triggerData.whatsappMessageId': wamid4 });
  assert(countMsgSecond === 1, 'Duplicate webhook strictly ignored: Exactly 1 message record exists');
  assert(countExecSecond === 1, 'Duplicate webhook strictly ignored: Exactly 1 automation execution exists');

  // Clean up test data
  await Message.deleteMany({ conversationId: conversation1._id });
  await Conversation.deleteOne({ _id: conversation1._id });
  await Contact.deleteOne({ _id: contact1._id });
  await AutomationExecution.deleteMany({ automationId: automation._id });
  await Automation.deleteOne({ _id: automation._id });

  console.log('\n======================================================================');
  console.log('🎉 ALL 4 TESTS IN THE COMPLETE WHATSAPP FLOW PASSED WITH 100% SUCCESS!');
  console.log('======================================================================\n');
};

if (require.main === module) {
  const path = require('path');
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '../../.env') });
  dotenv.config({ path: path.join(__dirname, '../../../.env') });

  const connectDB = require('../config/database');
  connectDB()
    .then(runCompleteWhatsAppFlowTest)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runCompleteWhatsAppFlowTest;
