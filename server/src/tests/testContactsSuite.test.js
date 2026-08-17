const {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  importContacts,
  exportContacts,
} = require('../controllers/contactController');

const { Contact, Conversation, Message, Tag } = require('../models');

async function testContacts() {
  console.log('🧪 Testing NexaFlow Complete Contact Management Suite...\n');

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

  const workspaceA = '65d3c3333333333333333333';
  const workspaceB = '65d4d4444444444444444444';

  const mockDb = new Map();
  const mockTags = new Map();
  const mockConversations = new Map();
  const mockMessages = new Map();

  // Mocks
  Tag.findOne = async (q) => {
    for (const tag of mockTags.values()) {
      if (tag.workspaceId === q.workspaceId && tag.name.toLowerCase() === q.name.toLowerCase()) {
        return tag;
      }
    }
    return null;
  };
  Tag.create = async (d) => {
    const doc = { _id: `tag_${Date.now()}_${Math.random()}`, ...d };
    mockTags.set(doc._id, doc);
    return doc;
  };
  Tag.find = () => ({
    sort: async () => Array.from(mockTags.values()),
  });

  Contact.countDocuments = async (q) => {
    let count = 0;
    for (const c of mockDb.values()) {
      if (c.workspaceId === q.workspaceId) count++;
    }
    return count;
  };

  Contact.find = (q) => {
    let results = [];
    for (const c of mockDb.values()) {
      if (c.workspaceId === q.workspaceId) {
        if (q.$or) {
          const match = q.$or.some((condition) => {
            const field = Object.keys(condition)[0];
            const regex = condition[field];
            return regex.test(c[field] || '');
          });
          if (!match) continue;
        }
        results.push(c);
      }
    }
    const chain = {
      populate: () => chain,
      sort: () => chain,
      skip: () => chain,
      limit: async () => results,
      then: (resolve) => resolve(results),
    };
    return chain;
  };

  Contact.findOne = async (q) => {
    for (const c of mockDb.values()) {
      if (c.workspaceId === q.workspaceId) {
        if (q._id && String(q._id) === String(c._id)) return c;
        if (q.phoneNumber && q.phoneNumber === c.phoneNumber) return c;
        if (q.$or) {
          const match = q.$or.some((cond) => {
            const key = Object.keys(cond)[0];
            return c[key] === cond[key];
          });
          if (match) return c;
        }
      }
    }
    return null;
  };

  Contact.findById = (id) => ({
    populate: async () => mockDb.get(String(id)) || null,
  });

  Contact.create = async (d) => {
    const doc = {
      _id: '65d1a' + Math.random().toString(16).substring(2, 11).padEnd(19, '0'),
      ...d,
      save: async function () {
        mockDb.set(this._id, this);
        return this;
      },
    };
    mockDb.set(doc._id, doc);
    return doc;
  };

  Contact.findOneAndDelete = async (q) => {
    const found = await Contact.findOne(q);
    if (found) {
      mockDb.delete(found._id);
    }
    return found;
  };

  Conversation.findOneAndUpdate = async (q, update, opts) => {
    return { _id: 'conv_1', ...q };
  };
  Conversation.findOne = async () => null;
  Conversation.findOneAndDelete = async () => ({ _id: 'conv_1' });
  Message.find = () => ({ sort: () => ({ limit: async () => [] }) });
  Message.deleteMany = async () => ({});

  // TEST 1: Create Contact in Workspace A
  const reqCreate1 = {
    workspaceId: workspaceA,
    body: {
      phoneNumber: '+1 (555) 111-2233',
      name: 'Michael Scott',
      email: 'michael@dundermifflin.com',
      tags: ['VIP', 'Sales'],
      notes: 'Regional Manager',
      customFields: { Branch: 'Scranton' },
    },
  };
  let resStatus = 200;
  let resData = null;
  const res = {
    status(c) { resStatus = c; return this; },
    json(d) { resData = d; return this; },
  };

  await createContact(reqCreate1, res, (e) => { if (e) throw e; });
  assert(resStatus === 201, 'POST /api/contacts creates contact with 201 Created');
  assert(resData.data.contact.phoneNumber === '15551112233', 'Phone number normalized correctly');
  assert(resData.data.contact.customFields.Branch === 'Scranton', 'Custom fields saved correctly');

  // TEST 2: Duplicate Prevention in Same Workspace
  const reqDuplicate = {
    workspaceId: workspaceA,
    body: {
      phoneNumber: '15551112233',
      name: 'Michael Duplicate',
    },
  };
  await createContact(reqDuplicate, res, () => {});
  assert(resStatus === 400, 'Duplicate contact in same workspace rejected with 400 Bad Request');

  // TEST 3: Same Phone Number Allowed in Different Workspace (Multi-Tenant Isolation)
  const reqWorkspaceB = {
    workspaceId: workspaceB,
    body: {
      phoneNumber: '15551112233',
      name: 'Michael Tenant B',
    },
  };
  await createContact(reqWorkspaceB, res, (e) => { if (e) throw e; });
  assert(resStatus === 201, 'Same phone number permitted in different workspace (Multi-tenancy isolation)');

  // TEST 4: GET /api/contacts with search filter
  const reqGet = {
    workspaceId: workspaceA,
    query: { search: 'Michael' },
  };
  await getContacts(reqGet, res, (e) => { if (e) throw e; });
  assert(resData.data.contacts.length === 1, 'GET /api/contacts filters by search query');

  // TEST 5: CSV Import with Duplicate Filtering
  const reqImport = {
    workspaceId: workspaceA,
    body: {
      csvData: 'Phone,Name,Email,Tags\n+15551112233,Duplicate Person,dup@test.com,Lead\n+15559998877,Jim Halpert,jim@dundermifflin.com,Sales;Lead',
    },
  };
  await importContacts(reqImport, res, (e) => { if (e) throw e; });
  assert(resData.data.imported === 1 && resData.data.skipped === 1, 'CSV Import imports new contacts and skips duplicates');

  // TEST 6: CSV Export
  const reqExport = { workspaceId: workspaceA };
  let exportedCsv = '';
  let exportHeader = {};
  const resExport = {
    setHeader(k, v) { exportHeader[k] = v; },
    status(c) { this.statusCode = c; return this; },
    send(csv) { exportedCsv = csv; return this; },
  };

  await exportContacts(reqExport, resExport, (e) => { if (e) throw e; });
  assert(exportHeader['Content-Type'].includes('text/csv'), 'CSV Export sets Content-Type text/csv');
  assert(exportedCsv.includes('Michael Scott') && exportedCsv.includes('Jim Halpert'), 'CSV Export contains workspace contacts');

  // TEST 7: Delete Contact
  const contactToDelete = resData.data;
  const createdContactDoc = Array.from(mockDb.values()).find((c) => c.phoneNumber === '15559998877');
  const reqDelete = {
    workspaceId: workspaceA,
    params: { id: createdContactDoc._id },
  };
  await deleteContact(reqDelete, res, (e) => { if (e) throw e; });
  assert(resStatus === 200 && !mockDb.has(createdContactDoc._id), 'DELETE /api/contacts/:id removes contact');

  console.log(`\n🎉 ALL ${passed}/${total} CONTACT MANAGEMENT TESTS PASSED!`);
}

testContacts().catch((e) => {
  console.error(e);
  process.exit(1);
});
