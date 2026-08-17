const mongoose = require('mongoose');
const {
  Campaign,
  CampaignRecipient,
  Contact,
  MessageTemplate,
  WhatsAppAccount,
} = require('../models');
const CampaignWorker = require('../services/campaignWorker');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * 1. Get All Campaigns in Workspace
 * GET /api/campaigns
 */
const getCampaigns = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = { workspaceId: req.workspaceId };

    if (status && status !== 'all') {
      query.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      query.name = new RegExp(search.trim(), 'i');
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const [total, campaigns] = await Promise.all([
      Campaign.countDocuments(query),
      Campaign.find(query)
        .populate('templateId')
        .populate('targetTags')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
    ]);

    return sendSuccess(res, 'Campaigns retrieved successfully', {
      campaigns,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get Single Campaign by ID
 * GET /api/campaigns/:id
 */
const getCampaignById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid campaign ID format', 400);
    }

    const campaign = await Campaign.findOne({
      _id: id,
      workspaceId: req.workspaceId,
    })
      .populate('templateId')
      .populate('targetTags')
      .populate('whatsappAccountId');

    if (!campaign) {
      return sendError(res, 'Campaign not found in this workspace', 404);
    }

    // Refresh dynamic statistics from recipient records
    const [queued, sent, delivered, read, failed, total] = await Promise.all([
      CampaignRecipient.countDocuments({ campaignId: campaign._id, status: 'queued' }),
      CampaignRecipient.countDocuments({ campaignId: campaign._id, status: 'sent' }),
      CampaignRecipient.countDocuments({ campaignId: campaign._id, status: 'delivered' }),
      CampaignRecipient.countDocuments({ campaignId: campaign._id, status: 'read' }),
      CampaignRecipient.countDocuments({ campaignId: campaign._id, status: 'failed' }),
      CampaignRecipient.countDocuments({ campaignId: campaign._id }),
    ]);

    campaign.statistics = {
      totalRecipients: total,
      queued,
      sent,
      delivered,
      read,
      failed,
    };

    return sendSuccess(res, 'Campaign details retrieved', { campaign });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get Campaign Recipients with Individual Statuses
 * GET /api/campaigns/:id/recipients
 */
const getCampaignRecipients = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid campaign ID format', 400);
    }

    const query = { campaignId: id, workspaceId: req.workspaceId };
    if (status && status !== 'all') {
      query.status = status.toLowerCase();
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (parsedPage - 1) * parsedLimit;

    const [total, recipients] = await Promise.all([
      CampaignRecipient.countDocuments(query),
      CampaignRecipient.find(query)
        .populate('contactId', 'name phoneNumber email')
        .sort({ sentAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
    ]);

    return sendSuccess(res, 'Recipients retrieved', {
      recipients,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Create Campaign with Target Contact Audience & Approved Template
 * POST /api/campaigns
 */
const createCampaign = async (req, res, next) => {
  try {
    const {
      name,
      whatsappAccountId,
      templateId,
      targetTags = [],
      scheduledAt = null,
      autoStart = false,
    } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 'Campaign name is required', 400);
    }

    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return sendError(res, 'A valid Meta template ID is required', 400);
    }

    // 1. Verify Template is APPROVED
    const template = await MessageTemplate.findOne({
      _id: templateId,
      workspaceId: req.workspaceId,
    });

    if (!template) {
      return sendError(res, 'Template not found in this workspace', 404);
    }

    if (template.status !== 'APPROVED') {
      return sendError(
        res,
        `Only Meta-approved templates can be used in campaigns (Current template status: ${template.status})`,
        400
      );
    }

    // 2. Query target audience (Respecting WhatsApp opt-out rules)
    const audienceQuery = {
      workspaceId: req.workspaceId,
      optedOut: { $ne: true }, // NEVER send to opted-out contacts
    };

    if (Array.isArray(targetTags) && targetTags.length > 0) {
      audienceQuery.tags = { $in: targetTags };
    }

    const contacts = await Contact.find(audienceQuery).select('_id phoneNumber name');

    if (contacts.length === 0) {
      return sendError(
        res,
        'No eligible subscribed contacts found matching the selected audience criteria/tags.',
        400
      );
    }

    const initialStatus = scheduledAt ? 'SCHEDULED' : autoStart ? 'PROCESSING' : 'DRAFT';

    // 3. Create Campaign Document
    const campaign = await Campaign.create({
      workspaceId: req.workspaceId,
      name: name.trim(),
      whatsappAccountId: whatsappAccountId || null,
      templateId: template._id,
      targetTags: targetTags || [],
      status: initialStatus,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      statistics: {
        totalRecipients: contacts.length,
        queued: contacts.length,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      },
      createdBy: req.user._id,
    });

    // 4. Batch Create CampaignRecipients (Prevent duplicate contacts)
    const recipientDocs = contacts.map((c) => ({
      workspaceId: req.workspaceId,
      campaignId: campaign._id,
      contactId: c._id,
      phoneNumber: c.phoneNumber,
      status: 'queued',
    }));

    await CampaignRecipient.insertMany(recipientDocs, { ordered: false });

    // 5. If autoStart is requested, trigger background job
    if (autoStart && !scheduledAt) {
      CampaignWorker.startBackgroundJob(campaign._id);
    }

    const populatedCampaign = await Campaign.findById(campaign._id)
      .populate('templateId')
      .populate('targetTags');

    return sendSuccess(
      res,
      `Campaign created with ${contacts.length} recipients queued for dispatch.`,
      { campaign: populatedCampaign },
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Start / Launch Campaign Dispatch Worker (Background Job)
 * POST /api/campaigns/:id/start
 */
const startCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid campaign ID format', 400);
    }

    const campaign = await Campaign.findOne({
      _id: id,
      workspaceId: req.workspaceId,
    }).populate('templateId');

    if (!campaign) {
      return sendError(res, 'Campaign not found in this workspace', 404);
    }

    if (campaign.templateId?.status !== 'APPROVED') {
      return sendError(
        res,
        `Cannot launch campaign: Template "${campaign.templateId?.name}" is not APPROVED by Meta.`,
        400
      );
    }

    if (['COMPLETED', 'completed'].includes(campaign.status)) {
      return sendError(res, 'Campaign has already completed.', 400);
    }

    campaign.status = 'PROCESSING';
    campaign.startedAt = campaign.startedAt || new Date();
    await campaign.save();

    // Trigger background processing worker asynchronously (returns HTTP response immediately)
    CampaignWorker.startBackgroundJob(campaign._id);

    return sendSuccess(
      res,
      'Campaign dispatch started in background. Monitor progress in real-time.',
      { campaign }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Pause Campaign
 * POST /api/campaigns/:id/pause
 */
const pauseCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findOneAndUpdate(
      { _id: id, workspaceId: req.workspaceId },
      { $set: { status: 'PAUSED' } },
      { new: true }
    );

    if (!campaign) return sendError(res, 'Campaign not found', 404);

    return sendSuccess(res, 'Campaign paused successfully', { campaign });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Cancel Campaign
 * POST /api/campaigns/:id/cancel
 */
const cancelCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findOneAndUpdate(
      { _id: id, workspaceId: req.workspaceId },
      { $set: { status: 'CANCELLED' } },
      { new: true }
    );

    if (!campaign) return sendError(res, 'Campaign not found', 404);

    return sendSuccess(res, 'Campaign cancelled', { campaign });
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Delete Campaign & Recipients
 * DELETE /api/campaigns/:id
 */
const deleteCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findOneAndDelete({
      _id: id,
      workspaceId: req.workspaceId,
    });

    if (!campaign) return sendError(res, 'Campaign not found', 404);

    await CampaignRecipient.deleteMany({ campaignId: id });

    return sendSuccess(res, 'Campaign and recipient logs deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCampaigns,
  getCampaignById,
  getCampaignRecipients,
  createCampaign,
  startCampaign,
  pauseCampaign,
  cancelCampaign,
  deleteCampaign,
};
