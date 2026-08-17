const axios = require('axios');
const logger = require('../utils/logger');

const META_GRAPH_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

/**
 * Parses and formats errors returned by Meta Graph API into human-readable actionable messages.
 */
const formatMetaError = (error, context = 'WhatsApp API') => {
  if (error.response && error.response.data && error.response.data.error) {
    const metaErr = error.response.data.error;
    const code = metaErr.code || 'UNKNOWN';
    const subcode = metaErr.error_subcode ? ` (Subcode: ${metaErr.error_subcode})` : '';
    const message = metaErr.message || 'Unknown Meta API error';
    const userTitle = metaErr.error_user_title ? ` [${metaErr.error_user_title}]` : '';
    const userMsg = metaErr.error_user_msg ? `: ${metaErr.error_user_msg}` : '';
    const formatted = `[Meta API Error ${code}${subcode}]${userTitle} ${message}${userMsg}`;

    const customError = new Error(formatted);
    customError.status = error.response.status || 400;
    customError.metaCode = metaErr.code;
    customError.metaSubcode = metaErr.error_subcode;
    customError.metaDetails = metaErr;
    return customError;
  }

  const standardError = new Error(`[${context}] ${error.message || 'Request failed'}`);
  standardError.status = error.response?.status || 500;
  return standardError;
};

/**
 * Resolves credentials from passed arguments or environment variables.
 */
const resolveCredentials = (opts = {}) => {
  const phoneNumberId = opts.phoneNumberId || process.env.META_PHONE_NUMBER_ID;
  const accessToken = opts.accessToken || process.env.META_ACCESS_TOKEN;
  const businessAccountId = opts.businessAccountId || process.env.META_BUSINESS_ACCOUNT_ID;

  if (!phoneNumberId) {
    throw new Error('Meta WhatsApp Cloud API Phone Number ID is required.');
  }

  if (!accessToken) {
    throw new Error('Meta WhatsApp Cloud API Access Token is required.');
  }

  return { phoneNumberId, accessToken, businessAccountId };
};

/**
 * Real Meta WhatsApp Cloud API Service
 */
class WhatsAppService {
  /**
   * 1. Send Plain Text Message
   */
  static async sendTextMessage({ to, text, previewUrl = false, phoneNumberId, accessToken }) {
    const creds = resolveCredentials({ phoneNumberId, accessToken });
    const cleanedPhone = String(to).replace(/[^0-9]/g, '');

    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Message text body is required');
    }

