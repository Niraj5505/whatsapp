const mongoose = require('mongoose');
const { Automation, AutomationExecution, Contact, Conversation, Message, Workspace } = require('../models');
const AutomationEngine = require('../services/automationEngine');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Validates Workflow structure and node configurations
 */
const validateWorkflow = (automation) => {
  const errors = [];
  const nodes = automation.nodes || [];
  const edges = automation.edges || [];

  if (nodes.length === 0) {
    errors.push('Workflow must contain at least one Trigger node.');
    return { valid: false, errors };
  }

  // 1. Check for Trigger Node
  const triggerNodes = nodes.filter((n) => (n.type || n.data?.type) === 'trigger');
  if (triggerNodes.length === 0) {
    errors.push('Workflow must contain at least one Trigger node.');
  }

  // 2. Validate Node Configurations
  for (const node of nodes) {
    const nodeType = (node.type || node.data?.type || '').toLowerCase().replace(/[\s-]+/g, '_');
    const data = node.data || {};
    const label = data.label || nodeType;

    if (nodeType === 'trigger') {
      const triggerType = (data.triggerType || automation.trigger?.type || 'keyword').toLowerCase();
      if (['keyword', 'contains_text', 'starts_with', 'ends_with', 'exact_text'].includes(triggerType)) {
        const kw = data.keywords || data.keyword || data.text || automation.trigger?.config?.keywords || automation.trigger?.config?.text;
        if (!kw || (Array.isArray(kw) && kw.length === 0) || (typeof kw === 'string' && !kw.trim())) {
          errors.push(`Trigger node "${label}" requires at least one keyword or text pattern.`);
        }
      }
    } else if (['send_message', 'reply_message'].includes(nodeType)) {
      if (!data.text && !data.messageText && !data.body && !data.mediaUrl) {
        errors.push(`Send Message node "${label}" requires message text or a media URL.`);
      }
    } else if (nodeType === 'send_template') {
      if (!data.templateName && !data.name) {
        errors.push(`Send Template node "${label}" requires a Meta template name.`);
      }
    } else if (['add_tag', 'remove_tag'].includes(nodeType)) {
      if (!data.tagName && !data.tag && !data.name) {
        errors.push(`Tag node "${label}" requires a tag name.`);
      }
    } else if (nodeType === 'condition') {
      if (!data.value && data.value !== 0 && typeof data.value !== 'string') {
        errors.push(`Condition node "${label}" requires a comparison value.`);
      }
    }
  }

  // 3. Check connectivity: Trigger must have at least one outgoing edge if more than 1 node exists
  if (triggerNodes.length > 0 && nodes.length > 1) {
    const hasOutgoingFromTrigger = edges.some((e) => triggerNodes.some((tn) => tn.id === e.source));
    if (!hasOutgoingFromTrigger) {
      errors.push('Trigger node is not connected to any downstream action nodes.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * 1. Get all automations in workspace
 * GET /api/automations
 */
const getAutomations = async (req, res, next) => {
  try {
    const automations = await Automation.find({ workspaceId: req.workspaceId }).sort({ createdAt: -1 });
    return sendSuccess(res, 'Automations retrieved', { automations });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get single automation
 * GET /api/automations/:id
 */
const getAutomationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid automation ID', 400);
    }

    const automation = await Automation.findOne({ _id: id, workspaceId: req.workspaceId });
    if (!automation) return sendError(res, 'Automation not found', 404);

    return sendSuccess(res, 'Automation retrieved', { automation });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Create automation
 * POST /api/automations
 */
const createAutomation = async (req, res, next) => {
  try {
    const { name, description, trigger, nodes, edges, enabled = false } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 'Automation name is required', 400);
    }

    const defaultNodes = [
      { id: 'node_1', type: 'trigger', data: { label: 'Start Trigger', triggerType: 'keyword', keywords: ['hello', 'help'] }, position: { x: 250, y: 50 } },
      { id: 'node_2', type: 'send_message', data: { label: 'Send Welcome Reply', text: 'Hello {{contact.name}}! Welcome to {{workspace.name}}.' }, position: { x: 250, y: 200 } },
      { id: 'node_3', type: 'end', data: { label: 'End Flow' }, position: { x: 250, y: 350 } },
    ];

    const defaultEdges = [
      { id: 'e1-2', source: 'node_1', target: 'node_2' },
      { id: 'e2-3', source: 'node_2', target: 'node_3' },
    ];

    const automation = await Automation.create({
      workspaceId: req.workspaceId,
      name: name.trim(),
      description: description || '',
      enabled: Boolean(enabled),
      trigger: trigger || { type: 'keyword', config: { keywords: ['hello', 'help'] } },
      nodes: nodes || defaultNodes,
      edges: edges || defaultEdges,
      createdBy: req.user._id,
    });

    return sendSuccess(res, 'Automation created successfully', { automation }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Update automation
 * PUT /api/automations/:id
 */
const updateAutomation = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid automation ID', 400);
    }

    const automation = await Automation.findOneAndUpdate(
      { _id: id, workspaceId: req.workspaceId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!automation) return sendError(res, 'Automation not found', 404);

    return sendSuccess(res, 'Automation updated successfully', { automation });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Delete automation
 * DELETE /api/automations/:id
 */
const deleteAutomation = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid automation ID', 400);
    }

    const automation = await Automation.findOneAndDelete({ _id: id, workspaceId: req.workspaceId });
    if (!automation) return sendError(res, 'Automation not found', 404);

    await AutomationExecution.deleteMany({ automationId: id });

    return sendSuccess(res, 'Automation deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Activate automation with validation
 * POST /api/automations/:id/activate
 */
const activateAutomation = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid automation ID', 400);
    }

    const automation = await Automation.findOne({ _id: id, workspaceId: req.workspaceId });
    if (!automation) return sendError(res, 'Automation not found', 404);

    // Validate workflow before activation
    const validation = validateWorkflow(automation);
    if (!validation.valid) {
      return sendError(
        res,
        `Cannot activate automation: ${validation.errors.join(' ')}`,
        400,
        { errors: validation.errors }
      );
    }

    automation.enabled = true;
    await automation.save();

    return sendSuccess(res, 'Automation activated successfully', { automation });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Deactivate automation
 * POST /api/automations/:id/deactivate
 */
const deactivateAutomation = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid automation ID', 400);
    }

    const automation = await Automation.findOne({ _id: id, workspaceId: req.workspaceId });
    if (!automation) return sendError(res, 'Automation not found', 404);

    automation.enabled = false;
    await automation.save();

    return sendSuccess(res, 'Automation deactivated', { automation });
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Test / Simulate workflow execution
 * POST /api/automations/:id/test
 */
const testAutomation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { testMessage = 'Hello, pricing info please', contactPhone = '+15551234567' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid automation ID', 400);
    }

    const automation = await Automation.findOne({ _id: id, workspaceId: req.workspaceId });
    if (!automation) return sendError(res, 'Automation not found', 404);

    // Validation check
    const validation = validateWorkflow(automation);
    if (!validation.valid) {
      return sendError(
        res,
        `Workflow configuration is invalid: ${validation.errors.join(' ')}`,
        400,
        { errors: validation.errors }
      );
    }

    const workspace = await Workspace.findById(req.workspaceId);

    // Create or find a test contact
    let contact = await Contact.findOne({ workspaceId: req.workspaceId });
    if (!contact) {
      contact = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Customer',
        phoneNumber: contactPhone.replace(/[^0-9]/g, ''),
        email: 'test@example.com',
        tags: [],
        customFields: { plan: 'Pro' },
        save: async () => {},
      };
    }

    const conversation = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId: req.workspaceId,
      contactId: contact._id,
      status: 'open',
      lastMessage: {},
      save: async () => {},
    };

    const simulatedMessage = {
      _id: new mongoose.Types.ObjectId(),
      whatsappMessageId: `test_wamid_${Date.now()}`,
      direction: 'inbound',
      body: testMessage,
      createdAt: new Date(),
    };

    // Create a test AutomationExecution in MongoDB
    const execution = await AutomationExecution.create({
      workspaceId: req.workspaceId,
      automationId: automation._id,
      conversationId: conversation._id,
      contactId: contact._id,
      triggerData: {
        isTest: true,
        incomingText: testMessage,
        messageId: simulatedMessage._id,
      },
      status: 'running',
      actionsExecuted: [],
      startedAt: new Date(),
    });

    // Execute the workflow
    await AutomationEngine.executeWorkflow({
      workspace,
      contact,
      conversation,
      automation,
      message: simulatedMessage,
      triggerData: { incomingText: testMessage },
      execution,
    });

    const populatedExecution = await AutomationExecution.findById(execution._id);

    return sendSuccess(res, 'Workflow test simulation completed', {
      execution: populatedExecution,
      stepsExecuted: populatedExecution?.actionsExecuted || [],
      status: populatedExecution?.status || 'completed',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 9. Get execution history for automation
 * GET /api/automations/:id/executions
 */
const getAutomationExecutions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid automation ID', 400);
    }

    const executions = await AutomationExecution.find({
      automationId: id,
      workspaceId: req.workspaceId,
    })
      .populate('contactId', 'name phoneNumber')
      .sort({ startedAt: -1 })
      .limit(parseInt(limit, 10));

    return sendSuccess(res, 'Executions retrieved', { executions });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAutomations,
  getAutomationById,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  activateAutomation,
  deactivateAutomation,
  testAutomation,
  getAutomationExecutions,
  validateWorkflow,
};
