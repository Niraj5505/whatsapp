const Flow = require('../models/Flow');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const MetaService = require('./metaService');
const logger = require('../utils/logger');
const { getSocketIO } = require('../sockets/socketServer');

class FlowEngine {
  /**
   * Process incoming text/button against active Flows
   */
  static async processIncoming({ user, contact, conversation, incomingText, buttonPayload = null }) {
    try {
      const cleanText = (incomingText || '').trim().toLowerCase();
      let triggeredFlow = null;

      // 1. Check if user is currently inside an active flow
      if (conversation.activeFlowId) {
        triggeredFlow = await Flow.findOne({
          _id: conversation.activeFlowId,
          userId: user._id,
          isActive: true,
        });
      }

      // 2. If no active flow, search by trigger keywords or welcome trigger
      if (!triggeredFlow) {
        const isNewContact = !contact.lastMessageAt || (new Date() - new Date(contact.lastMessageAt)) > 24 * 60 * 60 * 1000;

        if (isNewContact) {
          triggeredFlow = await Flow.findOne({
            userId: user._id,
            isActive: true,
            triggerType: 'welcome',
          });
        }

        if (!triggeredFlow && cleanText) {
          triggeredFlow = await Flow.findOne({
            userId: user._id,
            isActive: true,
            triggerType: 'keyword',
            triggerKeywords: cleanText,
          });
        }

        // Fallback flow if no match
        if (!triggeredFlow) {
          triggeredFlow = await Flow.findOne({
            userId: user._id,
            isActive: true,
            triggerType: 'fallback',
          });
        }
      }

      if (!triggeredFlow) return null;

      logger.info(`[FlowEngine] Triggered flow "${triggeredFlow.name}" for contact ${contact.phoneNumber}`);

      // Increment execution count
      await Flow.findByIdAndUpdate(triggeredFlow._id, { $inc: { executionCount: 1 } });

      // Execute flow starting from root node or next step
      await this.executeFlowSteps({
        user,
        contact,
        conversation,
        flow: triggeredFlow,
        buttonPayload,
      });

      return triggeredFlow;
    } catch (error) {
      logger.error(`[FlowEngine Error] ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Execute steps inside a Flow
   */
  static async executeFlowSteps({ user, contact, conversation, flow, buttonPayload }) {
    const nodes = flow.nodes || [];
    const edges = flow.edges || [];

    // Find starting node (trigger node or current step)
    let currentNodeId = conversation.flowStepId;
    if (!currentNodeId) {
      const triggerNode = nodes.find((n) => n.type === 'trigger') || nodes[0];
      if (!triggerNode) return;
      currentNodeId = triggerNode.id;
    }

    // Traverse nodes sequentially
    let nextNode = this.getNextNode(currentNodeId, nodes, edges, buttonPayload);

    while (nextNode) {
      logger.info(`[FlowEngine] Executing node: ${nextNode.type} (${nextNode.id})`);

      if (nextNode.type === 'send_message') {
        const text = nextNode.data?.messageText || 'Hello from NexaFlow bot!';
        await this.dispatchBotMessage({ user, contact, conversation, text });
      } else if (nextNode.type === 'send_buttons') {
        const text = nextNode.data?.messageText || 'Please select an option:';
        const buttons = nextNode.data?.buttons || [];
        await this.dispatchBotButtons({ user, contact, conversation, text, buttons });
        // Pause flow execution until contact clicks a button
        await Conversation.findByIdAndUpdate(conversation._id, {
          activeFlowId: flow._id,
          flowStepId: nextNode.id,
          status: 'bot_active',
        });
        return;
      } else if (nextNode.type === 'add_tag') {
        const tag = nextNode.data?.tagName;
        if (tag && !contact.tags.includes(tag)) {
          contact.tags.push(tag);
          await contact.save();
        }
      } else if (nextNode.type === 'human_handoff') {
        await Conversation.findByIdAndUpdate(conversation._id, {
          activeFlowId: null,
          flowStepId: null,
          status: 'open',
        });
        await this.dispatchBotMessage({
          user,
          contact,
          conversation,
          text: 'You have been connected to a live support agent. Please hold on!',
        });
        return;
      }

      // Move to next node
      const currentId = nextNode.id;
      nextNode = this.getNextNode(currentId, nodes, edges);
    }

    // Flow completed
    await Conversation.findByIdAndUpdate(conversation._id, {
      activeFlowId: null,
      flowStepId: null,
    });
  }

  static getNextNode(currentId, nodes, edges, buttonPayload = null) {
    let edge;
    if (buttonPayload) {
      edge = edges.find((e) => e.source === currentId && e.sourceHandle === buttonPayload);
    }
    if (!edge) {
      edge = edges.find((e) => e.source === currentId);
    }
    if (!edge) return null;
    return nodes.find((n) => n.id === edge.target);
  }

  static async dispatchBotMessage({ user, contact, conversation, text }) {
    let metaRes = null;
    try {
      metaRes = await MetaService.sendTextMessage({
        user,
        to: contact.phoneNumber,
        message: text,
      });
    } catch (err) {
      logger.warn(`Could not dispatch live WhatsApp message (Meta config may be unconfigured): ${err.message}`);
    }

    const message = await Message.create({
      userId: user._id,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'outbound',
      messageType: 'text',
      content: text,
      status: metaRes ? 'sent' : 'delivered',
      metaMessageId: metaRes?.messages?.[0]?.id || `bot_${Date.now()}`,
      sentByBot: true,
    });

    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: {
        content: text,
        messageType: 'text',
        direction: 'outbound',
        timestamp: new Date(),
        status: message.status,
      },
    });

    const io = getSocketIO();
    if (io) {
      io.to(`user_${user._id}`).emit('new_message', {
        conversationId: conversation._id,
        message,
      });
    }
  }

  static async dispatchBotButtons({ user, contact, conversation, text, buttons }) {
    let metaRes = null;
    try {
      metaRes = await MetaService.sendInteractiveButtons({
        user,
        to: contact.phoneNumber,
        bodyText: text,
        buttons,
      });
    } catch (err) {
      logger.warn(`Could not dispatch interactive WhatsApp buttons: ${err.message}`);
    }

    const message = await Message.create({
      userId: user._id,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'outbound',
      messageType: 'interactive',
      content: text,
      interactiveData: { buttons },
      status: metaRes ? 'sent' : 'delivered',
      metaMessageId: metaRes?.messages?.[0]?.id || `bot_btn_${Date.now()}`,
      sentByBot: true,
    });

    const io = getSocketIO();
    if (io) {
      io.to(`user_${user._id}`).emit('new_message', {
        conversationId: conversation._id,
        message,
      });
    }
  }
}

module.exports = FlowEngine;
