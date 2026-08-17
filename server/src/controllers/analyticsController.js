const mongoose = require('mongoose');
const {
  Message,
  Contact,
  Conversation,
  Campaign,
  CampaignRecipient,
  Automation,
  AutomationExecution,
} = require('../models');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Resolves Date Range from Period Filter
 */
const resolveDateRange = (period = '7d', customStart, customEnd) => {
  const end = customEnd ? new Date(customEnd) : new Date();
  let start = new Date();

  switch (period.toLowerCase()) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case '7d':
    case '7 days':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
    case '30 days':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
    case '90 days':
      start.setDate(start.getDate() - 90);
      break;
    case 'custom':
      if (customStart) {
        start = new Date(customStart);
      } else {
        start.setDate(start.getDate() - 30);
      }
      break;
    default:
      start.setDate(start.getDate() - 7);
  }

  return { start, end };
};

/**
 * 1. Get Real-Time SaaS Analytics Dashboard Metrics via MongoDB Aggregation
 * GET /api/analytics/dashboard or GET /api/analytics
 */
const getDashboardAnalytics = async (req, res, next) => {
  try {
    const { period = '7d', startDate, endDate } = req.query;
    const { start, end } = resolveDateRange(period, startDate, endDate);
    const workspaceObjId = new mongoose.Types.ObjectId(req.workspaceId);

    // Date grouping format
    const isToday = period === 'today';
    const dateFormat = isToday ? '%Y-%m-%d %H:00' : '%Y-%m-%d';

    // 1. Optimized Aggregate: Message KPIs by Direction & Status
    const messageAggregate = await Message.aggregate([
      {
        $match: {
          workspaceId: workspaceObjId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          sent: {
            $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] },
          },
          received: {
            $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] },
          },
          delivered: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$direction', 'outbound'] },
                    { $in: ['$status', ['delivered', 'read']] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          read: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$direction', 'outbound'] },
                    { $eq: ['$status', 'read'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          failed: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$direction', 'outbound'] },
                    { $eq: ['$status', 'failed'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const msgStats = messageAggregate[0] || {
      totalMessages: 0,
      sent: 0,
      received: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    };

    // Calculate Dynamic Rates
    const deliveryRate =
      msgStats.sent > 0
        ? Math.round((msgStats.delivered / msgStats.sent) * 100)
        : 0;

    const readRate =
      msgStats.delivered > 0
        ? Math.round((msgStats.read / msgStats.delivered) * 100)
        : 0;

    const totalEngagement = msgStats.sent + msgStats.received;
    const responseRate =
      totalEngagement > 0
        ? Math.round((msgStats.received / totalEngagement) * 100)
        : 0;

    // 2. Aggregate: Messages Over Time Chart
    const messagesOverTime = await Message.aggregate([
      {
        $match: {
          workspaceId: workspaceObjId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: '$createdAt' },
          },
          sent: {
            $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] },
          },
          received: {
            $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] },
          },
          delivered: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$direction', 'outbound'] },
                    { $in: ['$status', ['delivered', 'read']] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          read: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$direction', 'outbound'] },
                    { $eq: ['$status', 'read'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          failed: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$direction', 'outbound'] },
                    { $eq: ['$status', 'failed'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 3. Conversation & Contact KPIs
    const [
      activeConversations,
      totalConversations,
      newContacts,
      totalContacts,
    ] = await Promise.all([
      Conversation.countDocuments({
        workspaceId: req.workspaceId,
        $or: [
          { status: 'open' },
          { lastMessageAt: { $gte: start } },
        ],
      }),
      Conversation.countDocuments({ workspaceId: req.workspaceId }),
      Contact.countDocuments({
        workspaceId: req.workspaceId,
        createdAt: { $gte: start, $lte: end },
      }),
      Contact.countDocuments({ workspaceId: req.workspaceId }),
    ]);

    // 4. Aggregate: Automation Executions
    const automationAggregate = await AutomationExecution.aggregate([
      {
        $match: {
          workspaceId: workspaceObjId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalRuns: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
          },
          running: {
            $sum: { $cond: [{ $eq: ['$status', 'running'] }, 1, 0] },
          },
        },
      },
    ]);

    const autoStats = automationAggregate[0] || {
      totalRuns: 0,
      completed: 0,
      failed: 0,
      running: 0,
    };

    const automationSuccessRate =
      autoStats.totalRuns > 0
        ? Math.round((autoStats.completed / autoStats.totalRuns) * 100)
        : 0;

    // Top 5 Automations by Execution Volume
    const topAutomations = await AutomationExecution.aggregate([
      {
        $match: {
          workspaceId: workspaceObjId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$automationId',
          totalExecutions: { $sum: 1 },
          successCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          failedCount: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
      { $sort: { totalExecutions: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'automations',
          localField: '_id',
          foreignField: '_id',
          as: 'automation',
        },
      },
      { $unwind: { path: '$automation', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: { $ifNull: ['$automation.name', 'Unnamed Flow'] },
          totalExecutions: 1,
          successCount: 1,
          failedCount: 1,
        },
      },
    ]);

    // 5. Aggregate: Campaign Performance
    const campaignAggregate = await Campaign.aggregate([
      {
        $match: {
          workspaceId: workspaceObjId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          totalRecipients: { $sum: '$statistics.totalRecipients' },
          sent: { $sum: '$statistics.sent' },
          delivered: { $sum: '$statistics.delivered' },
          read: { $sum: '$statistics.read' },
          failed: { $sum: '$statistics.failed' },
        },
      },
    ]);

    const campaignStats = campaignAggregate[0] || {
      totalCampaigns: 0,
      totalRecipients: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    };

    return sendSuccess(res, 'Analytics aggregated successfully from MongoDB', {
      timeRange: {
        period,
        start,
        end,
      },
      metrics: {
        // Message KPIs
        messagesSent: msgStats.sent,
        messagesReceived: msgStats.received,
        messagesDelivered: msgStats.delivered,
        messagesRead: msgStats.read,
        messagesFailed: msgStats.failed,
        totalMessages: msgStats.totalMessages,

        // Conversion & Quality Rates
        deliveryRate: `${deliveryRate}%`,
        readRate: `${readRate}%`,
        responseRate: `${responseRate}%`,
        deliveryRateValue: deliveryRate,
        readRateValue: readRate,
        responseRateValue: responseRate,

        // Audience KPIs
        activeConversations,
        totalConversations,
        newContacts,
        totalContacts,

        // Automation KPIs
        automationExecutions: autoStats.totalRuns,
        automationSuccessRate: `${automationSuccessRate}%`,
        automationCompleted: autoStats.completed,
        automationFailed: autoStats.failed,

        // Campaign KPIs
        campaignsTotal: campaignStats.totalCampaigns,
        campaignsRecipients: campaignStats.totalRecipients,
        campaignsSent: campaignStats.sent,
        campaignsDelivered: campaignStats.delivered,
        campaignsRead: campaignStats.read,
        campaignsFailed: campaignStats.failed,
      },
      charts: {
        messagesOverTime,
        topAutomations,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardAnalytics,
};
