import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { StatCard, Loader } from '../components/common/StatCard';
import {
  Users,
  MessageSquare,
  CheckCircle2,
  Radio,
  GitFork,
  ArrowUpRight,
  BarChart3,
  CheckCheck,
  Plus,
  Terminal,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DashboardPage = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get('/analytics/dashboard');
        setAnalytics(res.data.data);
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) return <Loader size="lg" />;

  const metrics = analytics?.metrics || {};
  const isMetaConfigured = Boolean(
    user?.metaConfig?.phoneNumberId && user?.metaConfig?.accessToken
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time overview of WhatsApp conversations, automated flows, and delivery performance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/campaigns"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-white transition-colors shadow-xs"
          >
            <Plus size={14} />
            <span>New Campaign</span>
          </Link>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:border-zinc-700 transition-colors"
          >
            <BarChart3 size={14} className="text-zinc-400" />
            <span>Analytics</span>
          </Link>
        </div>
      </div>

      {/* Meta API Alert if not configured */}
      {!isMetaConfigured && (
        <div className="rounded-lg bg-zinc-900 border border-amber-800/50 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-amber-950/60 border border-amber-800/40 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-zinc-200">
                Connect Meta WhatsApp Cloud API
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Configure your Phone Number ID and Access Token to dispatch live WhatsApp messages.
              </p>
            </div>
          </div>
          <Link
            to="/settings"
            className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 text-xs font-medium shrink-0 transition-colors"
          >
            Configure
          </Link>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Contacts"
          value={metrics.totalContacts || 0}
          subtext={`${metrics.newContacts || 0} new in 30 days`}
          icon={Users}
        />
        <StatCard
          title="Active Conversations"
          value={metrics.totalConversations || 0}
          subtext={`${metrics.activeConversations || 0} active currently`}
          icon={MessageSquare}
        />
        <StatCard
          title="Delivery Rate"
          value={metrics.deliveryRate || '0%'}
          subtext={`${metrics.messagesDelivered || 0} delivered`}
          icon={CheckCircle2}
        />
        <StatCard
          title="Read Rate"
          value={metrics.readRate || '0%'}
          subtext={`${metrics.messagesRead || 0} read receipts`}
          icon={CheckCheck}
        />
      </div>

      {/* Message Activity & Quick Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Message Metrics Table */}
        <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div>
              <h3 className="text-xs font-semibold text-zinc-200">
                Message Throughput & Flow Metrics
              </h3>
              <p className="text-[11px] text-zinc-500">
                Direct aggregation from MongoDB message and flow collections
              </p>
            </div>
            <Link
              to="/analytics"
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors"
            >
              <span>Explore</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-850">
              <span className="text-[11px] text-zinc-500 font-mono">Total Volume</span>
              <p className="text-lg font-bold text-zinc-100 font-mono mt-1">
                {metrics.totalMessages || 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-850">
              <span className="text-[11px] text-zinc-500 font-mono">Outbound Sent</span>
              <p className="text-lg font-bold text-zinc-200 font-mono mt-1">
                {metrics.messagesSent || 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-850">
              <span className="text-[11px] text-zinc-500 font-mono">Inbound Received</span>
              <p className="text-lg font-bold text-emerald-400 font-mono mt-1">
                {metrics.messagesReceived || 0}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-850 text-xs text-zinc-400 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="font-medium text-zinc-300">Automations Active</p>
              <p className="text-[11px] text-zinc-500 font-mono">
                {metrics.automationExecutions || 0} successful node runs recorded
              </p>
            </div>
            <Link
              to="/flows"
              className="text-xs font-mono text-emerald-400 hover:underline"
            >
              Manage Flows →
            </Link>
          </div>
        </div>

        {/* Right 1 Col: Quick Links */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-semibold text-zinc-200 border-b border-zinc-800/80 pb-3">
            Quick Actions
          </h3>

          <div className="space-y-1.5">
            <Link
              to="/inbox"
              className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-xs font-medium text-zinc-300 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare size={14} className="text-zinc-400 group-hover:text-zinc-200" />
                <span>Open Live Inbox</span>
              </div>
              <ArrowUpRight size={13} className="text-zinc-500 group-hover:text-zinc-300" />
            </Link>

            <Link
              to="/flows"
              className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-xs font-medium text-zinc-300 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <GitFork size={14} className="text-zinc-400 group-hover:text-zinc-200" />
                <span>Automation Flows</span>
              </div>
              <ArrowUpRight size={13} className="text-zinc-500 group-hover:text-zinc-300" />
            </Link>

            <Link
              to="/templates"
              className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-xs font-medium text-zinc-300 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <FileText size={14} className="text-zinc-400 group-hover:text-zinc-200" />
                <span>Meta Templates</span>
              </div>
              <ArrowUpRight size={13} className="text-zinc-500 group-hover:text-zinc-300" />
            </Link>

            <Link
              to="/simulator"
              className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-xs font-medium text-zinc-300 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Terminal size={14} className="text-zinc-400 group-hover:text-zinc-200" />
                <span>API Simulator</span>
              </div>
              <ArrowUpRight size={13} className="text-zinc-500 group-hover:text-zinc-300" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
