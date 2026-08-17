const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const authenticateUser = require('../middleware/authenticateUser');
const requireWorkspaceMember = require('../middleware/requireWorkspaceMember');
const requireWorkspaceOwner = require('../middleware/requireWorkspaceOwner');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');

async function testUnitAuth() {
  console.log('🧪 Running Comprehensive Unit Tests for NexaFlow Auth & Multi-Tenancy Security...\n');

  const JWT_SECRET = process.env.JWT_SECRET || 'nexaflow_jwt_secret_dev_key_2026';
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, message) {
    totalCount++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Test Password Hashing and Comparison
  const rawPassword = 'Password_1234!';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(rawPassword, salt);
  assert(await bcrypt.compare(rawPassword, hash), 'Bcrypt correctly verifies valid password');
  assert(!(await bcrypt.compare('WrongPassword!', hash)), 'Bcrypt correctly rejects invalid password');

  // 2. Test JWT Signing and Verification
  const mockUserId = '65d1a1111111111111111111';
  const token = jwt.sign({ id: mockUserId }, JWT_SECRET, { expiresIn: '1h' });
  const decoded = jwt.verify(token, JWT_SECRET);
  assert(decoded.id === mockUserId, 'JWT payload correctly preserves userId');

  // 3. Test authenticateUser Middleware with Missing Token
  const reqNoToken = { headers: {} };
  const resNoToken = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
  let nextCalled = false;
  await authenticateUser(reqNoToken, resNoToken, () => { nextCalled = true; });
  assert(resNoToken.statusCode === 401 && !nextCalled, 'authenticateUser rejects missing token with 401');

  // 4. Test authenticateUser Middleware with Invalid Token
  const reqBadToken = { headers: { authorization: 'Bearer invalid.token.value' } };
  const resBadToken = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
  nextCalled = false;
  await authenticateUser(reqBadToken, resBadToken, () => { nextCalled = true; });
  assert(resBadToken.statusCode === 401 && !nextCalled, 'authenticateUser rejects invalid token with 401');

  // 5. Test requireWorkspaceMember Middleware Isolation
  // Simulate mock database query responses for isolation testing
  const originalFindMember = WorkspaceMember.findOne;
  const originalFindWorkspace = Workspace.findById;

  const tenantA_UserId = '65d1a1111111111111111111';
  const tenantB_UserId = '65d2b2222222222222222222';
  const workspaceA_Id = '65d3c3333333333333333333';
  const workspaceB_Id = '65d4d4444444444444444444';

  WorkspaceMember.findOne = async (query) => {
    if (
      query.workspaceId?.toString() === workspaceA_Id &&
      query.userId?.toString() === tenantA_UserId
    ) {
      return { workspaceId: workspaceA_Id, userId: tenantA_UserId, role: 'owner' };
    }
    if (
      query.workspaceId?.toString() === workspaceB_Id &&
      query.userId?.toString() === tenantB_UserId
    ) {
      return { workspaceId: workspaceB_Id, userId: tenantB_UserId, role: 'owner' };
    }
    return null;
  };

  Workspace.findById = async (id) => {
    if (id.toString() === workspaceA_Id) {
      return { _id: workspaceA_Id, name: 'Tenant A Workspace', ownerId: tenantA_UserId };
    }
    if (id.toString() === workspaceB_Id) {
      return { _id: workspaceB_Id, name: 'Tenant B Workspace', ownerId: tenantB_UserId };
    }
    return null;
  };

  // Test 5A: Tenant A accesses their own Workspace A
  const reqTenantA_Own = {
    user: { _id: tenantA_UserId },
    headers: { 'x-workspace-id': workspaceA_Id },
  };
  const resTenantA_Own = {
    status(c) { this.statusCode = c; return this; },
    json(d) { this.data = d; return this; },
  };
  nextCalled = false;
  await requireWorkspaceMember(reqTenantA_Own, resTenantA_Own, () => { nextCalled = true; });
  assert(nextCalled && reqTenantA_Own.workspaceId.toString() === workspaceA_Id, 'Tenant A successfully accesses Workspace A');

  // Test 5B: Tenant A attempts to access Tenant B's Workspace B (Cross-Tenant Attack)
  const reqTenantA_Attacks_B = {
    user: { _id: tenantA_UserId },
    headers: { 'x-workspace-id': workspaceB_Id },
  };
  const resTenantA_Attacks_B = {
    status(c) { this.statusCode = c; return this; },
    json(d) { this.data = d; return this; },
  };
  nextCalled = false;
  await requireWorkspaceMember(reqTenantA_Attacks_B, resTenantA_Attacks_B, () => { nextCalled = true; });
  assert(resTenantA_Attacks_B.statusCode === 403 && !nextCalled, 'Cross-Tenant Attack BLOCKED: Tenant A cannot access Workspace B (403 Forbidden)');

  // 6. Test requireWorkspaceOwner Middleware
  // Owner case
  const reqOwner = {
    user: { _id: tenantA_UserId },
    workspace: { _id: workspaceA_Id, ownerId: tenantA_UserId },
    membership: { role: 'owner' },
  };
  nextCalled = false;
  await requireWorkspaceOwner(reqOwner, {}, () => { nextCalled = true; });
  assert(nextCalled, 'requireWorkspaceOwner allows authorized workspace owner');

  // Member-only case
  const reqMemberOnly = {
    user: { _id: tenantB_UserId },
    workspace: { _id: workspaceA_Id, ownerId: tenantA_UserId },
    membership: { role: 'member' },
  };
  const resMemberOnly = {
    status(c) { this.statusCode = c; return this; },
    json(d) { this.data = d; return this; },
  };
  nextCalled = false;
  await requireWorkspaceOwner(reqMemberOnly, resMemberOnly, () => { nextCalled = true; });
  assert(resMemberOnly.statusCode === 403 && !nextCalled, 'requireWorkspaceOwner blocks non-owner member with 403');

  // Restore mocks
  WorkspaceMember.findOne = originalFindMember;
  Workspace.findById = originalFindWorkspace;

  console.log(`\n🎉 ALL ${passedCount}/${totalCount} UNIT & SECURITY TESTS PASSED!`);
}

testUnitAuth().catch((err) => {
  console.error(err);
  process.exit(1);
});
