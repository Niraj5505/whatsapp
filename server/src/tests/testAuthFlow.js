require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  User,
  Workspace,
  WorkspaceMember,
} = require('../models');

const authenticateUser = require('../middleware/authenticateUser');
const requireWorkspaceMember = require('../middleware/requireWorkspaceMember');
const requireWorkspaceOwner = require('../middleware/requireWorkspaceOwner');

async function runTests() {
  console.log('🧪 Starting NexaFlow Authentication & Workspace Isolation Tests...\n');

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clean up test users from previous test runs if any
    const testEmail1 = `test_user_1_${Date.now()}@nexaflow.test`;
    const testEmail2 = `test_user_2_${Date.now()}@nexaflow.test`;
    const testPassword = 'Password123!';

    // TEST 1: Register Flow (User -> Workspace -> WorkspaceMember)
    console.log('\n--- TEST 1: User & Workspace Registration Flow ---');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(testPassword, salt);

    const user1 = await User.create({
      name: 'Test Admin One',
      email: testEmail1,
      passwordHash,
      role: 'admin',
      workspaceIds: [],
    });

    const workspace1 = await Workspace.create({
      name: "Admin One's Workspace",
      ownerId: user1._id,
      settings: { timezone: 'UTC' },
    });

    const member1 = await WorkspaceMember.create({
      workspaceId: workspace1._id,
      userId: user1._id,
      role: 'owner',
    });

    user1.workspaceIds.push(workspace1._id);
    await user1.save();

    console.log('✅ User 1 registered with ID:', user1._id.toString());
    console.log('✅ Workspace 1 created with ID:', workspace1._id.toString());
    console.log('✅ WorkspaceMember 1 created with role:', member1.role);

    // TEST 2: Password Verification & JWT Generation
    console.log('\n--- TEST 2: Password Verification & JWT Login ---');
    const fetchedUser = await User.findOne({ email: testEmail1 }).select('+passwordHash');
    const isMatch = await bcrypt.compare(testPassword, fetchedUser.passwordHash);
    const isWrongMatch = await bcrypt.compare('WrongPassword', fetchedUser.passwordHash);

    if (!isMatch || isWrongMatch) {
      throw new Error('Password hash comparison failed!');
    }
    console.log('✅ Password hash verification succeeded (correct: true, wrong: false)');

    const token1 = jwt.sign({ id: user1._id }, process.env.JWT_SECRET || 'nexaflow_jwt_secret_dev_key_2026', {
      expiresIn: '1d',
    });
    console.log('✅ Generated JWT token for User 1');

    // TEST 3: User 2 & Workspace 2 Registration (for Isolation Test)
    console.log('\n--- TEST 3: Register User 2 (Multi-tenancy Isolation Test) ---');
    const passwordHash2 = await bcrypt.hash(testPassword, salt);
    const user2 = await User.create({
      name: 'Test Admin Two',
      email: testEmail2,
      passwordHash: passwordHash2,
      role: 'admin',
      workspaceIds: [],
    });

    const workspace2 = await Workspace.create({
      name: "Admin Two's Workspace",
      ownerId: user2._id,
    });

    const member2 = await WorkspaceMember.create({
      workspaceId: workspace2._id,
      userId: user2._id,
      role: 'owner',
    });

    user2.workspaceIds.push(workspace2._id);
    await user2.save();

    const token2 = jwt.sign({ id: user2._id }, process.env.JWT_SECRET || 'nexaflow_jwt_secret_dev_key_2026', {
      expiresIn: '1d',
    });
    console.log('✅ User 2 registered with Workspace ID:', workspace2._id.toString());

    // TEST 4: Middleware - authenticateUser
    console.log('\n--- TEST 4: authenticateUser Middleware ---');
    const mockReq1 = {
      headers: { authorization: `Bearer ${token1}` },
    };
    const mockRes = {
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
    await authenticateUser(mockReq1, mockRes, () => {
      nextCalled = true;
    });

    if (!nextCalled || !mockReq1.user || mockReq1.user._id.toString() !== user1._id.toString()) {
      throw new Error('authenticateUser failed to populate req.user correctly');
    }
    console.log('✅ authenticateUser successfully authenticated user:', mockReq1.user.email);

    // TEST 5: Middleware - requireWorkspaceMember (Cross-Tenant Access Prevention)
    console.log('\n--- TEST 5: requireWorkspaceMember Security Check (Never Trust Untrusted workspaceId) ---');

    // Case A: User 1 accesses Workspace 1 (Valid)
    mockReq1.headers['x-workspace-id'] = workspace1._id.toString();
    nextCalled = false;
    await requireWorkspaceMember(mockReq1, mockRes, () => {
      nextCalled = true;
    });

    if (!nextCalled || mockReq1.workspace._id.toString() !== workspace1._id.toString()) {
      throw new Error('User 1 should have access to Workspace 1');
    }
    console.log('✅ Authorized access: User 1 accessed Workspace 1');

    // Case B: User 1 attempts to access Workspace 2 (Should be BLOCKED with 403)
    const mockReqCrossTenant = {
      user: user1,
      headers: { 'x-workspace-id': workspace2._id.toString() },
    };
    let crossTenantBlocked = false;
    const mockResCross = {
      status(code) {
        this.statusCode = code;
        if (code === 403) crossTenantBlocked = true;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };

    await requireWorkspaceMember(mockReqCrossTenant, mockResCross, () => {
      crossTenantBlocked = false;
    });

    if (!crossTenantBlocked) {
      throw new Error('SECURITY VIOLATION: User 1 was NOT blocked from accessing Workspace 2!');
    }
    console.log('🛡️ Cross-Tenant Isolation Verified: User 1 is blocked (403) from accessing Workspace 2');

    // TEST 6: requireWorkspaceOwner Check
    console.log('\n--- TEST 6: requireWorkspaceOwner Role Check ---');
    // Add user 2 as a standard 'member' to Workspace 1
    const memberInvited = await WorkspaceMember.create({
      workspaceId: workspace1._id,
      userId: user2._id,
      role: 'member',
    });

    const mockReqMemberOnly = {
      user: user2,
      headers: { 'x-workspace-id': workspace1._id.toString() },
    };
    let ownerAccessBlocked = false;
    const mockResOwner = {
      status(code) {
        this.statusCode = code;
        if (code === 403) ownerAccessBlocked = true;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };

    await requireWorkspaceOwner(mockReqMemberOnly, mockResOwner, () => {
      ownerAccessBlocked = false;
    });

    if (!ownerAccessBlocked) {
      throw new Error('SECURITY VIOLATION: Non-owner member was NOT blocked from owner actions!');
    }
    console.log('🛡️ requireWorkspaceOwner Verified: Regular member blocked from owner-only actions');

    // Clean up test documents
    await User.deleteMany({ _id: { $in: [user1._id, user2._id] } });
    await Workspace.deleteMany({ _id: { $in: [workspace1._id, workspace2._id] } });
    await WorkspaceMember.deleteMany({ _id: { $in: [member1._id, member2._id, memberInvited._id] } });

    console.log('\n🧹 Test documents cleaned up.');
    console.log('\n🎉 ALL AUTHENTICATION & MULTI-TENANCY TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
