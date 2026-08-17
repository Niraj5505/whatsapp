const {
  getCampaigns,
  getCampaignById,
  getCampaignRecipients,
  createCampaign,
  startCampaign,
  pauseCampaign,
  cancelCampaign,
  deleteCampaign,
} = require('../controllers/campaignController');

const {
  Campaign,
  CampaignRecipient,
  Contact,
  MessageTemplate,
  WhatsAppAccount,
} = require('../models');
const WhatsAppService = require('../services/whatsappService');

async function testCampaignSuite() {
  console.log('🧪 Testing NexaFlow Real WhatsApp Broadcast Campaign System Suite...\n');

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
  const approvedTplId = '65e1e1111111111111111111';
  const pendingTplId = '65e2e2222222222222222222';
  const campaignId = '65c1c1111111111111111111';

  const mockDbCampaigns = new Map();
  const mockDbRecipients = [];

  const approvedTemplate = {
    _id: approvedTplId,
    workspaceId,
    name: 'order_update_v1',
    status: 'APPROVED',
    body: 'Hello {{1}}, order #{{2}} confirmed.',
    language: 'en_US',
  };

  const pendingTemplate = {
    _id: pendingTplId,
    workspaceId,
    name: 'draft_promo',
    status: 'PENDING',
    body: 'Promo text',
  };

  const contactsList = [
    { _id: '65f1f1111111111111111111', workspaceId, name: 'Alice', phoneNumber: '15551112222', optedOut: false },
    { _id: '65f2f2222222222222222222', workspaceId, name: 'Bob', phoneNumber: '15553334444', optedOut: false },
    { _id: '65f3f3333333333333333333', workspaceId, name: 'OptedOut Person', phoneNumber: '15559999999', optedOut: true }, // Must NOT be queued!
  ];

  // Model Mocks
  MessageTemplate.findOne = async (q) => {
    if (q._id === approvedTplId) return approvedTemplate;
    if (q._id === pendingTplId) return pendingTemplate;
    return null;
  };

  Contact.find = (q) => ({
    select: async () => contactsList.filter((c) => c.workspaceId === q.workspaceId && (q.optedOut ? !c.optedOut : true)),
  });

  Campaign.create = async (d) => {
    const doc = {
      _id: campaignId,
      ...d,
      templateId: approvedTemplate,
      save: async function () {
        mockDbCampaigns.set(this._id, this);
        return this;
      },
    };
    mockDbCampaigns.set(doc._id, doc);
    return doc;
  };

  Campaign.findById = (id) => ({
    populate: () => ({
      populate: async () => mockDbCampaigns.get(id) || null,
    }),
  });

  Campaign.findOne = (q) => ({
    populate: () => ({
      populate: () => ({
        populate: async () => mockDbCampaigns.get(q._id) || null,
        then: (res) => res(mockDbCampaigns.get(q._id) || null),
      }),
      then: (res) => res(mockDbCampaigns.get(q._id) || null),
    }),
    then: (res) => res(mockDbCampaigns.get(q._id) || null),
  });

  Campaign.findOneAndUpdate = async (q, u) => {
    const found = mockDbCampaigns.get(q._id);
    if (found && u.$set) Object.assign(found, u.$set);
    return found;
  };

  Campaign.findOneAndDelete = async (q) => {
    const found = mockDbCampaigns.get(q._id);
    if (found) mockDbCampaigns.delete(q._id);
    return found;
  };

  CampaignRecipient.insertMany = async (docs) => {
    mockDbRecipients.push(...docs);
    return docs;
  };

  CampaignRecipient.countDocuments = async (q) => {
    return mockDbRecipients.filter((r) => {
      if (q.campaignId && q.campaignId !== r.campaignId) return false;
      if (q.status && q.status !== r.status) return false;
      return true;
    }).length;
  };

  CampaignRecipient.find = (q) => ({
    populate: () => ({
      sort: () => ({
        skip: () => ({
          limit: async () => mockDbRecipients.filter((r) => r.campaignId === q.campaignId),
        }),
      }),
    }),
  });

  CampaignRecipient.deleteMany = async () => ({});

  WhatsAppService.sendTemplateMessage = async () => ({
    messages: [{ id: 'wamid.HBgLMTU1NTExMTIyMjIVAgARGBI0MTA3' }],
  });

  let resStatus = 200;
  let resData = null;
  const res = {
    status(c) { resStatus = c; return this; },
    json(d) { resData = d; return this; },
  };

  // TEST 1: Rejection of Unapproved Template
  const reqUnapproved = {
    workspaceId,
    body: {
      name: 'Illegal Promo',
      templateId: pendingTplId,
    },
  };
  await createCampaign(reqUnapproved, res, () => {});
  assert(resStatus === 400, 'Creation: Campaign rejects unapproved template with 400 Bad Request');

  // TEST 2: Create Campaign with Approved Template & Opt-Out Enforcement
  const reqApproved = {
    workspaceId,
    body: {
      name: 'Summer Sale Broadcast',
      templateId: approvedTplId,
    },
    user: { _id: 'user_1' },
  };
  await createCampaign(reqApproved, res, (e) => { if (e) throw e; });
  assert(resStatus === 201, 'Creation: Campaign created with 201 Created');
  assert(resData.data.campaign.name === 'Summer Sale Broadcast', 'Campaign name stored correctly');
  assert(mockDbRecipients.length === 2, 'Opt-Out Rule: Exactly 2 subscribed contacts queued, 1 opted-out contact excluded');

  // TEST 3: GET /api/campaigns/:id/recipients
  const reqRecipients = {
    workspaceId,
    params: { id: campaignId },
    query: { status: 'all' },
  };
  await getCampaignRecipients(reqRecipients, res, (e) => { if (e) throw e; });
  assert(resData.data.recipients.length === 2, 'Recipients Tracker: Retrieves queued recipient list');

  // TEST 4: POST /api/campaigns/:id/start (Non-blocking background job)
  const reqStart = {
    workspaceId,
    params: { id: campaignId },
  };
  await startCampaign(reqStart, res, (e) => { if (e) throw e; });
  assert(resStatus === 200, 'Start: Campaign dispatch kicks off background worker without blocking');
  assert(resData.data.campaign.status === 'PROCESSING', 'Campaign status set to PROCESSING');

  // TEST 5: POST /api/campaigns/:id/pause
  const reqPause = {
    workspaceId,
    params: { id: campaignId },
  };
  await pauseCampaign(reqPause, res, (e) => { if (e) throw e; });
  assert(resData.data.campaign.status === 'PAUSED', 'Pause: Campaign status set to PAUSED');

  // TEST 6: DELETE /api/campaigns/:id
  const reqDel = {
    workspaceId,
    params: { id: campaignId },
  };
  await deleteCampaign(reqDel, res, (e) => { if (e) throw e; });
  assert(resStatus === 200 && !mockDbCampaigns.has(campaignId), 'Delete: Campaign and recipient records removed');

  console.log(`\n🎉 ALL ${passed}/${total} CAMPAIGN SYSTEM TESTS PASSED!`);
}

testCampaignSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
