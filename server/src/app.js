const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const contactRoutes = require('./routes/contactRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const flowRoutes = require('./routes/flowRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const templateRoutes = require('./routes/templateRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const messageRoutes = require('./routes/messageRoutes');
const automationRoutes = require('./routes/automationRoutes');

const { verifyWebhook, handleWebhookEvent } = require('./webhooks/whatsappWebhook');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

// Enable trust proxy for Vercel serverless reverse proxy
app.set('trust proxy', 1);

// Security & utility middlewares
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to all standard API routes
app.use('/api/', apiLimiter);

// ----------------------------------------------------
// Health Check Endpoint (Strictly formatted per Part 1)
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  const requiredMetaVars = [
    'META_ACCESS_TOKEN',
    'META_PHONE_NUMBER_ID',
    'META_BUSINESS_ACCOUNT_ID',
    'META_VERIFY_TOKEN',
  ];

  const missingMetaVars = requiredMetaVars.filter(
    (varName) => !process.env[varName] || !String(process.env[varName]).trim()
  );

  const isWhatsAppConfigured = missingMetaVars.length === 0;

  const responsePayload = {
    success: isDbConnected,
    server: 'running',
    database: isDbConnected ? 'connected' : 'disconnected',
    whatsapp: isWhatsAppConfigured ? 'configured' : 'missing_credentials',
  };

  if (!isWhatsAppConfigured) {
    responsePayload.missingVariables = missingMetaVars;
  }

  const statusCode = isDbConnected ? 200 : 503;
  return res.status(statusCode).json(responsePayload);
});

const testRoutes = require('./routes/testRoutes');

// ----------------------------------------------------
// Meta WhatsApp Cloud API Webhook Endpoints
// ----------------------------------------------------
app.get('/api/webhooks/whatsapp', verifyWebhook);
app.post('/api/webhooks/whatsapp', handleWebhookEvent);

// ----------------------------------------------------
// REST API Modules
// ----------------------------------------------------
app.use('/api/test', testRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/flows', flowRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/automations', automationRoutes);

// Fallback 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route ${req.originalUrl} not found`,
  });
});

// Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;
