const mongoose = require('mongoose');
const {
  Automation,
  AutomationExecution,
  Contact,
  Conversation,
  Message,
  Tag,
  User,
} = require('../models');
const WhatsAppService = require('./whatsappService');
const { getSocketIO } = require('../sockets/socketServer');
const logger = require('../utils/logger');

const MAX_EXECUTION_STEPS = 50;

/**
 * Variable Interpolation:
 * Replaces {{contact.name}}, {{contact.phoneNumber}}, {{message.body}}, {{workspace.name}}, etc.
 */
const interpolateVariables = (templateStr, context = {}) => {
  if (!templateStr || typeof templateStr !== 'string') return templateStr || '';
  const { contact = {}, message = {}, workspace = {}, incomingText = '' } = context;

  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, rawPath) => {
    const parts = rawPath.split('.');
    const root = parts[0];

    if (root === 'contact') {
      if (parts[1] === 'name') return contact.name || contact.phoneNumber || '';
      if (parts[1] === 'phoneNumber' || parts[1] === 'phone') return contact.phoneNumber || '';
      if (parts[1] === 'email') return contact.email || '';
      if ((parts[1] === 'customFields' || parts[1] === 'custom') && parts[2]) {
        return contact.customFields?.[parts[2]] || '';
      }
      return contact[parts[1]] !== undefined ? String(contact[parts[1]]) : '';
    }

    if (root === 'message') {
      if (parts[1] === 'body' || parts[1] === 'text' || parts[1] === 'content') {
        return message.body || incomingText || '';
      }
      return message[parts[1]] !== undefined ? String(message[parts[1]]) : '';
    }

    if (root === 'workspace') {
      if (parts[1] === 'name') return workspace.name || '';
      return workspace[parts[1]] !== undefined ? String(workspace[parts[1]]) : '';
    }

    return match;
  });
};

/**
 * Real WhatsApp Automation Engine
 */
class AutomationEngine {
  static async processIncoming(params) {
    return this.processIncomingMessage(params);
  }

  /**
   * 1. Process Incoming WhatsApp Message against enabled workspace automations
   */
  static async processIncomingMessage({
    workspace,
    account,
    contact,
    conversation,
    message,
    incomingText,
    interactiveData,
  }) {
    // Prevent Recursive Automation: Never process outbound or bot-generated messages
    if (!message || message.direction === 'outbound' || message.sentByBot || message.metadata?.automated) {
      return [];
    }

    if (!workspace || !conversation || !contact) {
      return [];
    }

    const cleanText = (incomingText || message.body || '').trim().toLowerCase();
    const rawText = incomingText || message.body || '';

    const executionResults = [];

    try {
      // Find all enabled automations for this workspace
      const automations = await Automation.find({
        workspaceId: workspace._id,
        enabled: true,
      });

      if (!automations || automations.length === 0) {
        return [];
      }

      for (const automation of automations) {
        // Prevent Duplicate Execution: Check if already executed for this message
        const isDuplicate = await this.checkDuplicateExecution(automation._id, message._id, message.whatsappMessageId);
        if (isDuplicate) {
          logger.info(`[AutomationEngine] Skipping duplicate execution for automation ${automation.name} on message ${message._id}`);
          continue;
        }

        // Evaluate Trigger
        logger.info(`[AUTOMATION] Trigger evaluated for "${automation.name}"`);
        const isMatch = this.evaluateTrigger(automation.trigger, {
          incomingText: cleanText,
          rawText,
          contact,
          message,
          interactiveData,
          workspace,
        });

        if (isMatch) {
          logger.info(`[AUTOMATION] Trigger matched for "${automation.name}" (ID: ${automation._id})`);

          // Create AutomationExecution in MongoDB
          const execution = await AutomationExecution.create({
            workspaceId: workspace._id,
            automationId: automation._id,
            conversationId: conversation._id,
            contactId: contact._id,
            triggerData: {
              incomingText: rawText,
              messageId: message._id,
              whatsappMessageId: message.whatsappMessageId,
              interactiveData,
              triggerType: automation.trigger?.type,
            },
            status: 'running',
            actionsExecuted: [],
            startedAt: new Date(),
          });

          // Execute Workflow Nodes
          await this.executeWorkflow({
            workspace,
            account,
            contact,
            conversation,
            automation,
            message,
            triggerData: { incomingText: rawText, interactiveData },
            execution,
          });

          // Emit Socket.IO automation:executed event
          const io = getSocketIO();
          if (io) {
            io.to(`workspace_${workspace._id}`).emit('automation:executed', {
              automationId: automation._id,
              automationName: automation.name,
              executionId: execution._id,
              status: execution.status,
              conversationId: conversation._id,
              contactId: contact._id,
            });
          }

          executionResults.push(execution);
        }
      }
    } catch (err) {
      logger.error(`[AutomationEngine Error] ${err.message}`, err.stack);
    }

    return executionResults;
  }

