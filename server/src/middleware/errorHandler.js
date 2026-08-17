const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  // Never log sensitive raw passwords or access tokens
  logger.error(`[API Error] ${req.method} ${req.originalUrl} - ${err.message}`);

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose CastError (Invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Resource not found or invalid identifier format for parameter: ${err.path}`;
  }

  // Handle Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
    message = `A resource with this '${field}' already exists in this workspace.`;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((val) => val.message)
      .join(', ');
  }

  // Handle JWT error
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session has expired. Please log in again.';
  }

  // Do not expose raw internal server error details in production
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'An unexpected internal error occurred. Please contact support.';
  }

  return sendError(res, message, statusCode);
};

module.exports = errorHandler;
