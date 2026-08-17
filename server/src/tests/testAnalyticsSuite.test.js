const mongoose = require('mongoose');
const { getDashboardAnalytics } = require('../controllers/analyticsController');
const {
  Message,
  Contact,
  Conversation,
  Campaign,
  AutomationExecution,
} = require('../models');

async function testAnalyticsSuite() {
  console.log('🧪 Testing NexaFlow Real Analytics Aggregation Suite...\n');

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

  const workspaceId = '65d3c3333333333333333333';

  // Mock message aggregate returns realistic sample data
  Message.aggregate = async (pipeline) => {
    // Check if grouping by time or overall KPIs
    const isOverTime = pipeline[1]?.$group?._id?.$dateToString;

    if (isOverTime) {
      return [
        { _id: '2026-08-10', sent: 50, received: 30, delivered: 48, read: 40, failed: 2 },
        { _id: '2026-08-11', sent: 65, received: 45, delivered: 63, read: 55, failed: 2 },
        { _id: '2026-08-12', sent: 80, received: 50, delivered: 78, read: 70, failed: 2 },
      ];
    }

    return [
      {
        _id: null,
        totalMessages: 195,
        sent: 195,
        received: 125,
        delivered: 189,
        read: 165,
        failed: 6,
      },
    ];
  };

  // Mock Contact count
  Contact.countDocuments = async () => 350;

  // Mock Conversation count
  Conversation.countDocuments = async () => 85;

  // Mock Automation aggregate
  AutomationExecution.aggregate = async (pipeline) => {
    const isTopLookup = pipeline.some((p) => p.$lookup);
    if (isTopLookup) {
      return [
        { _id: 'flow_1', name: 'Order Confirmation Bot', totalExecutions: 120, successCount: 115, failedCount: 5 },
        { _id: 'flow_2', name: 'Welcome Lead Flow', totalExecutions: 85, successCount: 82, failedCount: 3 },
      ];
    }
    return [
      {
        _id: null,
        totalRuns: 205,
        completed: 197,
        failed: 8,
        running: 0,
      },
    ];
  };

  // Mock Campaign aggregate
  Campaign.aggregate = async () => [
    {
      _id: null,
      totalCampaigns: 4,
      totalRecipients: 500,
      sent: 490,
      delivered: 475,
      read: 420,
      failed: 10,
    },
  ];

  let resStatus = 200;
  let resData = null;
  const res = {
    status(c) { resStatus = c; return this; },
    json(d) { resData = d; return this; },
  };

  // TEST 1: Default 7 Days Filter
  const req7d = { workspaceId, query: { period: '7d' } };
  await getDashboardAnalytics(req7d, res, (e) => { if (e) throw e; });
  assert(resStatus === 200, 'GET /api/analytics returns 200 OK');
  assert(resData.data.timeRange.period === '7d', 'Period resolved as 7d');
  assert(resData.data.metrics.messagesSent === 195, 'Aggregates total outbound sent messages');
  assert(resData.data.metrics.messagesReceived === 125, 'Aggregates inbound customer replies');
  assert(resData.data.metrics.messagesDelivered === 189, 'Aggregates delivered messages');
  assert(resData.data.metrics.messagesRead === 165, 'Aggregates read messages');

  // TEST 2: Dynamic Rate Calculations
  assert(resData.data.metrics.deliveryRate === '97%', 'Delivery rate correctly calculated (189/195 = 97%)');
  assert(resData.data.metrics.readRate === '87%', 'Read rate correctly calculated (165/189 = 87%)');
  assert(resData.data.metrics.automationSuccessRate === '96%', 'Automation success rate calculated (197/205 = 96%)');

  // TEST 3: Messages Over Time Chart Array
  assert(resData.data.charts.messagesOverTime.length === 3, 'Messages over time aggregation grouped by date');
  assert(resData.data.charts.topAutomations.length === 2, 'Top automations performance aggregated');
  assert(resData.data.charts.topAutomations[0].name === 'Order Confirmation Bot', 'Automation names populated correctly');

  // TEST 4: Today Filter
  const reqToday = { workspaceId, query: { period: 'today' } };
  await getDashboardAnalytics(reqToday, res, (e) => { if (e) throw e; });
  assert(resData.data.timeRange.period === 'today', 'Period resolved as today');

  // TEST 5: Custom Date Range Filter
  const reqCustom = {
    workspaceId,
    query: {
      period: 'custom',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
    },
  };
  await getDashboardAnalytics(reqCustom, res, (e) => { if (e) throw e; });
  assert(resData.data.timeRange.period === 'custom', 'Period resolved as custom range');

  console.log(`\n🎉 ALL ${passed}/${total} ANALYTICS AGGREGATION TESTS PASSED!`);
}

testAnalyticsSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
