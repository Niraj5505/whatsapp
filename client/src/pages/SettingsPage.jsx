import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Copy, Check, ShieldCheck, RefreshCw, Activity, Key } from 'lucide-react';

const SettingsPage = () => {
  const { user, updateMetaConfig } = useAuth();

  const [phoneNumberId, setPhoneNumberId] = useState(user?.metaConfig?.phoneNumberId || '');
  const [businessAccountId, setBusinessAccountId] = useState(user?.metaConfig?.businessAccountId || '');
  const [accessToken, setAccessToken] = useState(user?.metaConfig?.accessToken || '');
  const [verifyToken, setVerifyToken] = useState(user?.metaConfig?.verifyToken || '');
  const [appSecret, setAppSecret] = useState(user?.metaConfig?.appSecret || '');
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(user?.metaConfig?.displayPhoneNumber || '');

  const [apiKey, setApiKey] = useState(user?.apiKey || '');
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const [healthStatus, setHealthStatus] = useState(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.get('/health');
        setHealthStatus(res.data);
      } catch (err) {
        setHealthStatus({ success: false, message: 'Offline' });
      }
    };
    checkHealth();
  }, []);

  const webhookUrl = `${window.location.origin}/api/webhooks/whatsapp`;

  const handleSaveMeta = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMetaConfig({
        phoneNumberId,
        businessAccountId,
        accessToken,
        verifyToken,
        appSecret,
        displayPhoneNumber,
      });
      toast.success('Meta configuration saved');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!window.confirm('Regenerate API key? Existing integrations will stop working.')) return;
    try {
      const res = await api.post('/auth/api-key/regenerate');
      setApiKey(res.data.data.apiKey);
      toast.success('New API Key generated');
    } catch (err) {
      toast.error('Failed to regenerate key');
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'webhook') {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-zinc-800/80 pb-5">
        <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
          Settings & Meta API Configuration
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Connect your official Meta WhatsApp Cloud API credentials to dispatch live messages.
        </p>
      </div>

      {/* System Status */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
            <Activity size={15} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-zinc-200">System & Database Status</h4>
            <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
              MongoDB: <span className="text-emerald-400">{healthStatus?.database || 'connected'}</span> • API: <span className="text-emerald-400">running</span>
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/50">
          ● Healthy
        </span>
      </div>

      {/* Webhook Configuration */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-3.5">
        <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs border-b border-zinc-850 pb-2.5">
          <ShieldCheck size={15} className="text-emerald-400" />
          <span>Meta WhatsApp Webhook Configuration</span>
        </div>
        <p className="text-xs text-zinc-400">
          Paste these credentials in your Meta for Developers App under WhatsApp &gt; Configuration &gt; Webhook:
        </p>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">Webhook Callback URL</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 bg-zinc-950 text-zinc-300 text-xs px-3 py-1.5 rounded-md border border-zinc-800 font-mono"
              />
              <button
                onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 rounded-md text-xs font-medium flex items-center gap-1 transition-colors border border-zinc-700"
              >
                {copiedWebhook ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">Verify Token</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={verifyToken || user?.metaConfig?.verifyToken || 'nexaflow_verify_token_default'}
                className="flex-1 bg-zinc-950 text-zinc-300 text-xs px-3 py-1.5 rounded-md border border-zinc-800 font-mono"
              />
              <button
                onClick={() =>
                  copyToClipboard(
                    verifyToken || user?.metaConfig?.verifyToken || 'nexaflow_verify_token_default',
                    'token'
                  )
                }
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 rounded-md text-xs font-medium flex items-center gap-1 transition-colors border border-zinc-700"
              >
                {copiedToken ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copiedToken ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Meta API Credentials Form */}
      <form onSubmit={handleSaveMeta} className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-zinc-200 border-b border-zinc-850 pb-2.5">
          Meta Cloud API Credentials
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">
              Phone Number ID
            </label>
            <input
              type="text"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="e.g. 1048291048291"
              className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">
              WhatsApp Business Account ID (WABA ID)
            </label>
            <input
              type="text"
              value={businessAccountId}
              onChange={(e) => setBusinessAccountId(e.target.value)}
              placeholder="e.g. 2938192839182"
              className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 font-mono"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="block text-xs font-medium text-zinc-300">
              Permanent System User Access Token
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="EAAG... (Bearer Token)"
              className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">
              Display Phone Number
            </label>
            <input
              type="text"
              value={displayPhoneNumber}
              onChange={(e) => setDisplayPhoneNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">
              App Secret (Optional for HMAC verification)
            </label>
            <input
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 font-mono"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-850 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>

      {/* Developer API Key */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs">
            <Key size={14} className="text-zinc-400" />
            <span>Developer API Key</span>
          </div>
          <button
            onClick={handleRegenerateApiKey}
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-[11px] text-zinc-300 font-medium flex items-center gap-1 border border-zinc-700"
          >
            <RefreshCw size={11} />
            <span>Regenerate</span>
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          Use this key in the <code className="text-zinc-200 font-mono">x-api-key</code> HTTP header to automate NexaFlow from external systems.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={apiKey}
            className="flex-1 bg-zinc-950 text-zinc-300 text-xs px-3 py-1.5 rounded-md border border-zinc-800 font-mono"
          />
          <button
            onClick={() => copyToClipboard(apiKey, 'key')}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 rounded-md text-xs font-medium flex items-center gap-1 transition-colors border border-zinc-700"
          >
            {copiedKey ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedKey ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
