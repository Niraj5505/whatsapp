const axios = require('axios');
const logger = require('../utils/logger');

const META_GRAPH_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

class MetaService {
  /**
   * Helper to get effective Meta credentials (per-user or env defaults)
   */
  static getCredentials(user) {
    const phoneNumberId = user?.metaConfig?.phoneNumberId || process.env.META_PHONE_NUMBER_ID;
    const businessAccountId = user?.metaConfig?.businessAccountId || process.env.META_BUSINESS_ACCOUNT_ID;
    const accessToken = user?.metaConfig?.accessToken || process.env.META_ACCESS_TOKEN;
    return { phoneNumberId, businessAccountId, accessToken };
  }

  /**
   * Send Plain Text WhatsApp Message
   */
  static async sendTextMessage({ user, to, message, previewUrl = false }) {
    const { phoneNumberId, accessToken } = this.getCredentials(user);
    if (!phoneNumberId || !accessToken) {
      throw new Error('Meta WhatsApp Cloud API credentials (Phone Number ID or Access Token) are not configured');
    }

    const cleanedPhone = to.replace(/[^0-9]/g, '');
    const url = `${META_BASE_URL}/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanedPhone,
      type: 'text',
      text: {
        preview_url: previewUrl,
        body: message,
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error(`[Meta API Error] sendTextMessage to ${cleanedPhone}: ${errorMsg}`, error.response?.data);
      throw new Error(errorMsg);
    }
  }

  /**
   * Send WhatsApp Template Message
   */
  static async sendTemplateMessage({ user, to, templateName, languageCode = 'en_US', components = [] }) {
    const { phoneNumberId, accessToken } = this.getCredentials(user);
    if (!phoneNumberId || !accessToken) {
      throw new Error('Meta WhatsApp Cloud API credentials are not configured');
    }

    const cleanedPhone = to.replace(/[^0-9]/g, '');
    const url = `${META_BASE_URL}/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: cleanedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length > 0 && { components }),
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error(`[Meta API Error] sendTemplateMessage: ${errorMsg}`, error.response?.data);
      throw new Error(errorMsg);
    }
  }

  /**
   * Send Media Message (Image, Document, Audio, Video)
   */
  static async sendMediaMessage({ user, to, mediaType, mediaUrl, caption = '', filename = '' }) {
    const { phoneNumberId, accessToken } = this.getCredentials(user);
    if (!phoneNumberId || !accessToken) {
      throw new Error('Meta WhatsApp Cloud API credentials are not configured');
    }

    const cleanedPhone = to.replace(/[^0-9]/g, '');
    const url = `${META_BASE_URL}/${phoneNumberId}/messages`;

    const mediaObject = { link: mediaUrl };
    if (caption && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
      mediaObject.caption = caption;
    }
    if (filename && mediaType === 'document') {
      mediaObject.filename = filename;
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: cleanedPhone,
      type: mediaType,
      [mediaType]: mediaObject,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error(`[Meta API Error] sendMediaMessage: ${errorMsg}`, error.response?.data);
      throw new Error(errorMsg);
    }
  }

  /**
   * Send Interactive Buttons / List Message
   */
  static async sendInteractiveButtons({ user, to, bodyText, buttons = [], headerText = '', footerText = '' }) {
    const { phoneNumberId, accessToken } = this.getCredentials(user);
    if (!phoneNumberId || !accessToken) {
      throw new Error('Meta WhatsApp Cloud API credentials are not configured');
    }

    const cleanedPhone = to.replace(/[^0-9]/g, '');
    const url = `${META_BASE_URL}/${phoneNumberId}/messages`;

    const formattedButtons = buttons.slice(0, 3).map((btn, index) => ({
      type: 'reply',
      reply: {
        id: btn.id || `btn_${index + 1}`,
        title: btn.text.substring(0, 20),
      },
    }));

    const interactivePayload = {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: formattedButtons },
    };

    if (headerText) {
      interactivePayload.header = { type: 'text', text: headerText };
    }
    if (footerText) {
      interactivePayload.footer = { text: footerText };
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: cleanedPhone,
      type: 'interactive',
      interactive: interactivePayload,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error(`[Meta API Error] sendInteractiveButtons: ${errorMsg}`, error.response?.data);
      throw new Error(errorMsg);
    }
  }

  /**
   * Fetch approved message templates from Meta Cloud API
   */
  static async fetchMetaTemplates(user) {
    const { businessAccountId, accessToken } = this.getCredentials(user);
    if (!businessAccountId || !accessToken) {
      throw new Error('Meta Business Account ID and Access Token are required');
    }

    const url = `${META_BASE_URL}/${businessAccountId}/message_templates`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { limit: 100 },
      });
      return response.data.data || [];
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error(`[Meta API Error] fetchMetaTemplates: ${errorMsg}`, error.response?.data);
      throw new Error(errorMsg);
    }
  }

  /**
   * Mark an incoming message as read in WhatsApp
   */
  static async markMessageAsRead({ user, messageId }) {
    const { phoneNumberId, accessToken } = this.getCredentials(user);
    if (!phoneNumberId || !accessToken || !messageId) return;

    const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
    try {
      await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (err) {
      logger.warn(`Failed to mark WhatsApp message ${messageId} as read: ${err.message}`);
    }
  }
}

module.exports = MetaService;
