const mongoose = require('mongoose');
const { MessageTemplate, WhatsAppAccount } = require('../models');
const WhatsAppService = require('../services/whatsappService');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Builds Meta-compliant components array from template fields
 */
const buildMetaComponents = ({ header, body, footer, buttons, variables }) => {
  const components = [];

  // 1. Header Component
  if (header && header.type && header.type !== 'NONE') {
    const headerComp = {
      type: 'HEADER',
      format: header.type.toUpperCase(),
    };
    if (header.type === 'TEXT' && header.text) {
      headerComp.text = header.text;
      if (header.example) {
        headerComp.example = header.example;
      }
    } else if (header.example) {
      headerComp.example = header.example;
    }
    components.push(headerComp);
  }

  // 2. Body Component
  if (body) {
    const bodyComp = {
      type: 'BODY',
      text: body,
    };
    if (Array.isArray(variables) && variables.length > 0) {
      bodyComp.example = {
        body_text: [variables],
      };
    }
    components.push(bodyComp);
  }

  // 3. Footer Component
  if (footer && footer.trim()) {
    components.push({
      type: 'FOOTER',
      text: footer.trim(),
    });
  }

  // 4. Buttons Component
  if (Array.isArray(buttons) && buttons.length > 0) {
    const metaButtons = buttons.map((btn, idx) => {
      const btnObj = {
        type: btn.type || 'QUICK_REPLY',
        text: btn.text,
      };
      if (btn.type === 'URL' && btn.url) {
        btnObj.url = btn.url;
      } else if (btn.type === 'PHONE_NUMBER' && btn.phoneNumber) {
        btnObj.phone_number = btn.phoneNumber;
      }
      return btnObj;
    });

    components.push({
      type: 'BUTTONS',
      buttons: metaButtons,
    });
  }

  return components;
};

/**
 * Helper to resolve WhatsApp Account and credentials
 */
const resolveAccountCredentials = async (workspaceId) => {
  const account = await WhatsAppAccount.findOne({
    workspaceId,
    status: { $ne: 'disconnected' },
  });

  const businessAccountId = account?.businessAccountId || process.env.META_BUSINESS_ACCOUNT_ID;
  const accessToken = account?.accessTokenEncrypted || process.env.META_ACCESS_TOKEN;

  return { account, businessAccountId, accessToken };
};

/**
 * 1. Get All Templates in Workspace
 * GET /api/templates
 */
