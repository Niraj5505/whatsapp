const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');
const { sendSuccess, sendError } = require('../utils/response');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'nexaflow_jwt_secret_dev_key_2026', {
    expiresIn: '30d',
  });
};

/**
 * Register User & Workspace
 * POST /api/auth/register
 * 
 * Flow:
 * 1. Validate inputs
 * 2. Hash password with bcrypt
 * 3. Create User in MongoDB
 * 4. Create Workspace in MongoDB
 * 5. Create WorkspaceMember (role: 'owner')
 * 6. Authenticate user & issue JWT
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, workspaceName, companyName } = req.body;

    if (!name || !email || !password) {
      return sendError(res, 'Name, email, and password are required', 400);
    }

    if (password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return sendError(res, 'A user with this email already exists', 400);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create User
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'admin',
      workspaceIds: [],
    });

    // Create Workspace
    const defaultWorkspaceName = workspaceName || companyName || `${name.trim()}'s Workspace`;
    const workspace = await Workspace.create({
      name: defaultWorkspaceName.trim(),
      ownerId: user._id,
      settings: {
        timezone: 'UTC',
        currency: 'USD',
        autoReply: false,
      },
    });

    // Create WorkspaceMember as Owner
    const membership = await WorkspaceMember.create({
      workspaceId: workspace._id,
      userId: user._id,
      role: 'owner',
    });

    // Link workspace to user
    user.workspaceIds.push(workspace._id);
    await user.save();

    // Generate JWT
    const token = generateToken(user._id);

    return sendSuccess(
      res,
      'Registration successful',
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          workspaceIds: user.workspaceIds,
        },
        workspace: {
          id: workspace._id,
          name: workspace.name,
          ownerId: workspace.ownerId,
          role: 'owner',
        },
        workspaces: [
          {
            id: workspace._id,
            name: workspace.name,
            role: 'owner',
          },
        ],
        token,
      },
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Login User
 * POST /api/auth/login
 * 
 * Flow:
 * 1. Validate credentials
 * 2. Find User in MongoDB
 * 3. Compare bcrypt password
 * 4. Create JWT
 * 5. Return user, active workspace, memberships
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Please provide email and password', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Retrieve user's workspaces and memberships
    const memberships = await WorkspaceMember.find({ userId: user._id }).populate('workspaceId');

    const workspaces = memberships
      .filter((m) => m.workspaceId)
      .map((m) => ({
        id: m.workspaceId._id,
        name: m.workspaceId.name,
        role: m.role,
        settings: m.workspaceId.settings,
      }));

    const activeWorkspace = workspaces[0] || null;

    const token = generateToken(user._id);

    return sendSuccess(res, 'Login successful', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        workspaceIds: user.workspaceIds,
      },
      workspace: activeWorkspace,
      workspaces,
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout User
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  if (res.clearCookie) {
    res.clearCookie('token');
  }
  return sendSuccess(res, 'Logged out successfully', { success: true });
};

/**
 * Get Current Logged-in User & Active Workspace Details
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    const memberships = await WorkspaceMember.find({ userId: user._id }).populate('workspaceId');

    const workspaces = memberships
      .filter((m) => m.workspaceId)
      .map((m) => ({
        id: m.workspaceId._id,
        name: m.workspaceId.name,
        role: m.role,
        settings: m.workspaceId.settings,
      }));

    const activeWorkspace = workspaces[0] || null;

    return sendSuccess(res, 'User profile fetched', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        workspaceIds: user.workspaceIds,
      },
      workspace: activeWorkspace,
      workspaces,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
};
