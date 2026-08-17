const authenticateUser = require('./authenticateUser');
const requireWorkspaceMember = require('./requireWorkspaceMember');
const requireWorkspaceOwner = require('./requireWorkspaceOwner');
const { sendError } = require('../utils/response');

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, `User role '${req.user?.role}' is not authorized to access this route`, 403);
    }
    next();
  };
};

module.exports = {
  authenticateUser,
  protect: authenticateUser,
  requireWorkspaceMember,
  requireWorkspaceOwner,
  authorize,
};
