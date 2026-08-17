const {
  getAutomations,
  getAutomationById,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  activateAutomation,
  deactivateAutomation,
  testAutomation,
  validateWorkflow,
} = require('../controllers/automationController');

const { Automation, AutomationExecution, Contact, Conversation, Message, Workspace } = require('../models');

async function testBuilderSuite() {
  console.log('🧪 Testing NexaFlow Visual Automation Builder API & Validation Suite...\n');

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
  const autoId = '65d9c9999999999999999999';

  // 1. Validation Test: Reject empty workflow
  const emptyVal = validateWorkflow({ nodes: [], edges: [] });
  assert(emptyVal.valid === false, 'Validation: Empty workflow rejected');

  // 2. Validation Test: Reject workflow without Trigger node
  const noTriggerVal = validateWorkflow({
    nodes: [{ id: 'n1', type: 'send_message', data: { text: 'Hello' } }],
    edges: [],
  });
  assert(noTriggerVal.valid === false, 'Validation: Workflow without Trigger node rejected');

  // 3. Validation Test: Reject Trigger with missing keywords
  const invalidTriggerVal = validateWorkflow({
    nodes: [
      { id: 'n1', type: 'trigger', data: { triggerType: 'keyword', keywords: [] } },
      { id: 'n2', type: 'send_message', data: { text: 'Hello' } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
  });
  assert(invalidTriggerVal.valid === false, 'Validation: Trigger with empty keywords rejected');

  // 4. Validation Test: Reject Send Message with empty body
  const emptyMsgVal = validateWorkflow({
    nodes: [
      { id: 'n1', type: 'trigger', data: { triggerType: 'keyword', keywords: ['hello'] } },
      { id: 'n2', type: 'send_message', data: { text: '' } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
  });
  assert(emptyMsgVal.valid === false, 'Validation: Send Message with empty text/media rejected');

  // 5. Validation Test: Valid complete workflow
  const validWorkflow = {
    _id: autoId,
    workspaceId,
    name: 'Lead Qualification Flow',
    enabled: false,
    nodes: [
      { id: 'node_1', type: 'trigger', data: { triggerType: 'keyword', keywords: ['pricing', 'help'] } },
      { id: 'node_2', type: 'condition', data: { field: 'message.body', operator: 'contains', value: 'pricing' } },
      { id: 'node_3', type: 'send_message', data: { text: 'Here are our pricing tiers {{contact.name}}!' } },
      { id: 'node_4', type: 'add_tag', data: { tagName: 'pricing_lead' } },
      { id: 'node_5', type: 'end', data: { label: 'End' } },
    ],
    edges: [
      { id: 'e1-2', source: 'node_1', target: 'node_2' },
      { id: 'e2-3', source: 'node_2', target: 'node_3', sourceHandle: 'true' },
      { id: 'e3-4', source: 'node_3', target: 'node_4' },
      { id: 'e4-5', source: 'node_4', target: 'node_5' },
    ],
    save: async function () { return this; },
  };

  const validResult = validateWorkflow(validWorkflow);
  assert(validResult.valid === true, 'Validation: Complete connected workflow passes validation');

  // Mock DB Operations
  Automation.findOne = async (q) => (q._id === autoId ? validWorkflow : null);
  Automation.find = () => ({ sort: async () => [validWorkflow] });
  Automation.create = async (d) => ({ _id: autoId, ...d });
  Automation.findOneAndUpdate = async (q, u) => ({ _id: autoId, ...validWorkflow, ...u.$set });
  Automation.findOneAndDelete = async () => validWorkflow;
  AutomationExecution.deleteMany = async () => ({});
  AutomationExecution.create = async (d) => ({ _id: 'exec_1', ...d, save: async () => {} });
  AutomationExecution.findById = async () => ({
    _id: 'exec_1',
    status: 'completed',
    actionsExecuted: [
      { nodeId: 'node_2', actionType: 'condition', output: { conditionMet: true } },
      { nodeId: 'node_3', actionType: 'send_message', output: { body: 'Here are our pricing tiers!' } },
    ],
  });
  Workspace.findById = async () => ({ _id: workspaceId, name: 'Acme Corp' });
  Contact.findOne = async () => ({
    _id: '65d6f6666666666666666666',
    name: 'Jane Doe',
    phoneNumber: '15551234567',
    tags: [],
    save: async () => {},
  });

  let resStatus = 200;
  let resData = null;
  const res = {
    status(c) { resStatus = c; return this; },
    json(d) { resData = d; return this; },
  };

  // TEST 6: POST /api/automations/:id/activate
  await activateAutomation({ workspaceId, params: { id: autoId } }, res, (e) => { if (e) throw e; });
  assert(resStatus === 200 && validWorkflow.enabled === true, 'POST /api/automations/:id/activate validates and activates workflow');

  // TEST 7: POST /api/automations/:id/deactivate
  await deactivateAutomation({ workspaceId, params: { id: autoId } }, res, (e) => { if (e) throw e; });
  assert(resStatus === 200 && validWorkflow.enabled === false, 'POST /api/automations/:id/deactivate pauses workflow');

  // TEST 8: POST /api/automations/:id/test (Simulation)
  const reqTest = {
    workspaceId,
    params: { id: autoId },
    body: { testMessage: 'Show pricing please' },
  };
  await testAutomation(reqTest, res, (e) => { if (e) throw e; });
  assert(resStatus === 200 && resData.data.status === 'completed', 'POST /api/automations/:id/test runs test simulation and returns step trace');

  console.log(`\n🎉 ALL ${passed}/${total} BUILDER & VALIDATION TESTS PASSED!`);
}

testBuilderSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