const getTemplates = async (req, res, next) => {
  try {
    const { category, status, search, page = 1, limit = 50 } = req.query;
    const query = { workspaceId: req.workspaceId };

    if (category && category !== 'all') {
      query.category = category.toUpperCase();
    }

    if (status && status !== 'all') {
      query.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { body: searchRegex }];
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (parsedPage - 1) * parsedLimit;

    const [total, templates] = await Promise.all([
      MessageTemplate.countDocuments(query),
      MessageTemplate.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
    ]);

    return sendSuccess(res, 'Templates retrieved successfully', {
      templates,
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
 * 2. Get Single Template
 * GET /api/templates/:id
 */
const getTemplateById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid template ID', 400);
    }

    const template = await MessageTemplate.findOne({
      _id: id,
      workspaceId: req.workspaceId,
    });

    if (!template) {
      return sendError(res, 'Template not found', 404);
    }

    return sendSuccess(res, 'Template retrieved', { template });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Create Template & Submit to Meta
 * POST /api/templates
 */
const createTemplate = async (req, res, next) => {
  try {
    const {
      name,
      category = 'MARKETING',
      language = 'en_US',
      header = { type: 'NONE', text: '' },
      body,
      footer = '',
      buttons = [],
      variables = [],
      status = 'PENDING',
    } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 'Template name is required', 400);
    }

    if (!body || !body.trim()) {
      return sendError(res, 'Template body text is required', 400);
    }

    const formattedName = name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');

    // Duplicate Check in Workspace
    const existing = await MessageTemplate.findOne({
      workspaceId: req.workspaceId,
      name: formattedName,
      language,
    });

    if (existing) {
      return sendError(
        res,
        `Template "${formattedName}" with language ${language} already exists in this workspace.`,
        400
      );
    }

    const components = buildMetaComponents({ header, body, footer, buttons, variables });

    // Submit to Meta API
    let metaTemplateId = null;
    let initialStatus = status === 'DRAFT' ? 'DRAFT' : 'PENDING';

    try {
      const { businessAccountId, accessToken } = await resolveAccountCredentials(req.workspaceId);
      if (businessAccountId && accessToken && status !== 'DRAFT') {
        const metaRes = await WhatsAppService.createTemplate({
          name: formattedName,
          category: category.toUpperCase(),
          language,
          components,
          businessAccountId,
          accessToken,
        });

        if (metaRes?.id) {
          metaTemplateId = metaRes.id;
          initialStatus = metaRes.status || 'PENDING';
        }
      }
    } catch (metaErr) {
      logger.warn(`[Template Submit Warning] Meta API error: ${metaErr.message}`);
      // If Meta rejected creation, capture initial status or error
      if (status !== 'DRAFT') {
        return sendError(res, metaErr.message, metaErr.status || 400, metaErr.metaDetails);
      }
    }

    const template = await MessageTemplate.create({
      workspaceId: req.workspaceId,
      name: formattedName,
      category: category.toUpperCase(),
      language,
      header: header || { type: 'NONE', text: '' },
      body: body.trim(),
      footer: footer ? footer.trim() : '',
      buttons: buttons || [],
      variables: variables || [],
      components,
      metaTemplateId: metaTemplateId || `tpl_${Date.now()}`,
      status: initialStatus,
    });

    return sendSuccess(res, 'Template created successfully', { template }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Update Template
 * PUT /api/templates/:id
 */
const updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category, language, header, body, footer, buttons, variables, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid template ID', 400);
    }

    const template = await MessageTemplate.findOne({
      _id: id,
      workspaceId: req.workspaceId,
    });

    if (!template) {
      return sendError(res, 'Template not found', 404);
    }

    if (category) template.category = category.toUpperCase();
    if (language) template.language = language;
    if (header !== undefined) template.header = header;
    if (body !== undefined) template.body = body.trim();
    if (footer !== undefined) template.footer = footer.trim();
    if (buttons !== undefined) template.buttons = buttons;
    if (variables !== undefined) template.variables = variables;
    if (status) template.status = status.toUpperCase();

    template.components = buildMetaComponents({
      header: template.header,
      body: template.body,
      footer: template.footer,
      buttons: template.buttons,
      variables: template.variables,
    });

    await template.save();

    return sendSuccess(res, 'Template updated successfully', { template });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Delete Template from MongoDB and Meta
 * DELETE /api/templates/:id
 */
const deleteTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid template ID', 400);
    }

    const template = await MessageTemplate.findOneAndDelete({
      _id: id,
      workspaceId: req.workspaceId,
    });

    if (!template) {
      return sendError(res, 'Template not found', 404);
    }

    // Attempt deletion on Meta
    try {
      const { businessAccountId, accessToken } = await resolveAccountCredentials(req.workspaceId);
      if (businessAccountId && accessToken && template.name) {
        await WhatsAppService.deleteTemplate({
          name: template.name,
          businessAccountId,
          accessToken,
        });
      }
    } catch (metaErr) {
      logger.warn(`[Template Delete Warning] Failed to delete on Meta: ${metaErr.message}`);
    }

    return sendSuccess(res, 'Template deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Synchronize Templates from Real Meta WhatsApp Business Account
 * POST /api/templates/sync
 */
const syncTemplates = async (req, res, next) => {
  try {
    const { businessAccountId, accessToken } = await resolveAccountCredentials(req.workspaceId);

    if (!businessAccountId || !accessToken) {
      return sendError(
        res,
        'Meta WhatsApp Business Account ID or Access Token is missing. Please configure credentials in Settings.',
        400
      );
    }

    let metaTemplatesData = [];
    try {
      const response = await WhatsAppService.getTemplates({
        businessAccountId,
        accessToken,
        limit: 100,
      });
      metaTemplatesData = response.data || [];
    } catch (metaErr) {
      return sendError(res, `Failed to sync with Meta Graph API: ${metaErr.message}`, 400);
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const remote of metaTemplatesData) {
      const name = String(remote.name || '').toLowerCase();
      const language = remote.language || 'en_US';
      const category = remote.category || 'MARKETING';
      const metaTemplateId = remote.id;
      const status = remote.status || 'PENDING';
      const rejectionReason = remote.rejected_reason || '';
      const components = remote.components || [];

      // Extract parts from components
      let header = { type: 'NONE', text: '' };
      let body = '';
      let footer = '';
      let buttons = [];

      for (const comp of components) {
        if (comp.type === 'HEADER') {
          header = {
            type: comp.format || 'TEXT',
            text: comp.text || '',
            example: comp.example || {},
          };
        } else if (comp.type === 'BODY') {
          body = comp.text || '';
        } else if (comp.type === 'FOOTER') {
          footer = comp.text || '';
        } else if (comp.type === 'BUTTONS') {
          buttons = (comp.buttons || []).map((b) => ({
            type: b.type || 'QUICK_REPLY',
            text: b.text || '',
            url: b.url || '',
            phoneNumber: b.phone_number || '',
          }));
        }
      }

      const existingDoc = await MessageTemplate.findOne({
        workspaceId: req.workspaceId,
        name,
        language,
      });

      if (existingDoc) {
        existingDoc.metaTemplateId = metaTemplateId;
        existingDoc.status = status;
        existingDoc.category = category;
        existingDoc.header = header;
        existingDoc.body = body || existingDoc.body;
        existingDoc.footer = footer;
        existingDoc.buttons = buttons;
        existingDoc.components = components;
        existingDoc.rejectionReason = rejectionReason;
        await existingDoc.save();
        updatedCount++;
      } else {
        await MessageTemplate.create({
          workspaceId: req.workspaceId,
          name,
          metaTemplateId,
          category,
          language,
          header,
          body: body || `[Template ${name}]`,
          footer,
          buttons,
          components,
          status,
          rejectionReason,
        });
        createdCount++;
      }
    }

    const allTemplates = await MessageTemplate.find({ workspaceId: req.workspaceId }).sort({ createdAt: -1 });

    return sendSuccess(res, `Templates synchronized: ${createdCount} added, ${updatedCount} updated.`, {
      syncedCount: metaTemplatesData.length,
      createdCount,
      updatedCount,
      templates: allTemplates,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  syncTemplates,
};
