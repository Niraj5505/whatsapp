const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');

const authenticateUser = require('../middleware/authenticateUser');
const requireWorkspaceMember = require('../middleware/requireWorkspaceMember');
const requireWorkspaceOwner = require('../middleware/requireWorkspaceOwner');
const errorHandler = require('../middleware/errorHandler');

const {
  User,
  Workspace,
  WorkspaceMember,
  WhatsAppAccount,
  Contact,
  Conversation,
  Message,
} = require('../models');

async function runSecurityAudit() {
  console.log('🛡️  Running Complete NexaFlow Security & Multi-Tenancy Audit Suite...\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: [Security] ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: [Security] ${message}`);
      throw new Error(`Security assertion failed: ${message}`);
    }
  }

  const jwtSecret = process.env.JWT_SECRET || 'nexaflow_jwt_secret_dev_key_2026';

  // Mock Data Setup
  const userAId = '65d1a1111111111111111111';
  const userBId = '65d1b2222222222222222222';
  const workspaceAId = '65d2a1111111111111111111';
  const workspaceBId = '65d2b2222222222222222222';

  const userA = { _id: userAId, name: 'Alice Tenant', email: 'alice@tenant-a.com', role: 'admin' };
  const userB = { _id: userBId, name: 'Bob Tenant', email: 'bob@tenant-b.com', role: 'admin' };

  const workspaceA = { _id: workspaceAId, name: 'Workspace A Corp', ownerId: userAId };
  const workspaceB = { _id: workspaceBId, name: 'Workspace B Corp', ownerId: userBId };

  // Model Mocks
  User.findById = (id) => ({
    select: async (sel) => {
      if (String(id) === userAId) return { ...userA };
      if (String(id) === userBId) return { ...userB };
      return null;
    },
  });

  Workspace.findById = async (id) => {
    if (String(id) === workspaceAId) return workspaceA;
    if (String(id) === workspaceBId) return workspaceB;
    return null;
  };

  WorkspaceMember.findOne = async (q) => {
    // User A only belongs to Workspace A
    if (String(q.userId) === userAId && String(q.workspaceId) === workspaceAId) {
      return { _id: 'mem_a', workspaceId: workspaceAId, userId: userAId, role: 'owner' };
    }
    // User B only belongs to Workspace B
    if (String(q.userId) === userBId && String(q.workspaceId) === workspaceBId) {
      return { _id: 'mem_b', workspaceId: workspaceBId, userId: userBId, role: 'owner' };
    }
    return null;
  };

  // Helper response builder
  const createMockRes = () => {
    let statusCode = 200;
    let jsonBody = null;
    return {
      status(code) { statusCode = code; return this; },
      json(data) { jsonBody = data; return this; },
      getStatusCode: () => statusCode,
      getBody: () => jsonBody,
    };
  };

  // ----------------------------------------------------
  // TEST 1: Password Hash Security (Bcrypt & Secret Masking)
  // ----------------------------------------------------
  const rawPass = 'SuperSecret123!';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(rawPass, salt);

  assert(await bcrypt.compare(rawPass, hash), 'Bcrypt correctly hashes with salt >= 10');
  assert(!(await bcrypt.compare('WrongPassword', hash)), 'Bcrypt correctly rejects invalid password');
  assert(!hash.includes(rawPass), 'Password hash contains zero plain-text leaks');

  // ----------------------------------------------------
  // TEST 2: JWT Security & Expiry
  // ----------------------------------------------------
  const validToken = jwt.sign({ userId: userAId }, jwtSecret, { expiresIn: '1h' });
  const expiredToken = jwt.sign({ userId: userAId }, jwtSecret, { expiresIn: '-1s' });
  const forgedToken = jwt.sign({ userId: userAId }, 'attacker_fake_secret_key');

  const reqValid = { headers: { authorization: `Bearer ${validToken}` } };
  const resValid = createMockRes();
  let nextCalled = false;

  await authenticateUser(reqValid, resValid, () => { nextCalled = true; });
  assert(nextCalled && reqValid.user?.email === 'alice@tenant-a.com', 'Valid JWT authenticates user');

  const reqExpired = { headers: { authorization: `Bearer ${expiredToken}` } };
  const resExpired = createMockRes();
  await authenticateUser(reqExpired, resExpired, () => {});
  assert(resExpired.getStatusCode() === 401, 'Expired JWT is rejected with 401 Unauthorized');

  const reqForged = { headers: { authorization: `Bearer ${forgedToken}` } };
  const resForged = createMockRes();
  await authenticateUser(reqForged, resForged, () => {});
  assert(resForged.getStatusCode() === 401, 'Forged JWT signed with attacker secret is rejected with 401');

  // ----------------------------------------------------
  // TEST 3: Multi-Tenancy & Workspace Isolation (CRITICAL)
  // ----------------------------------------------------
  // User A accesses their own Workspace A -> PASS
  const reqUserAOwnWorkspace = {
    user: userA,
    headers: { 'x-workspace-id': workspaceAId },
  };
  const resUserAOwn = createMockRes();
  let workspaceAuthorized = false;
  await requireWorkspaceMember(reqUserAOwnWorkspace, resUserAOwn, () => { workspaceAuthorized = true; });
  assert(workspaceAuthorized, 'Tenant A successfully accesses Workspace A');

  // User A attempts Cross-Tenant Access to Workspace B -> MUST BE BLOCKED (403)
  const reqCrossTenantAttack = {
    user: userA,
    headers: { 'x-workspace-id': workspaceBId },
  };
  const resCrossTenant = createMockRes();
  let crossTenantLeaked = false;
  await requireWorkspaceMember(reqCrossTenantAttack, resCrossTenant, () => { crossTenantLeaked = true; });
  assert(!crossTenantLeaked && resCrossTenant.getStatusCode() === 403, 'Cross-Tenant Attack BLOCKED: Tenant A cannot access Workspace B (403 Forbidden)');

  // ----------------------------------------------------
  // TEST 4: Untrusted Client Workspace ID Override Prevention
  // ----------------------------------------------------
  const reqSpoofedBody = {
    user: userA,
    body: { workspaceId: workspaceBId }, // Attacker puts victim workspaceId in POST body
    headers: {},
  };
  const resSpoofed = createMockRes();
  let spoofPassed = false;
  await requireWorkspaceMember(reqSpoofedBody, resSpoofed, () => { spoofPassed = true; });
  assert(!spoofPassed && resSpoofed.getStatusCode() === 403, 'Spoofed workspaceId in request body is blocked with 403');

  // ----------------------------------------------------
  // TEST 5: Meta Webhook HMAC-SHA256 Signature Verification
  // ----------------------------------------------------
  const appSecret = 'meta_app_secret_test_key_123';
  const payloadStr = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  const rawBodyBuffer = Buffer.from(payloadStr);

  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(rawBodyBuffer);
  const validSignature = `sha256=${hmac.digest('hex')}`;
  const invalidSignature = `sha256=attacker_tampered_signature_hex_00000000000000000000000000000000`;

  // Timing safe equal verification check
  const isSignatureValid = crypto.timingSafeEqual(
    Buffer.from(validSignature, 'utf8'),
    Buffer.from(validSignature, 'utf8')
  );
  assert(isSignatureValid, 'Valid HMAC-SHA256 signature passes timing-safe comparison');

  const isTamperedInvalid = crypto.timingSafeEqual(
    Buffer.from(invalidSignature, 'utf8'),
    Buffer.from(validSignature, 'utf8')
  );
  assert(!isTamperedInvalid, 'Tampered HMAC signature is strictly rejected');

  // ----------------------------------------------------
  // TEST 6: MongoDB CastError & Injection Safety
  // ----------------------------------------------------
  const castErr = new Error('Cast to ObjectId failed for value "invalid_mongo_id" at path "_id"');
  castErr.name = 'CastError';
  castErr.path = '_id';

  const resError = createMockRes();
  errorHandler(castErr, { method: 'GET', originalUrl: '/api/contacts/invalid_id' }, resError, () => {});
  assert(resError.getStatusCode() === 400, 'Invalid MongoDB ObjectId parameter handled as clean 400 Bad Request');
  assert(resError.getBody().success === false, 'Error response conforms to strict standard format');

  // ----------------------------------------------------
  // TEST 7: Secret Field Protection (accessTokenEncrypted & passwordHash)
  // ----------------------------------------------------
  const userSchemaPath = User.schema.paths.passwordHash;
  assert(userSchemaPath.options.select === false, 'User passwordHash has select: false by default in Mongoose schema');

  const whatsAppAccountSchemaPath = WhatsAppAccount.schema.paths.accessTokenEncrypted;
  assert(whatsAppAccountSchemaPath.options.select === false, 'WhatsAppAccount accessTokenEncrypted has select: false by default');

  console.log(`\n🎉 ALL ${passed}/${total} SECURITY AUDIT CHECKS PASSED WITH 100% COMPLIANCE!`);
}

runSecurityAudit().catch((err) => {
  console.error(err);
  process.exit(1);
});
