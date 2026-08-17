const requireWorkspaceMember = require('./requireWorkspaceMember');
const { sendError } = require('../utils/response');

/**
 * Middleware to enforce that the authenticated user is the OWNER of the workspace.
 */
const requireWorkspaceOwner = async (req, res, next) => {
  // If workspace hasn't been loaded by requireWorkspaceMember yet, run it first
  if (!req.membership || !req.workspace) {
    return requireWorkspaceMember(req, res, () => {
      checkOwnerPrivileges(req, res, next);
    });
  }

  checkOwnerPrivileges(req, res, next);
};

const checkOwnerPrivileges = (req, res, next) => {
  const isOwnerByRole = req.membership && req.membership.role === 'owner';
  const isOwnerById =
    req.workspace &&
    req.workspace.ownerId &&
    req.workspace.ownerId.toString() === req.user._id.toString();

  if (!isOwnerByRole && !isOwnerById) {
    return sendError(
      res,
      'Access denied. This action requires workspace owner permissions.',
      403
    );
  }

  next();
};

module.exports = requireWorkspaceOwner;
