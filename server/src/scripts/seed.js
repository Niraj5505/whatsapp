const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const {
  User,
  Workspace,
  WorkspaceMember,
  WhatsAppAccount,
  Contact,
  Conversation,
  Message,
  Automation,
  MessageTemplate,
  Tag,
  Notification,
} = require('../models');

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://nirajth:Niraj%40123@cluster0.la5bw0i.mongodb.net/Whatsapp?retryWrites=true&w=majority&appName=Whatsapp';

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB database...');
    console.log(`URI: ${MONGODB_URI.replace(/:([^@]+)@/, ':****@')}`);

    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully!');

    console.log('Clearing existing collections (if any)...');
    await Promise.all([
      User.deleteMany({}),
      Workspace.deleteMany({}),
      WorkspaceMember.deleteMany({}),
      WhatsAppAccount.deleteMany({}),
      Contact.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      Automation.deleteMany({}),
      MessageTemplate.deleteMany({}),
      Tag.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    console.log('Creating Admin User...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    const user = await User.create({
      name: 'Niraj Thanki',
      email: 'admin@nexaflow.io',
      passwordHash,
      role: 'superadmin',
    });
    console.log(`User created: ${user.name} (${user.email})`);

    console.log('Creating Workspace...');
    const workspace = await Workspace.create({
      name: 'NexaFlow Main Workspace',
      ownerId: user._id,
      settings: {
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        autoReply: true,
        notificationPreferences: {
          email: true,
          inApp: true,
        },
      },
    });
    console.log(`Workspace created: ${workspace.name}`);

    // Update user workspaceIds
    user.workspaceIds = [workspace._id];
    await user.save();

    console.log('Creating Workspace Member...');
    await WorkspaceMember.create({
      workspaceId: workspace._id,
      userId: user._id,
      role: 'owner',
    });

    console.log('Creating WhatsApp Connected Account...');
    const whatsappAccount = await WhatsAppAccount.create({
      workspaceId: workspace._id,
      phoneNumber: '+91 98765 43210',
      phoneNumberId: process.env.META_PHONE_NUMBER_ID || '109283746501928',
      businessAccountId: process.env.META_BUSINESS_ACCOUNT_ID || '892736450192837',
      displayName: 'NexaFlow Official Support',
      accessTokenEncrypted: process.env.META_ACCESS_TOKEN || 'dummy_encrypted_access_token',
      status: 'connected',
    });
    console.log(`WhatsApp Account created: ${whatsappAccount.displayName}`);

    console.log('Creating Tags...');
    const tagVIP = await Tag.create({
      workspaceId: workspace._id,
      name: 'VIP',
      color: '#EF4444',
    });
    const tagLead = await Tag.create({
      workspaceId: workspace._id,
      name: 'Hot Lead',
      color: '#F59E0B',
    });
    const tagCustomer = await Tag.create({
      workspaceId: workspace._id,
      name: 'Existing Customer',
      color: '#10B981',
    });
    console.log('Tags created.');

    console.log('Creating Contacts...');
    const contact1 = await Contact.create({
      workspaceId: workspace._id,
      name: 'Rahul Sharma',
      phoneNumber: '+919876543210',
      whatsappId: '919876543210',
      email: 'rahul.sharma@example.com',
      tags: [tagVIP._id, tagCustomer._id],
      notes: 'Interested in annual WhatsApp Automation enterprise plan.',
      lastInteractionAt: new Date(),
    });

    const contact2 = await Contact.create({
      workspaceId: workspace._id,
      name: 'Priya Patel',
      phoneNumber: '+919812345678',
      whatsappId: '919812345678',
      email: 'priya.patel@example.com',
      tags: [tagLead._id],
      notes: 'Requested product demo via website form.',
      lastInteractionAt: new Date(Date.now() - 3600000),
    });

    const contact3 = await Contact.create({
      workspaceId: workspace._id,
      name: 'Amit Kumar',
      phoneNumber: '+919711223344',
      whatsappId: '919711223344',
      email: 'amit.k@example.com',
      tags: [tagCustomer._id],
      notes: 'Active subscriber.',
      lastInteractionAt: new Date(Date.now() - 7200000),
    });
    console.log('Contacts created.');

    console.log('Creating Conversations & Messages...');
    // Conversation 1
    const conv1 = await Conversation.create({
      workspaceId: workspace._id,
      contactId: contact1._id,
      whatsappAccountId: whatsappAccount._id,
      unreadCount: 0,
      status: 'open',
      lastMessage: {
        body: 'Thank you! Your order #NX-8921 has been confirmed.',
        type: 'text',
        direction: 'outbound',
        status: 'delivered',
        timestamp: new Date(),
      },
      lastMessageAt: new Date(),
    });

    await Message.create({
      workspaceId: workspace._id,
      conversationId: conv1._id,
      contactId: contact1._id,
      whatsappAccountId: whatsappAccount._id,
      whatsappMessageId: `wamid_${Date.now()}_1`,
      direction: 'inbound',
      type: 'text',
      body: 'Hi, can I get my order confirmation details?',
      status: 'read',
    });

    await Message.create({
      workspaceId: workspace._id,
      conversationId: conv1._id,
      contactId: contact1._id,
      whatsappAccountId: whatsappAccount._id,
      whatsappMessageId: `wamid_${Date.now()}_2`,
      direction: 'outbound',
      type: 'text',
      body: 'Thank you! Your order #NX-8921 has been confirmed.',
      status: 'delivered',
    });

    // Conversation 2
    const conv2 = await Conversation.create({
      workspaceId: workspace._id,
      contactId: contact2._id,
      whatsappAccountId: whatsappAccount._id,
      unreadCount: 1,
      status: 'open',
      lastMessage: {
        body: 'Hello, I would like to schedule a quick call for NexaFlow demo.',
        type: 'text',
        direction: 'inbound',
        status: 'received',
        timestamp: new Date(Date.now() - 3600000),
      },
      lastMessageAt: new Date(Date.now() - 3600000),
    });

    await Message.create({
      workspaceId: workspace._id,
      conversationId: conv2._id,
      contactId: contact2._id,
      whatsappAccountId: whatsappAccount._id,
      whatsappMessageId: `wamid_${Date.now()}_3`,
      direction: 'inbound',
      type: 'text',
      body: 'Hello, I would like to schedule a quick call for NexaFlow demo.',
      status: 'received',
    });
    console.log('Conversations & Messages created.');

    console.log('Creating Automations...');
    await Automation.create({
      workspaceId: workspace._id,
      name: 'Welcome Automation Bot',
      description: 'Sends automated welcome sequence when a new contact sends "hi" or "hello"',
      enabled: true,
      trigger: {
        type: 'keyword',
        config: {
          keywords: ['hi', 'hello', 'hey', 'start'],
        },
      },
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          data: {
            type: 'trigger',
            label: 'When message contains hi/hello',
            keywords: ['hi', 'hello'],
          },
        },
        {
          id: 'action_1',
          type: 'send_message',
          data: {
            text: 'Hello {{contact.name}} 👋\n\nWelcome to NexaFlow WhatsApp Support! How can we assist you today?',
          },
        },
      ],
      edges: [
        {
          id: 'edge_1',
          source: 'trigger_1',
          target: 'action_1',
        },
      ],
    });
    console.log('Automations created.');

    console.log('Creating Message Templates...');
    await MessageTemplate.create({
      workspaceId: workspace._id,
      name: 'welcome_greeting',
      language: 'en_US',
      category: 'MARKETING',
      status: 'APPROVED',
      body: 'Hi {{1}}, thank you for connecting with us! Explore our automated messaging solutions today.',
      header: {
        type: 'TEXT',
        text: 'Welcome to NexaFlow',
      },
      footer: 'Reply STOP to unsubscribe',
      variables: ['1'],
    });

    await MessageTemplate.create({
      workspaceId: workspace._id,
      name: 'order_update',
      language: 'en_US',
      category: 'UTILITY',
      status: 'APPROVED',
      body: 'Your order #{{1}} has been updated. Current status: {{2}}.',
      variables: ['1', '2'],
    });
    console.log('Message Templates created.');

    console.log('Creating Notifications...');
    await Notification.create({
      workspaceId: workspace._id,
      userId: user._id,
      title: 'Database Initialized',
      message: 'All collections and seed data have been initialized successfully.',
      type: 'system',
      read: false,
    });

    console.log('\n======================================================');
    console.log('🎉 DATABASE SEED COMPLETED SUCCESSFULLY!');
    console.log('======================================================');
    console.log(`Database Name : ${mongoose.connection.name}`);
    console.log(`Collections   : users, workspaces, workspacemembers,`);
    console.log(`                whatsappaccounts, contacts, conversations,`);
    console.log(`                messages, automations, messagetemplates,`);
    console.log(`                tags, notifications`);
    console.log('======================================================\n');

    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database seed error:', err);
    process.exit(1);
  }
}

seedDatabase();