    const url = `${META_BASE_URL}/${creds.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanedPhone,
      type: 'text',
      text: {
        preview_url: Boolean(previewUrl),
        body: text.trim(),
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`[WhatsAppService] sendTextMessage to ${cleanedPhone} failed: ${error.message}`);
      throw formatMetaError(error, 'sendTextMessage');
    }
  }

  /**
   * 2. Send Image Message
   */
  static async sendImageMessage({ to, imageUrl, caption = '', phoneNumberId, accessToken }) {
    const creds = resolveCredentials({ phoneNumberId, accessToken });
    const cleanedPhone = String(to).replace(/[^0-9]/g, '');

    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    const url = `${META_BASE_URL}/${creds.phoneNumberId}/messages`;
    const imagePayload = { link: imageUrl };
    if (caption) {
      imagePayload.caption = caption;
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanedPhone,
      type: 'image',
      image: imagePayload,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`[WhatsAppService] sendImageMessage to ${cleanedPhone} failed: ${error.message}`);
      throw formatMetaError(error, 'sendImageMessage');
    }
  }

  /**
   * 3. Send Document Message
   */
  static async sendDocumentMessage({ to, documentUrl, filename = '', caption = '', phoneNumberId, accessToken }) {
    const creds = resolveCredentials({ phoneNumberId, accessToken });
    const cleanedPhone = String(to).replace(/[^0-9]/g, '');

    if (!documentUrl) {
      throw new Error('Document URL is required');
    }

    const url = `${META_BASE_URL}/${creds.phoneNumberId}/messages`;
    const docPayload = { link: documentUrl };
    if (filename) {
      docPayload.filename = filename;
    }
    if (caption) {
      docPayload.caption = caption;
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanedPhone,
      type: 'document',
      document: docPayload,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`[WhatsAppService] sendDocumentMessage to ${cleanedPhone} failed: ${error.message}`);
      throw formatMetaError(error, 'sendDocumentMessage');
    }
  }

  /**
   * 4. Send Audio Message
   */
  static async sendAudioMessage({ to, audioUrl, phoneNumberId, accessToken }) {
    const creds = resolveCredentials({ phoneNumberId, accessToken });
    const cleanedPhone = String(to).replace(/[^0-9]/g, '');

    if (!audioUrl) {
      throw new Error('Audio URL is required');
    }

    const url = `${META_BASE_URL}/${creds.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanedPhone,
      type: 'audio',
      audio: {
        link: audioUrl,
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`[WhatsAppService] sendAudioMessage to ${cleanedPhone} failed: ${error.message}`);
      throw formatMetaError(error, 'sendAudioMessage');
    }
  }

  /**
   * 5. Send Video Message
   */
  static async sendVideoMessage({ to, videoUrl, caption = '', phoneNumberId, accessToken }) {
    const creds = resolveCredentials({ phoneNumberId, accessToken });
    const cleanedPhone = String(to).replace(/[^0-9]/g, '');

    if (!videoUrl) {
      throw new Error('Video URL is required');
    }

    const url = `${META_BASE_URL}/${creds.phoneNumberId}/messages`;
    const videoPayload = { link: videoUrl };
    if (caption) {
      videoPayload.caption = caption;
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanedPhone,
      type: 'video',
      video: videoPayload,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`[WhatsAppService] sendVideoMessage to ${cleanedPhone} failed: ${error.message}`);
      throw formatMetaError(error, 'sendVideoMessage');
    }
  }

  /**
   * 6. Send Approved Template Message
   */
  static async sendTemplateMessage({ to, templateName, languageCode = 'en_US', components = [], phoneNumberId, accessToken }) {
    const creds = resolveCredentials({ phoneNumberId, accessToken });
    const cleanedPhone = String(to).replace(/[^0-9]/g, '');

    if (!templateName) {
      throw new Error('Template name is required');
    }

    const url = `${META_BASE_URL}/${creds.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        ...(Array.isArray(components) && components.length > 0 && { components }),
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`[WhatsAppService] sendTemplateMessage to ${cleanedPhone} failed: ${error.message}`);
      throw formatMetaError(error, 'sendTemplateMessage');
    }
  }

  /**
   * 7. Create Template in Meta WhatsApp Business Account
   */
  static async createTemplate({ name, category = 'MARKETING', language = 'en_US', components = [], businessAccountId, accessToken }) {
    const creds = resolveCredentials({ businessAccountId, accessToken, phoneNumberId: 'dummy' });
    const wabaId = creds.businessAccountId || process.env.META_BUSINESS_ACCOUNT_ID;

    if (!wabaId) {
      throw new Error('Meta WhatsApp Business Account ID (WABA ID) is required to create templates.');
    }

    const url = `${META_BASE_URL}/${wabaId}/message_templates`;
    const payload = {
      name: name.toLowerCase().trim(),
      category: category.toUpperCase(),
      language,
      components,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`[WhatsAppService] createTemplate failed: ${error.message}`);
      throw formatMetaError(error, 'createTemplate');
    }
  }

  /**
   * 8. Fetch Templates from Meta WhatsApp Business Account
   */
  static async getTemplates({ businessAccountId, accessToken, limit = 100 }) {
    const creds = resolveCredentials({ businessAccountId, accessToken, phoneNumberId: 'dummy' });
    const wabaId = creds.businessAccountId || process.env.META_BUSINESS_ACCOUNT_ID;

    if (!wabaId) {
      throw new Error('Meta WhatsApp Business Account ID (WABA ID) is required to fetch templates.');
    }

    const url = `${META_BASE_URL}/${wabaId}/message_templates?limit=${limit}`;

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`[WhatsAppService] getTemplates failed: ${error.message}`);
      throw formatMetaError(error, 'getTemplates');
    }
  }

  /**
   * 9. Delete Template from Meta WhatsApp Business Account
   */
  static async deleteTemplate({ name, businessAccountId, accessToken }) {
    const creds = resolveCredentials({ businessAccountId, accessToken, phoneNumberId: 'dummy' });
    const wabaId = creds.businessAccountId || process.env.META_BUSINESS_ACCOUNT_ID;

    if (!wabaId) {
      throw new Error('Meta WhatsApp Business Account ID (WABA ID) is required to delete templates.');
    }

    const url = `${META_BASE_URL}/${wabaId}/message_templates?name=${encodeURIComponent(name)}`;

    try {
      const response = await axios.delete(url, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`[WhatsAppService] deleteTemplate failed: ${error.message}`);
      throw formatMetaError(error, 'deleteTemplate');
    }
  }

  /**
   * Mark message as read
   */
  static async markAsRead({ messageId, phoneNumberId, accessToken }) {
    try {
      const creds = resolveCredentials({ phoneNumberId, accessToken });
      const url = `${META_BASE_URL}/${creds.phoneNumberId}/messages`;
      await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        {
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      logger.warn(`[WhatsAppService] Failed to mark message ${messageId} as read: ${error.message}`);
    }
  }
}

module.exports = WhatsAppService;
