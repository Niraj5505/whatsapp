const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { WorkspaceMember } = require('../models');

let io = null;
const onlineUsers = new Map(); // userId -> Set of socketIds

const initSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
  });

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'nexaflow_jwt_secret_dev_key_2026');
      socket.userId = decoded.id || decoded.userId;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    logger.info(`[Socket] User connected: ${userId} (Socket: ${socket.id})`);

    // Add to user personal room
    socket.join(`user_${userId}`);

    // Join all workspace rooms the user belongs to
    try {
      const memberships = await WorkspaceMember.find({ userId });
      for (const m of memberships) {
        const room = `workspace_${m.workspaceId}`;
        socket.join(room);
        logger.debug(`[Socket] User ${userId} joined room ${room}`);
      }
    } catch (err) {
      logger.warn(`[Socket] Error joining workspace rooms: ${err.message}`);
    }

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Client requests to join a specific workspace or conversation room
    socket.on('join_workspace', (workspaceId) => {
      socket.join(`workspace_${workspaceId}`);
    });

    socket.on('join_conversation', (conversationId) => {
      socket.join(`conv_${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conv_${conversationId}`);
    });

    // Typing indicators
    socket.on('typing_start', ({ conversationId, userName, workspaceId }) => {
      if (workspaceId) {
        socket.to(`workspace_${workspaceId}`).emit('user_typing', {
          conversationId,
          userName,
          isTyping: true,
        });
      }
      socket.to(`conv_${conversationId}`).emit('user_typing', {
        conversationId,
        userName,
        isTyping: true,
      });
    });

    socket.on('typing_stop', ({ conversationId, workspaceId }) => {
      if (workspaceId) {
        socket.to(`workspace_${workspaceId}`).emit('user_typing', {
          conversationId,
          isTyping: false,
        });
      }
      socket.to(`conv_${conversationId}`).emit('user_typing', {
        conversationId,
        isTyping: false,
      });
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      logger.info(`[Socket] User disconnected: ${userId} (Socket: ${socket.id})`);
      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).delete(socket.id);
        if (onlineUsers.get(userId).size === 0) {
          onlineUsers.delete(userId);
        }
      }
    });
  });

  return io;
};

const getSocketIO = () => {
  return io;
};

module.exports = {
  initSocketIO,
  getSocketIO,
};