  /**
   * Check if an execution already occurred for this message & automation
   */
  static async checkDuplicateExecution(automationId, messageId, whatsappMessageId) {
    if (!messageId && !whatsappMessageId) return false;
    const query = {
      automationId,
      $or: [],
    };
    if (messageId) query.$or.push({ 'triggerData.messageId': messageId });
    if (whatsappMessageId) query.$or.push({ 'triggerData.whatsappMessageId': whatsappMessageId });

    if (query.$or.length === 0) return false;

    const existing = await AutomationExecution.findOne(query);
    return Boolean(existing);
  }

  /**
   * 2. Evaluate Trigger criteria against context
   * 
   * Supported Triggers:
   * - keyword
   * - exact text
   * - contains text
   * - starts with
   * - ends with
   * - any message
   * - contact tag
   * - business hours
   */
  static evaluateTrigger(trigger, context = {}) {
    if (!trigger) return false;
    const { type, config = {} } = trigger;
    const normalizedType = String(type).toLowerCase().replace(/[\s-]+/g, '_');
    const text = (context.incomingText || '').trim();
    const raw = (context.rawText || '').trim();
    const contact = context.contact || {};

    switch (normalizedType) {
      case 'any_message':
      case 'message_received':
      case 'all':
        return true;

      case 'keyword':
      case 'contains_text':
      case 'contains': {
        const keywords = Array.isArray(config.keywords)
          ? config.keywords
          : config.keyword
          ? [config.keyword]
          : config.text
          ? [config.text]
          : [];
        if (keywords.length === 0) return false;
        return keywords.some((kw) => text.includes(String(kw).toLowerCase().trim()));
      }

      case 'exact_text':
      case 'exact_match': {
        const expected = String(config.text || config.keyword || config.value || '').toLowerCase().trim();
        if (!expected) return false;
        return text === expected;
      }

      case 'starts_with': {
        const prefix = String(config.prefix || config.text || config.keyword || '').toLowerCase().trim();
        if (!prefix) return false;
        return text.startsWith(prefix);
      }

      case 'ends_with': {
        const suffix = String(config.suffix || config.text || config.keyword || '').toLowerCase().trim();
        if (!suffix) return false;
        return text.endsWith(suffix);
      }

      case 'contact_tag':
      case 'has_tag': {
        const requiredTag = String(config.tag || config.tagName || config.tagId || '').toLowerCase().trim();
        if (!requiredTag) return false;
        const contactTags = (contact.tags || []).map((t) =>
          (typeof t === 'object' && t.name ? t.name : String(t)).toLowerCase().trim()
        );
        return contactTags.includes(requiredTag);
      }

      case 'business_hours': {
        const now = new Date();
        const startHour = config.startHour !== undefined ? parseInt(config.startHour, 10) : 9; // e.g. 9 AM
        const endHour = config.endHour !== undefined ? parseInt(config.endHour, 10) : 18;     // e.g. 6 PM
        const workDays = Array.isArray(config.days) ? config.days : [1, 2, 3, 4, 5];         // Mon-Fri

        const currentDay = now.getDay();
        const currentHour = now.getHours();

        const isWorkDay = workDays.includes(currentDay);
        const isDuringHours = currentHour >= startHour && currentHour < endHour;
        const isWithinBusinessHours = isWorkDay && isDuringHours;

        if (config.match === 'outside') {
          return !isWithinBusinessHours;
        }
        return isWithinBusinessHours;
      }

      default:
        // Fallback check for custom keyword property
        if (config.keywords && Array.isArray(config.keywords)) {
          return config.keywords.some((kw) => text.includes(String(kw).toLowerCase().trim()));
        }
        return false;
    }
  }

