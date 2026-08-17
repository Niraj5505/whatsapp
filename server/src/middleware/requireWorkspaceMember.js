const mongoose = require('mongoose');
const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');
const { sendError } = require('../utils/response');

/**
 * Middleware to verify that the authenticated user belongs to the requested workspace.
 * Strictly prevents Cross-Tenant attacks while auto-resolving workspace for general queries.
 */
const requireWorkspaceMember = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return sendError(res, 'Authentication required before workspace verification', 401);
    }

    // Extract workspaceId safely from headers, route params, query, or body
    let targetWorkspaceId =
      req.headers?.['x-workspace-id'] ||
      req.params?.workspaceId ||
      req.query?.workspaceId ||
      req.body?.workspaceId;

    let membership = null;

    if (targetWorkspaceId) {
      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(targetWorkspaceId)) {
        return sendError(res, 'Invalid workspace ID format', 400);
      }

      // Check membership in MongoDB for the explicitly requested workspace
      membership = await WorkspaceMember.findOne({
        workspaceId: targetWorkspaceId,
        userId: req.user._id,
      });

      if (!membership) {
        return sendError(
          res,
          'Access denied. You are not authorized to view or modify this workspace.',
          403
        );
      }
    } else {
      // No explicit workspace specified; resolve user's primary/first workspace
      membership = await WorkspaceMember.findOne({ userId: req.user._id }).sort({ createdAt: 1 });

      // Auto-heal: If user is owner of a workspace but missing WorkspaceMember record
      if (!membership) {
        const ownedWorkspace = await Workspace.findOne({ ownerId: req.user._id }).sort({ createdAt: 1 });
        if (ownedWorkspace) {
          membership = await WorkspaceMember.create({
            workspaceId: ownedWorkspace._id,
            userId: req.user._id,
            role: 'owner',
          });
        }
      }

      // Auto-provision default workspace if new user has none
      if (!membership) {
        const newWs = await Workspace.create({
          name: `${req.user.name || 'Personal'}'s Workspace`,
          ownerId: req.user._id,
          settings: { timezone: 'UTC', currency: 'USD', autoReply: false },
        });
        membership = await WorkspaceMember.create({
          workspaceId: newWs._id,
          userId: req.user._id,
          role: 'owner',
        });
        req.user.workspaceIds = [newWs._id];
        await req.user.save();
      }

      targetWorkspaceId = membership.workspaceId;
    }

    // Fetch verified workspace document
    const workspace = await Workspace.findById(targetWorkspaceId);
    if (!workspace) {
      return sendError(res, 'Workspace not found', 404);
    }

    // Attach validated workspace details to request
    req.workspaceId = workspace._id;
    req.workspace = workspace;
    req.membership = membership;

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = requireWorkspaceMember;
