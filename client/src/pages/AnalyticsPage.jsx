import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Loader } from '../components/common/StatCard';
import {
  TrendingUp,
  RefreshCw,
  Zap,
  Radio,
} from 'lucide-react';
import toast from 'react-hot-toast';

const TIME_FILTERS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'custom', label: 'Custom' },
];

const AnalyticsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = async (selectedPeriod = period, start = customStart, end = customEnd) => {
    setIsRefreshing(true);
    try {
      let url = `/analytics?period=${selectedPeriod}`;
      if (selectedPeriod === 'custom' && start && end) {
        url += `&startDate=${start}&endDate=${end}`;
      }
      const res = await api.get(url);
      setData(res.data.data);
    } catch (err) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(period);
  }, [period]);

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (!customStart || !customEnd) {
      toast.error('Please select start and end dates');
      return;
    }
    fetchAnalytics('custom', customStart, customEnd);
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col justify-center items-center gap-2 text-zinc-400 text-xs">
        <Loader size="lg" />
        <span className="font-mono text-zinc-500">Aggregating analytics...</span>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const charts = data?.charts || {};
  const messagesOverTime = charts.messagesOverTime || [];
  const topAutomations = charts.topAutomations || [];

  const maxBarValue = Math.max(
    ...messagesOverTime.map((d) => Math.max(d.sent || 0, d.received || 0)),
    10
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Analytics
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time delivery rates, volume trends, and workflow executions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-md p-0.5 flex items-center gap-0.5">
            {TIME_FILTERS.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setPeriod(tf.id)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  period === tf.id
                    ? 'bg-zinc-800 text-zinc-100 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchAnalytics(period)}
            disabled={isRefreshing}
            className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Custom Date Form */}
      {period === 'custom' && (
        <form
          onSubmit={handleApplyCustom}
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-wrap items-center gap-2 text-xs"
        >
          <span className="text-zinc-400 font-mono text-[11px]">From:</span>
          <input
            type="date"
            required
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-zinc-950 text-zinc-200 px-2 py-1 rounded border border-zinc-800 text-xs font-mono"
          />
          <span className="text-zinc-400 font-mono text-[11px]">To:</span>
          <input
            type="date"
            required
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-zinc-950 text-zinc-200 px-2 py-1 rounded border border-zinc-800 text-xs font-mono"
          />
          <button
            type="submit"
            className="px-3 py-1 rounded bg-zinc-100 text-zinc-950 font-semibold text-xs hover:bg-white"
          >
            Filter
          </button>
        </form>
      )}

      {/* Rate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
            Delivery Rate
          </span>
          <div className="text-2xl font-bold text-zinc-100 font-mono">
            {metrics.deliveryRate || '0%'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 flex justify-between pt-2 border-t border-zinc-850">
            <span>Delivered: {metrics.messagesDelivered || 0}</span>
            <span>Failed: {metrics.messagesFailed || 0}</span>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
            Read Receipt Rate
          </span>
          <div className="text-2xl font-bold text-zinc-100 font-mono">
            {metrics.readRate || '0%'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 flex justify-between pt-2 border-t border-zinc-850">
            <span>Read: {metrics.messagesRead || 0}</span>
            <span>Sent: {metrics.messagesSent || 0}</span>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
            Inbound Response Rate
          </span>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {metrics.responseRate || '0%'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 flex justify-between pt-2 border-t border-zinc-850">
            <span>Replies: {metrics.messagesReceived || 0}</span>
            <span>Chats: {metrics.activeConversations || 0}</span>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
            Automation Success Rate
          </span>
          <div className="text-2xl font-bold text-zinc-100 font-mono">
            {metrics.automationSuccessRate || '0%'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 flex justify-between pt-2 border-t border-zinc-850">
            <span>Executions: {metrics.automationExecutions || 0}</span>
            <span>Passed: {metrics.automationCompleted || 0}</span>
          </div>
        </div>
      </div>

      {/* Messages Over Time Graph */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-zinc-400" />
            <h3 className="text-xs font-semibold text-zinc-200">
              Message Throughput Trend
            </h3>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-zinc-300 inline-block" />
              <span>Outbound</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              <span>Inbound</span>
            </div>
          </div>
        </div>

        {messagesOverTime.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-lg">
            No message activity in this timeframe.
          </div>
        ) : (
          <div className="h-48 flex items-end gap-2 pt-4 px-2 bg-zinc-950 rounded-lg p-3 overflow-x-auto border border-zinc-850">
            {messagesOverTime.map((d, idx) => {
              const sentH = Math.max(4, Math.round(((d.sent || 0) / maxBarValue) * 100));
              const recH = Math.max(4, Math.round(((d.received || 0) / maxBarValue) * 100));
              const label = d._id?.split(' ')[1] || d._id?.split('-')?.slice(1)?.join('/');

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 min-w-[32px] group">
                  <div className="w-full flex justify-center items-end gap-1 h-36">
                    <div
                      style={{ height: `${sentH}%` }}
                      className="w-2 sm:w-2.5 bg-zinc-400 rounded-t hover:bg-zinc-200 transition-colors"
                      title={`Sent: ${d.sent || 0}`}
                    />
                    <div
                      style={{ height: `${recH}%` }}
                      className="w-2 sm:w-2.5 bg-emerald-500 rounded-t hover:bg-emerald-400 transition-colors"
                      title={`Received: ${d.received || 0}`}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[36px]">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Automations and Campaigns Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Automations */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
            <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Zap size={14} className="text-zinc-400" />
              <span>Flow Performance</span>
            </h3>
            <span className="text-xs font-mono text-zinc-500">
              {metrics.automationExecutions || 0} total runs
            </span>
          </div>

          {topAutomations.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              No executions in this period.
            </div>
          ) : (
            <div className="space-y-1.5">
              {topAutomations.map((flow, idx) => (
                <div
                  key={idx}
                  className="bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono"
                >
                  <div className="space-y-0.5">
                    <span className="font-medium text-zinc-200 font-sans">{flow.name}</span>
                    <div className="text-[10px] text-zinc-500 flex gap-2">
                      <span className="text-emerald-400">✓ {flow.successCount || 0}</span>
                      <span className="text-rose-400">✕ {flow.failedCount || 0}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-zinc-300">
                    {flow.totalExecutions} runs
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Broadcast Campaigns */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
            <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Radio size={14} className="text-zinc-400" />
              <span>Broadcast Campaigns</span>
            </h3>
            <span className="text-xs font-mono text-zinc-500">
              {metrics.campaignsTotal || 0} total
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-2.5">
              <span className="text-[10px] text-zinc-500 block">Queued</span>
              <p className="text-base font-bold text-zinc-200 mt-0.5">
                {metrics.campaignsRecipients || 0}
              </p>
            </div>
            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-2.5">
              <span className="text-[10px] text-zinc-500 block">Sent</span>
              <p className="text-base font-bold text-zinc-200 mt-0.5">
                {metrics.campaignsSent || 0}
              </p>
            </div>
            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-2.5">
              <span className="text-[10px] text-zinc-500 block">Delivered</span>
              <p className="text-base font-bold text-emerald-400 mt-0.5">
                {metrics.campaignsDelivered || 0}
              </p>
            </div>
            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-2.5">
              <span className="text-[10px] text-zinc-500 block">Read Receipts</span>
              <p className="text-base font-bold text-sky-400 mt-0.5">
                {metrics.campaignsRead || 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