  /**
   * 3. Execute a Single Action Node
   * 
   * Supported Actions:
   * - send message
   * - send template
   * - add tag
   * - remove tag
   * - update contact
   * - assign conversation
   * - delay
   * - condition
   * - stop
   */
  static async executeAction(actionNode, context = {}) {
    const { workspace, account, contact, conversation, message, incomingText } = context;
    const nodeType = (actionNode.type || actionNode.data?.type || '').toLowerCase().replace(/[\s-]+/g, '_');
    const nodeData = actionNode.data || {};

    const interpolationContext = {
      contact,
      message,
      workspace,
      incomingText,
    };

    const phoneNumberId = account?.phoneNumberId || process.env.META_PHONE_NUMBER_ID;
    const accessToken = account?.accessTokenEncrypted || process.env.META_ACCESS_TOKEN;

    switch (nodeType) {
      // 1. Send Message Action
      case 'send_message':
      case 'reply_message':
      case 'reply_text': {
        const rawBody = nodeData.text || nodeData.messageText || nodeData.body || 'Hello! Thank you for reaching out.';
        const interpolatedText = interpolateVariables(rawBody, interpolationContext);
        const mediaUrl = nodeData.mediaUrl || '';
        const caption = interpolateVariables(nodeData.caption || '', interpolationContext);
        const messageType = (nodeData.mediaType || (mediaUrl ? 'image' : 'text')).toLowerCase();

        let metaRes = null;
        if (phoneNumberId && accessToken && contact.phoneNumber) {
          try {
            if (messageType === 'text') {
              metaRes = await WhatsAppService.sendTextMessage({
                to: contact.phoneNumber,
                text: interpolatedText,
                phoneNumberId,
                accessToken,
              });
            } else if (messageType === 'image') {
              metaRes = await WhatsAppService.sendImageMessage({
                to: contact.phoneNumber,
                imageUrl: mediaUrl,
                caption: caption || interpolatedText,
                phoneNumberId,
                accessToken,
              });
            } else if (messageType === 'document') {
              metaRes = await WhatsAppService.sendDocumentMessage({
                to: contact.phoneNumber,
                documentUrl: mediaUrl,
                filename: nodeData.filename || 'Document.pdf',
                caption: caption || interpolatedText,
                phoneNumberId,
                accessToken,
              });
            }
          } catch (err) {
            logger.warn(`[AutomationEngine] Could not dispatch WhatsApp message via Meta API: ${err.message}`);
          }
        }

        const replyMsg = await Message.create({
          workspaceId: workspace._id,
          conversationId: conversation._id,
          contactId: contact._id,
          whatsappAccountId: account?._id || null,
          whatsappMessageId: metaRes?.messages?.[0]?.id || `auto_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          direction: 'outbound',
          type: messageType,
          body: interpolatedText || caption,
          media: {
            url: mediaUrl,
            caption,
            fileName: nodeData.filename || '',
          },
          status: 'sent',
          metadata: { automated: true, automationNodeId: actionNode.id },
        });

        conversation.lastMessage = {
          body: replyMsg.body,
          type: messageType,
          direction: 'outbound',
          status: 'sent',
          timestamp: new Date(),
        };
        conversation.lastMessageAt = new Date();
        await conversation.save();

        const io = getSocketIO();
        if (io) {
          io.to(`workspace_${workspace._id}`).emit('message:new', {
            conversationId: conversation._id,
            message: replyMsg,
          });
          io.to(`workspace_${workspace._id}`).emit('conversation:updated', {
            conversation,
          });
        }

        logger.info(`[WHATSAPP] Reply sent: "${replyMsg.body.substring(0, 40)}..."`);
        return { success: true, messageId: replyMsg._id, body: replyMsg.body };
      }

      // 2. Send Template Action
      case 'send_template': {
        const templateName = nodeData.templateName || nodeData.name;
        const languageCode = nodeData.languageCode || 'en_US';
        const rawComponents = nodeData.components || [];

        // Interpolate variables in template components
        const interpolatedComponents = rawComponents.map((comp) => {
          if (comp.parameters && Array.isArray(comp.parameters)) {
            return {
              ...comp,
              parameters: comp.parameters.map((param) => {
                if (param.type === 'text' && param.text) {
                  return { ...param, text: interpolateVariables(param.text, interpolationContext) };
                }
                return param;
              }),
            };
          }
          return comp;
        });

        let metaRes = null;
        if (phoneNumberId && accessToken && contact.phoneNumber && templateName) {
          try {
            metaRes = await WhatsAppService.sendTemplateMessage({
              to: contact.phoneNumber,
              templateName,
              languageCode,
              components: interpolatedComponents,
              phoneNumberId,
              accessToken,
            });
          } catch (err) {
            logger.warn(`[AutomationEngine] Could not dispatch template message: ${err.message}`);
          }
        }

        const replyMsg = await Message.create({
          workspaceId: workspace._id,
          conversationId: conversation._id,
          contactId: contact._id,
          whatsappAccountId: account?._id || null,
          whatsappMessageId: metaRes?.messages?.[0]?.id || `template_${Date.now()}`,
          direction: 'outbound',
          type: 'template',
          body: `[Template: ${templateName}]`,
          status: 'sent',
          metadata: { automated: true, templateName },
        });

        return { success: true, messageId: replyMsg._id, templateName };
      }

      // 3. Add Tag Action
      case 'add_tag': {
        const tagName = nodeData.tagName || nodeData.tag || nodeData.name;
        if (!tagName) return { success: false, reason: 'No tag name provided' };

        let tagDoc = await Tag.findOne({ workspaceId: workspace._id, name: tagName.trim() });
        if (!tagDoc) {
          tagDoc = await Tag.create({ workspaceId: workspace._id, name: tagName.trim() });
        }

        const tagIdStr = tagDoc._id.toString();
        const hasTag = (contact.tags || []).some((t) => (t._id || t).toString() === tagIdStr);

        if (!hasTag) {
          contact.tags.push(tagDoc._id);
          await contact.save();
        }

        return { success: true, tag: tagName, tagId: tagDoc._id };
      }

      // 4. Remove Tag Action
      case 'remove_tag': {
        const tagName = nodeData.tagName || nodeData.tag || nodeData.name;
        if (!tagName) return { success: false, reason: 'No tag name provided' };

        const tagDoc = await Tag.findOne({ workspaceId: workspace._id, name: tagName.trim() });
        if (tagDoc) {
          const tagIdStr = tagDoc._id.toString();
          contact.tags = (contact.tags || []).filter((t) => (t._id || t).toString() !== tagIdStr);
          await contact.save();
        }

        return { success: true, removedTag: tagName };
      }

      // 5. Update Contact Action
      case 'update_contact': {
        if (nodeData.name) contact.name = interpolateVariables(nodeData.name, interpolationContext);
        if (nodeData.email) contact.email = interpolateVariables(nodeData.email, interpolationContext);
        if (nodeData.notes) contact.notes = interpolateVariables(nodeData.notes, interpolationContext);
        if (nodeData.optedOut !== undefined) contact.optedOut = Boolean(nodeData.optedOut);

        if (nodeData.customFields && typeof nodeData.customFields === 'object') {
          contact.customFields = {
            ...(contact.customFields || {}),
            ...nodeData.customFields,
          };
        }

        await contact.save();
        return { success: true, contactId: contact._id };
      }

      // 6. Assign Conversation Action
      case 'assign_conversation':
      case 'assign_agent': {
        const agentId = nodeData.userId || nodeData.agentId || nodeData.assignedTo;
        if (agentId && mongoose.Types.ObjectId.isValid(agentId)) {
          conversation.assignedTo = agentId;
          await conversation.save();

          const io = getSocketIO();
          if (io) {
            io.to(`workspace_${workspace._id}`).emit('conversation:updated', { conversation });
          }
          return { success: true, assignedTo: agentId };
        }
        return { success: false, reason: 'Invalid or missing agent ID' };
      }

      // 7. Delay Action
      case 'delay': {
        const delaySeconds = Math.min(10, Math.max(1, parseInt(nodeData.seconds || nodeData.duration || 1, 10)));
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
        return { success: true, delayedSeconds: delaySeconds };
      }

      // 8. Condition Action
      case 'condition': {
        const field = nodeData.field || 'message.body';
        const operator = nodeData.operator || 'contains';
        const targetValue = (nodeData.value || '').toLowerCase().trim();

        let fieldValue = '';
        if (field === 'message.body' || field === 'text') {
          fieldValue = (incomingText || message?.body || '').toLowerCase().trim();
        } else if (field.startsWith('contact.')) {
          const prop = field.replace('contact.', '');
          fieldValue = String(contact[prop] || contact.customFields?.[prop] || '').toLowerCase().trim();
        }

        let conditionMet = false;
        switch (operator) {
          case 'equals':
          case '==':
            conditionMet = fieldValue === targetValue;
            break;
          case 'not_equals':
          case '!=':
            conditionMet = fieldValue !== targetValue;
            break;
          case 'contains':
            conditionMet = fieldValue.includes(targetValue);
            break;
          case 'starts_with':
            conditionMet = fieldValue.startsWith(targetValue);
            break;
          case 'ends_with':
            conditionMet = fieldValue.endsWith(targetValue);
            break;
          default:
            conditionMet = fieldValue.includes(targetValue);
            break;
        }

        return { success: true, conditionMet, branch: conditionMet ? 'true' : 'false' };
      }

      // 9. Stop Action
      case 'stop': {
        return { success: true, stopped: true };
      }

      default:
        logger.warn(`[AutomationEngine] Unknown action type: ${nodeType}`);
        return { success: true, warning: `Unhandled action node: ${nodeType}` };
    }
  }

  /**
   * 4. Execute Entire Workflow Pipeline with Loop & Error Protection
   */
  static async executeWorkflow({
    workspace,
    account,
    contact,
    conversation,
    automation,
    message,
    triggerData,
    execution,
  }) {
    const nodes = automation.nodes || [];
    const edges = automation.edges || [];

    if (nodes.length === 0) {
      if (execution) {
        execution.status = 'completed';
        execution.completedAt = new Date();
        await execution.save();
      }
      return;
    }

    // Find root node (trigger node or first node)
    let currentNode = nodes.find((n) => (n.type || n.data?.type) === 'trigger') || nodes[0];
    let stepCount = 0;
    const visitedNodes = new Set();

    try {
      while (currentNode && stepCount < MAX_EXECUTION_STEPS) {
        stepCount++;
        visitedNodes.add(currentNode.id);

        const nodeType = (currentNode.type || currentNode.data?.type || '').toLowerCase();

        // Skip root trigger node logic execution
        if (nodeType !== 'trigger') {
          const actionResult = await this.executeAction(currentNode, {
            workspace,
            account,
            contact,
            conversation,
            message,
            incomingText: triggerData.incomingText,
          });

          logger.info(`[AUTOMATION] Action executed: ${nodeType}`);

          if (execution) {
            execution.actionsExecuted.push({
              nodeId: currentNode.id,
              actionType: nodeType,
              status: 'completed',
              executedAt: new Date(),
              output: actionResult,
            });
          }

          // If stop action reached, terminate workflow
          if (actionResult.stopped) {
            break;
          }

          // If condition action, select branch
          if (actionResult.conditionMet !== undefined) {
            const branchHandle = actionResult.conditionMet ? 'true' : 'false';
            currentNode = this.getNextNode(currentNode.id, nodes, edges, branchHandle);
            continue;
          }
        }

        // Traverse to next sequential node
        currentNode = this.getNextNode(currentNode.id, nodes, edges);
      }

      // Check if loop limit was exceeded
      if (stepCount >= MAX_EXECUTION_STEPS) {
        logger.warn(`[AutomationEngine] Loop limit reached (${MAX_EXECUTION_STEPS} steps) for automation ${automation._id}`);
      }

      if (execution) {
        execution.status = 'completed';
        execution.completedAt = new Date();
        await execution.save();
      }
    } catch (err) {
      logger.error(`[AutomationEngine Execution Failed] ${err.message}`, err.stack);
      if (execution) {
        execution.status = 'failed';
        execution.error = { message: err.message, stack: err.stack };
        execution.completedAt = new Date();
        await execution.save();
      }
    }
  }

  /**
   * Helper to find next target node via edges
   */
  static getNextNode(currentId, nodes, edges, sourceHandle = null) {
    if (!currentId || !edges || edges.length === 0) return null;

    let edge = null;
    if (sourceHandle) {
      edge = edges.find((e) => e.source === currentId && (e.sourceHandle === sourceHandle || e.label === sourceHandle));
    }

    if (!edge) {
      edge = edges.find((e) => e.source === currentId);
    }

    if (!edge || !edge.target) return null;
    return nodes.find((n) => n.id === edge.target) || null;
  }
}

module.exports = AutomationEngine;
