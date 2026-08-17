const {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  syncTemplates,
} = require('../controllers/templateController');

const { MessageTemplate, WhatsAppAccount } = require('../models');
const WhatsAppService = require('../services/whatsappService');

async function testTemplateSuite() {
  console.log('🧪 Testing NexaFlow Meta WhatsApp Template Management Suite...\n');

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
  const tplId = '65e1e1111111111111111111';

  const mockDb = new Map();

  MessageTemplate.countDocuments = async () => mockDb.size;
  MessageTemplate.find = (q) => ({
    sort: () => ({
      skip: () => ({
        limit: async () => Array.from(mockDb.values()),
      }),
      then: (res) => res(Array.from(mockDb.values())),
    }),
  });
  MessageTemplate.findOne = async (q) => {
    for (const t of mockDb.values()) {
      if (q._id && String(q._id) === String(t._id)) return t;
      if (q.name && q.name === t.name && q.language === t.language) return t;
    }
    return null;
  };
  MessageTemplate.create = async (d) => {
    const doc = {
      _id: '65e1e' + Math.random().toString(16).substring(2, 11).padEnd(19, '0'),
      ...d,
      save: async function () {
        mockDb.set(this._id, this);
        return this;
      },
    };
    mockDb.set(doc._id, doc);
    return doc;
  };
  MessageTemplate.findOneAndDelete = async (q) => {
    const found = await MessageTemplate.findOne(q);
    if (found) mockDb.delete(found._id);
    return found;
  };

  WhatsAppAccount.findOne = async () => ({
    _id: 'acc_1',
    businessAccountId: '1234567890',
    accessTokenEncrypted: 'mock_token',
  });

  // Mock Meta Service Template Calls
  const origCreate = WhatsAppService.createTemplate;
  const origGet = WhatsAppService.getTemplates;
  const origDelete = WhatsAppService.deleteTemplate;

  WhatsAppService.createTemplate = async () => ({
    id: 'meta_tpl_98765',
    status: 'PENDING',
    category: 'MARKETING',
  });

  WhatsAppService.getTemplates = async () => ({
    data: [
      {
        id: 'meta_tpl_98765',
        name: 'order_update_v1',
        status: 'APPROVED',
        category: 'UTILITY',
        language: 'en_US',
        components: [
          { type: 'HEADER', format: 'TEXT', text: 'Order Notice' },
          { type: 'BODY', text: 'Hello {{1}}, order #{{2}} is confirmed.' },
          { type: 'FOOTER', text: 'Thank you for choosing us.' },
          { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Track Order' }] },
        ],
      },
      {
        id: 'meta_tpl_54321',
        name: 'seasonal_sale_v2',
        status: 'REJECTED',
        category: 'MARKETING',
        language: 'en_US',
        rejected_reason: 'PROMOTIONAL_POLICY_VIOLATION',
        components: [
          { type: 'BODY', text: 'Flash sale 50% discount today only!' },
        ],
      },
    ],
  });

  WhatsAppService.deleteTemplate = async () => ({ success: true });

  let resStatus = 200;
  let resData = null;
  const res = {
    status(c) { resStatus = c; return this; },
    json(d) { resData = d; return this; },
  };

  try {
    // TEST 1: POST /api/templates (Create with {{1}}, {{2}} variables)
    const reqCreate = {
      workspaceId,
      body: {
        name: 'order_update_v1',
        category: 'UTILITY',
        language: 'en_US',
        header: { type: 'TEXT', text: 'Order Notice' },
        body: 'Hello {{1}}, order #{{2}} is confirmed.',
        footer: 'Thank you for choosing us.',
        buttons: [{ type: 'QUICK_REPLY', text: 'Track Order' }],
        variables: ['Alice', 'ORD-101'],
      },
    };

    await createTemplate(reqCreate, res, (e) => { if (e) throw e; });
    assert(resStatus === 201, 'POST /api/templates returns 201 Created');
    assert(resData.data.template.metaTemplateId === 'meta_tpl_98765', 'Template submitted to Meta and receives metaTemplateId');
    assert(resData.data.template.status === 'PENDING', 'Initial template status set to PENDING');
    assert(resData.data.template.components.length === 4, 'Meta components constructed correctly (Header, Body, Footer, Buttons)');

    // TEST 2: Duplicate Template Name Prevention
    await createTemplate(reqCreate, res, () => {});
    assert(resStatus === 400, 'Duplicate template name in same workspace rejected with 400 Bad Request');

    // TEST 3: GET /api/templates
    const reqGet = { workspaceId, query: { category: 'UTILITY' } };
    await getTemplates(reqGet, res, (e) => { if (e) throw e; });
    assert(resData.data.templates.length >= 1, 'GET /api/templates retrieves workspace templates');

    // TEST 4: POST /api/templates/sync (Sync Real Meta Statuses)
    const reqSync = { workspaceId };
    await syncTemplates(reqSync, res, (e) => { if (e) throw e; });
    assert(resStatus === 200, 'POST /api/templates/sync succeeds');

    const syncedApproved = Array.from(mockDb.values()).find((t) => t.name === 'order_update_v1');
    const syncedRejected = Array.from(mockDb.values()).find((t) => t.name === 'seasonal_sale_v2');

    assert(syncedApproved?.status === 'APPROVED', 'Sync updates template status to APPROVED from Meta');
    assert(syncedRejected?.status === 'REJECTED', 'Sync pulls new remote template with REJECTED status');
    assert(syncedRejected?.rejectionReason === 'PROMOTIONAL_POLICY_VIOLATION', 'Sync captures Meta rejection reason');

    // TEST 5: DELETE /api/templates/:id
    const reqDel = { workspaceId, params: { id: syncedRejected._id } };
    await deleteTemplate(reqDel, res, (e) => { if (e) throw e; });
    assert(resStatus === 200 && !mockDb.has(syncedRejected._id), 'DELETE /api/templates/:id removes template');

    console.log(`\n🎉 ALL ${passed}/${total} TEMPLATE MANAGEMENT TESTS PASSED!`);
  } finally {
    WhatsAppService.createTemplate = origCreate;
    WhatsAppService.getTemplates = origGet;
    WhatsAppService.deleteTemplate = origDelete;
  }
}

testTemplateSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
