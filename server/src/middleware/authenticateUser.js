const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendError } = require('../utils/response');

/**
 * Middleware to authenticate user via JWT
 */
const authenticateUser = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return sendError(res, 'Authentication required. No token provided.', 401);
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'nexaflow_jwt_secret_dev_key_2026';
    const decoded = jwt.verify(token, jwtSecret);

    const userId = decoded.id || decoded.userId;
    const user = await User.findById(userId).select('-passwordHash');

    if (!user) {
      return sendError(res, 'User session invalid. User not found.', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Session expired. Please log in again.', 401);
    }
    return sendError(res, 'Invalid token. Authentication failed.', 401);
  }
};

module.exports = authenticateUser;
