const axios = require('axios');
const WhatsAppService = require('../services/whatsappService');
const { Message, Conversation, Contact, WhatsAppAccount } = require('../models');

async function testWhatsAppIntegration() {
  console.log('🧪 Testing Real Meta WhatsApp Cloud API Service & /api/messages/send...\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  const mockPhoneId = '109876543210987';
  const mockToken = 'EAABwbtesttokensecret99881122';
  const testRecipient = '+1 (555) 987-6543';
  const cleanedPhone = '15559876543';

  // Intercept axios.post to mock Meta Cloud API responses and inspect outgoing requests
  const originalPost = axios.post;
  let lastRequest = null;

  axios.post = async (url, payload, options) => {
    lastRequest = { url, payload, options };
    return {
      status: 200,
      data: {
        messaging_product: 'whatsapp',
        contacts: [{ input: cleanedPhone, wa_id: cleanedPhone }],
        messages: [{ id: 'wamid.HBgLMTU1NTk4NzY1NDMVAgARGBI0QjMzQkQ1QkIz' }],
      },
    };
  };

  try {
    // 1. Test sendTextMessage
    const textRes = await WhatsAppService.sendTextMessage({
      to: testRecipient,
      text: 'Hello from NexaFlow Meta Cloud API!',
      previewUrl: true,
      phoneNumberId: mockPhoneId,
      accessToken: mockToken,
    });

    assert(
      lastRequest.url === `https://graph.facebook.com/v21.0/${mockPhoneId}/messages`,
      'sendTextMessage calls correct Meta Graph API v21.0 endpoint'
    );
    assert(
      lastRequest.options.headers.Authorization === `Bearer ${mockToken}`,
      'sendTextMessage includes Bearer Authorization header with token'
    );
    assert(
      lastRequest.payload.to === cleanedPhone &&
      lastRequest.payload.type === 'text' &&
      lastRequest.payload.text.body === 'Hello from NexaFlow Meta Cloud API!' &&
      lastRequest.payload.text.preview_url === true,
      'sendTextMessage constructs correct Meta JSON payload'
    );
    assert(textRes.messages[0].id.startsWith('wamid.'), 'sendTextMessage returns Meta WhatsApp message ID');

    // 2. Test sendImageMessage
    await WhatsAppService.sendImageMessage({
      to: testRecipient,
      imageUrl: 'https://example.com/promo.jpg',
      caption: 'Exclusive Summer Offer',
      phoneNumberId: mockPhoneId,
      accessToken: mockToken,
    });
    assert(
      lastRequest.payload.type === 'image' &&
      lastRequest.payload.image.link === 'https://example.com/promo.jpg' &&
      lastRequest.payload.image.caption === 'Exclusive Summer Offer',
      'sendImageMessage constructs correct Meta image payload'
    );

    // 3. Test sendDocumentMessage
    await WhatsAppService.sendDocumentMessage({
      to: testRecipient,
      documentUrl: 'https://example.com/invoice.pdf',
      filename: 'Invoice_1001.pdf',
      caption: 'Your Monthly Invoice',
      phoneNumberId: mockPhoneId,
      accessToken: mockToken,
    });
    assert(
      lastRequest.payload.type === 'document' &&
      lastRequest.payload.document.link === 'https://example.com/invoice.pdf' &&
      lastRequest.payload.document.filename === 'Invoice_1001.pdf',
      'sendDocumentMessage constructs correct Meta document payload'
    );

    // 4. Test sendAudioMessage
    await WhatsAppService.sendAudioMessage({
      to: testRecipient,
      audioUrl: 'https://example.com/voice.ogg',
      phoneNumberId: mockPhoneId,
      accessToken: mockToken,
    });
    assert(
      lastRequest.payload.type === 'audio' &&
      lastRequest.payload.audio.link === 'https://example.com/voice.ogg',
      'sendAudioMessage constructs correct Meta audio payload'
    );

    // 5. Test sendVideoMessage
    await WhatsAppService.sendVideoMessage({
      to: testRecipient,
      videoUrl: 'https://example.com/demo.mp4',
      caption: 'Product Demo',
      phoneNumberId: mockPhoneId,
      accessToken: mockToken,
    });
    assert(
      lastRequest.payload.type === 'video' &&
      lastRequest.payload.video.link === 'https://example.com/demo.mp4' &&
      lastRequest.payload.video.caption === 'Product Demo',
      'sendVideoMessage constructs correct Meta video payload'
    );

    // 6. Test sendTemplateMessage
    await WhatsAppService.sendTemplateMessage({
      to: testRecipient,
      templateName: 'order_confirmation',
      languageCode: 'en_US',
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: 'John Doe' }, { type: 'text', text: '#98432' }],
        },
      ],
      phoneNumberId: mockPhoneId,
      accessToken: mockToken,
    });
    assert(
      lastRequest.payload.type === 'template' &&
      lastRequest.payload.template.name === 'order_confirmation' &&
      lastRequest.payload.template.language.code === 'en_US' &&
      lastRequest.payload.template.components.length === 1,
      'sendTemplateMessage constructs valid Meta template payload'
    );

    // 7. Test Meta API Error Handling
    axios.post = async () => {
      const err = new Error('Request failed with status code 400');
      err.response = {
        status: 400,
        data: {
          error: {
            message: 'Message undeliverable: User not found on WhatsApp',
            type: 'OAuthException',
            code: 131026,
            error_subcode: 2494010,
            error_user_title: 'Recipient Not Registered',
            error_user_msg: 'The phone number provided is not associated with a WhatsApp account.',
          },
        },
      };
      throw err;
    };

    let caughtError = null;
    try {
      await WhatsAppService.sendTextMessage({
        to: '0000000000',
        text: 'Test Error',
        phoneNumberId: mockPhoneId,
        accessToken: mockToken,
      });
    } catch (e) {
      caughtError = e;
    }

    assert(
      caughtError &&
      caughtError.message.includes('131026') &&
      caughtError.message.includes('Recipient Not Registered'),
      'formatMetaError correctly parses Meta Graph API error codes, titles, and subcodes'
    );

    console.log(`\n🎉 ALL ${passed}/${total} META WHATSAPP CLOUD API INTEGRATION TESTS PASSED!`);
  } finally {
    axios.post = originalPost;
  }
}

testWhatsAppIntegration().catch((err) => {
  console.error(err);
  process.exit(1);
});
