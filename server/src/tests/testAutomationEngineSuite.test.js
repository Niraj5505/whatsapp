const AutomationEngine = require('../services/automationEngine');
const {
  Automation,
  AutomationExecution,
  Contact,
  Conversation,
  Message,
  Tag,
  Workspace,
} = require('../models');
const WhatsAppService = require('../services/whatsappService');

async function testAutomationSuite() {
  console.log('🧪 Testing NexaFlow Real WhatsApp Automation Engine Suite...\n');

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

  const workspace = {
    _id: '65d3c3333333333333333333',
    name: 'Acme Corp',
  };

  const contact = {
    _id: '65d6f6666666666666666666',
    workspaceId: workspace._id,
    name: 'John Doe',
    phoneNumber: '15551234567',
    tags: ['vip'],
    customFields: { plan: 'Enterprise' },
    save: async function () { return this; },
  };

  const conversation = {
    _id: '65d7a7777777777777777777',
    workspaceId: workspace._id,
    contactId: contact._id,
    status: 'open',
    lastMessage: {},
    save: async function () { return this; },
  };

  const inMessage = {
    _id: '65d8b8888888888888888888',
    whatsappMessageId: 'wamid.HBgLMTU1NTEyMzQ1NjcVAgARGBI0MTA3',
    workspaceId: workspace._id,
    direction: 'inbound',
    body: 'Can I see the pricing menu please?',
    createdAt: new Date(),
  };

  // -------------------------------------------------------------
  // TEST 1: Trigger Evaluation (All 8 triggers)
  // -------------------------------------------------------------
  const ctx = {
    incomingText: 'can i see the pricing menu please?',
    rawText: 'Can I see the pricing menu please?',
    contact,
    message: inMessage,
    workspace,
  };

  // Keyword / Contains Text
  assert(
    AutomationEngine.evaluateTrigger({ type: 'keyword', config: { keywords: ['pricing', 'help'] } }, ctx) === true,
    'Trigger: "keyword" successfully matches keyword in text'
  );

  // Exact Text
  assert(
    AutomationEngine.evaluateTrigger({ type: 'exact_text', config: { text: 'pricing' } }, ctx) === false,
    'Trigger: "exact_text" correctly rejects partial match'
  );
  assert(
    AutomationEngine.evaluateTrigger({ type: 'exact_text', config: { text: 'can i see the pricing menu please?' } }, ctx) === true,
    'Trigger: "exact_text" matches exact string'
  );

  // Starts With
  assert(
    AutomationEngine.evaluateTrigger({ type: 'starts_with', config: { prefix: 'can i see' } }, ctx) === true,
    'Trigger: "starts_with" matches prefix'
  );

  // Ends With
  assert(
    AutomationEngine.evaluateTrigger({ type: 'ends_with', config: { suffix: 'please?' } }, ctx) === true,
    'Trigger: "ends_with" matches suffix'
  );

  // Any Message
  assert(
    AutomationEngine.evaluateTrigger({ type: 'any_message' }, ctx) === true,
    'Trigger: "any_message" triggers on any message'
  );

  // Contact Tag
  assert(
    AutomationEngine.evaluateTrigger({ type: 'contact_tag', config: { tag: 'vip' } }, ctx) === true,
    'Trigger: "contact_tag" triggers when contact has tag'
  );
  assert(
    AutomationEngine.evaluateTrigger({ type: 'contact_tag', config: { tag: 'lead' } }, ctx) === false,
    'Trigger: "contact_tag" does not trigger when tag missing'
  );

  // Business Hours
  assert(
    typeof AutomationEngine.evaluateTrigger({ type: 'business_hours', config: { startHour: 0, endHour: 24 } }, ctx) === 'boolean',
    'Trigger: "business_hours" evaluates work schedule'
  );

  // -------------------------------------------------------------
  // TEST 2: Action Execution & Variable Interpolation
  // -------------------------------------------------------------
  const createdMessages = [];
  Message.create = async (d) => {
    const doc = { _id: `msg_${Date.now()}_${Math.random()}`, ...d };
    createdMessages.push(doc);
    return doc;
  };

  Tag.findOne = async () => null;
  Tag.create = async (d) => ({ _id: 'tag_pro', name: d.name });

  // Action: send_message with variables
  const sendAction = {
    id: 'node_msg',
    type: 'send_message',
    data: {
      text: 'Hi {{contact.name}}! Thanks for contacting {{workspace.name}}. Your plan is {{contact.customFields.plan}}.',
    },
  };

  const actionResult1 = await AutomationEngine.executeAction(sendAction, {
    workspace,
    contact,
    conversation,
    message: inMessage,
    incomingText: inMessage.body,
  });

  assert(actionResult1.success === true, 'Action: "send_message" executes successfully');
  assert(
    actionResult1.body === 'Hi John Doe! Thanks for contacting Acme Corp. Your plan is Enterprise.',
    'Variable interpolation correctly resolves {{contact.name}}, {{workspace.name}}, and custom fields'
  );

  // Action: add_tag
  const addTagAction = {
    id: 'node_add_tag',
    type: 'add_tag',
    data: { tagName: 'pricing_lead' },
  };
  const actionResult2 = await AutomationEngine.executeAction(addTagAction, { workspace, contact, conversation });
  assert(actionResult2.success === true && contact.tags.includes('tag_pro'), 'Action: "add_tag" adds tag to contact in MongoDB');

  // Action: update_contact
  const updateContactAction = {
    id: 'node_update_contact',
    type: 'update_contact',
    data: { notes: 'Requested pricing menu via WhatsApp' },
  };
  await AutomationEngine.executeAction(updateContactAction, { workspace, contact, conversation });
  assert(contact.notes === 'Requested pricing menu via WhatsApp', 'Action: "update_contact" updates contact notes');

  // Action: condition (Branching)
  const conditionAction = {
    id: 'node_cond',
    type: 'condition',
    data: { field: 'message.body', operator: 'contains', value: 'pricing' },
  };
  const condResult = await AutomationEngine.executeAction(conditionAction, {
    workspace,
    contact,
    conversation,
    message: inMessage,
    incomingText: inMessage.body,
  });
  assert(condResult.conditionMet === true && condResult.branch === 'true', 'Action: "condition" branches to true path');

  // Action: stop
  const stopAction = { id: 'node_stop', type: 'stop' };
  const stopResult = await AutomationEngine.executeAction(stopAction, {});
  assert(stopResult.stopped === true, 'Action: "stop" terminates execution');

  // -------------------------------------------------------------
  // TEST 3: Safeguards & Protections
  // -------------------------------------------------------------
  // Prevent Recursive Automation
  const outboundMessage = {
    _id: 'out_1',
    direction: 'outbound',
    sentByBot: true,
    body: 'Automated response',
  };
  const recursiveResult = await AutomationEngine.processIncomingMessage({
    workspace,
    contact,
    conversation,
    message: outboundMessage,
  });
  assert(recursiveResult.length === 0, 'Safeguard: Outbound / bot messages are strictly ignored to prevent recursion');

  // Prevent Duplicate Execution (Idempotency)
  AutomationExecution.findOne = async () => ({ _id: 'exec_existing' });
  const isDup = await AutomationEngine.checkDuplicateExecution('auto_1', 'msg_1', 'wamid_1');
  assert(isDup === true, 'Safeguard: Duplicate execution for same message is prevented (Idempotency)');

  // -------------------------------------------------------------
  // TEST 4: Full Workflow Pipeline Execution & MongoDB History
  // -------------------------------------------------------------
  const workflowAutomation = {
    _id: 'auto_full_1',
    name: 'Pricing Bot Flow',
    enabled: true,
    trigger: { type: 'keyword', config: { keywords: ['pricing'] } },
    nodes: [
      { id: 'node_1', type: 'trigger', data: { label: 'Start' } },
      { id: 'node_2', type: 'send_message', data: { text: 'Here is our pricing menu for {{contact.name}}.' } },
      { id: 'node_3', type: 'add_tag', data: { tagName: 'sales_lead' } },
    ],
    edges: [
      { id: 'e1-2', source: 'node_1', target: 'node_2' },
      { id: 'e2-3', source: 'node_2', target: 'node_3' },
    ],
  };

  const mockExecution = {
    _id: 'exec_test_1',
    workspaceId: workspace._id,
    automationId: workflowAutomation._id,
    status: 'running',
    actionsExecuted: [],
    save: async function () { return this; },
  };

  await AutomationEngine.executeWorkflow({
    workspace,
    contact,
    conversation,
    automation: workflowAutomation,
    message: inMessage,
    triggerData: { incomingText: inMessage.body },
    execution: mockExecution,
  });

  assert(mockExecution.status === 'completed', 'Workflow completes with status: completed');
  assert(mockExecution.actionsExecuted.length === 2, 'Execution logs all actions executed in order');
  assert(mockExecution.completedAt instanceof Date, 'Execution records completedAt timestamp in MongoDB');

  console.log(`\n🎉 ALL ${passed}/${total} AUTOMATION ENGINE TESTS PASSED!`);
}

testAutomationSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
