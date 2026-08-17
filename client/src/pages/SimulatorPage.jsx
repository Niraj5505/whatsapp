import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Terminal, Send, Bot, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Loader } from '../components/common/StatCard';

const SimulatorPage = () => {
  // Outbound Meta Message
  const [toPhone, setToPhone] = useState('+1234567890');
  const [testMessage, setTestMessage] = useState('Hello from NexaFlow! This is a test WhatsApp message.');
  const [isSending, setIsSending] = useState(false);
  const [outboundLogs, setOutboundLogs] = useState(null);

  // Inbound Simulation
  const [simPhone, setSimPhone] = useState('+1987654321');
  const [simName, setSimName] = useState('Customer Lead');
  const [simMessage, setSimMessage] = useState('hi, what are your pricing plans?');
  const [isSimulating, setIsSimulating] = useState(false);

  // Webhook audit logs
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get('/whatsapp/webhook-logs');
      setWebhookLogs(res.data.data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSendTestOutbound = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setOutboundLogs(null);
    try {
      const res = await api.post('/whatsapp/send-test', {
        to: toPhone,
        message: testMessage,
      });
      toast.success('Dispatched to Meta Graph API');
      setOutboundLogs(res.data);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      toast.error(`Meta API: ${errorMsg}`);
      setOutboundLogs(err.response?.data || { error: errorMsg });
    } finally {
      setIsSending(false);
    }
  };

  const handleSimulateInbound = async (e) => {
    e.preventDefault();
    setIsSimulating(true);
    try {
      await api.post('/whatsapp/simulate-incoming', {
        fromPhone: simPhone,
        contactName: simName,
        messageText: simMessage,
      });
      toast.success('Inbound simulated! Flow Engine triggered & Inbox updated.');
      fetchLogs();
    } catch (err) {
      toast.error('Simulation error: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-zinc-800/80 pb-5">
        <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
          <Terminal size={18} className="text-zinc-400" />
          <span>Meta API Console & Webhook Simulator</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Dispatch test messages to Meta Graph API and simulate inbound customer events for testing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Outbound Meta WhatsApp Sender */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 border-b border-zinc-850 pb-2.5">
            <Send size={14} className="text-emerald-400" />
            <span>Direct Outbound Dispatch (Meta Graph API)</span>
          </div>

          <form onSubmit={handleSendTestOutbound} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">
                Recipient Phone (E.164)
              </label>
              <input
                type="text"
                required
                value={toPhone}
                onChange={(e) => setToPhone(e.target.value)}
                placeholder="+1234567890"
                className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">Message Text</label>
              <textarea
                rows={3}
                required
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full bg-zinc-950 text-zinc-100 text-xs p-2.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 font-mono leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Send size={13} />
              <span>{isSending ? 'Dispatching...' : 'Send Live Message'}</span>
            </button>
          </form>

          {outboundLogs && (
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-850 text-xs font-mono overflow-x-auto max-h-36">
              <pre className="text-zinc-300">{JSON.stringify(outboundLogs, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Inbound Simulator */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 border-b border-zinc-850 pb-2.5">
            <Bot size={14} className="text-zinc-400" />
            <span>Simulate Inbound Customer Message</span>
          </div>

          <form onSubmit={handleSimulateInbound} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-300">Customer Phone</label>
                <input
                  type="text"
                  required
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="w-full bg-zinc-950 text-zinc-100 text-xs px-2.5 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-300">Customer Name</label>
                <input
                  type="text"
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full bg-zinc-950 text-zinc-100 text-xs px-2.5 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">
                Incoming Text (e.g. "hello", "pricing", "support")
              </label>
              <textarea
                rows={3}
                required
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                className="w-full bg-zinc-950 text-zinc-100 text-xs p-2.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 font-mono leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isSimulating}
              className="w-full py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-750 text-zinc-200 font-medium text-xs border border-zinc-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Bot size={13} />
              <span>{isSimulating ? 'Processing...' : 'Simulate Inbound Event'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Webhook Activity Stream */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs">
            <span>Webhook Event Log</span>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <RefreshCw size={13} className={loadingLogs ? 'animate-spin' : ''} />
          </button>
        </div>

        {loadingLogs ? (
          <Loader size="sm" />
        ) : webhookLogs.length === 0 ? (
          <div className="text-center py-6 text-xs text-zinc-500 font-mono">
            No webhook events recorded yet.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto font-mono text-xs">
            {webhookLogs.map((log) => (
              <div key={log._id} className="p-2.5 bg-zinc-950 border border-zinc-850 rounded-lg space-y-0.5">
                <div className="flex items-center justify-between text-zinc-500 text-[10px]">
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                  <span className="text-emerald-400">{log.eventType}</span>
                </div>
                <pre className="text-zinc-300 text-[11px] overflow-x-auto">
                  {JSON.stringify(log.rawPayload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulatorPage;
