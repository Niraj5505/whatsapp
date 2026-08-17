import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Loader, Modal, Badge } from '../components/common/StatCard';
import {
  Radio,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  Trash2,
  Eye,
  Calendar,
  Tag,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_BADGES = {
  DRAFT: 'default',
  SCHEDULED: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  PAUSED: 'default',
  CANCELLED: 'danger',
  FAILED: 'danger',
};

const CampaignsPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tags, setTags] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  // Form State
  const [name, setName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  // Recipient Tracker Modal
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState('all');

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [campRes, tempRes, contactsRes, accRes] = await Promise.all([
        api.get('/campaigns'),
        api.get('/templates?status=APPROVED'),
        api.get('/contacts?limit=1'),
        api.get('/whatsapp').catch(() => ({ data: { data: { accounts: [] } } })),
      ]);

      setCampaigns(campRes.data.data.campaigns || []);
      setTemplates(tempRes.data.data.templates || []);
      setTags(contactsRes.data.data.tags || []);
      setAccounts(accRes.data.data?.accounts || []);
    } catch (err) {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const openWizard = () => {
    setName('');
    setSelectedAccountId(accounts[0]?._id || '');
    setSelectedTemplateId(templates[0]?._id || '');
    setSelectedTagIds([]);
    setIsScheduled(false);
    setScheduledAt('');
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t._id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  const handleViewRecipients = async (campaign) => {
    setActiveCampaign(campaign);
    setLoadingRecipients(true);
    try {
      const res = await api.get(`/campaigns/${campaign._id}/recipients?status=${recipientFilter}`);
      setRecipients(res.data.data.recipients || []);
    } catch (err) {
      toast.error('Failed to load recipients');
    } finally {
      setLoadingRecipients(false);
    }
  };

  useEffect(() => {
    if (activeCampaign) {
      api.get(`/campaigns/${activeCampaign._id}/recipients?status=${recipientFilter}`)
        .then((res) => setRecipients(res.data.data.recipients || []))
        .catch(() => {});
    }
  }, [recipientFilter, activeCampaign]);

  const handleLaunchCampaign = async (autoStart = true) => {
    if (!name.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }
    if (!selectedTemplateId) {
      toast.error('Please select an approved Meta template');
      return;
    }

    try {
      const payload = {
        name,
        whatsappAccountId: selectedAccountId || undefined,
        templateId: selectedTemplateId,
        targetTags: selectedTagIds,
        scheduledAt: isScheduled && scheduledAt ? new Date(scheduledAt) : null,
        autoStart,
      };

      const res = await api.post('/campaigns', payload);
      toast.success(res.data.message || 'Campaign created successfully');
      setIsWizardOpen(false);
      fetchInitialData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create campaign');
    }
  };

  const handleStartCampaign = async (campaignId) => {
    try {
      const res = await api.post(`/campaigns/${campaignId}/start`);
      toast.success(res.data.message || 'Campaign dispatch started');
      fetchInitialData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start campaign');
    }
  };

  const handlePauseCampaign = async (campaignId) => {
    try {
      await api.post(`/campaigns/${campaignId}/pause`);
      toast.success('Campaign paused');
      fetchInitialData();
    } catch (err) {
      toast.error('Failed to pause campaign');
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Delete this broadcast campaign?')) return;
    try {
      await api.delete(`/campaigns/${campaignId}`);
      toast.success('Campaign deleted');
      setCampaigns((prev) => prev.filter((c) => c._id !== campaignId));
      if (activeCampaign?._id === campaignId) setActiveCampaign(null);
    } catch (err) {
      toast.error('Failed to delete campaign');
    }
  };

  const toggleTag = (tagId) => {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter((t) => t !== tagId));
    } else {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Broadcast Campaigns
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Send template broadcasts to opted-in audiences with real-time delivery tracking.
          </p>
        </div>

        <button
          onClick={openWizard}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white transition-colors shadow-xs"
        >
          <Plus size={14} />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <Loader size="md" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-12 text-center">
          <Radio size={32} className="mx-auto text-zinc-600 mb-2" />
          <h3 className="text-sm font-semibold text-zinc-200">No Campaigns Yet</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Create an audience campaign using approved Meta templates to dispatch broadcast alerts.
          </p>
          <button
            onClick={openWizard}
            className="mt-4 px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Launch Wizard</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((camp) => {
            const stats = camp.statistics || {};
            const total = stats.totalRecipients || 0;
            const sent = stats.sent || 0;
            const delivered = stats.delivered || 0;
            const read = stats.read || 0;
            const failed = stats.failed || 0;
            const progressPercent = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;
            const normalizedStatus = String(camp.status || 'DRAFT').toUpperCase();

            return (
              <div
                key={camp._id}
                className="bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-4 sm:p-5 transition-colors space-y-3.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-semibold text-zinc-100">{camp.name}</h3>
                      <Badge variant={STATUS_BADGES[normalizedStatus] || 'default'}>
                        {normalizedStatus}
                      </Badge>
                      {camp.scheduledAt && normalizedStatus === 'SCHEDULED' && (
                        <span className="text-[11px] font-mono text-amber-400 flex items-center gap-1">
                          <Clock size={11} />
                          <span>{new Date(camp.scheduledAt).toLocaleString()}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                      Template: {camp.templateId?.name || 'Custom'} • {new Date(camp.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {['DRAFT', 'PAUSED'].includes(normalizedStatus) && (
                      <button
                        onClick={() => handleStartCampaign(camp._id)}
                        className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold flex items-center gap-1"
                      >
                        <Play size={12} />
                        <span>{normalizedStatus === 'PAUSED' ? 'Resume' : 'Launch'}</span>
                      </button>
                    )}

                    {normalizedStatus === 'PROCESSING' && (
                      <button
                        onClick={() => handlePauseCampaign(camp._id)}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium flex items-center gap-1 border border-zinc-700"
                      >
                        <Pause size={12} />
                        <span>Pause</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleViewRecipients(camp)}
                      className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium border border-zinc-700 flex items-center gap-1"
                    >
                      <Eye size={12} className="text-zinc-400" />
                      <span>Tracker</span>
                    </button>

                    <button
                      onClick={() => handleDeleteCampaign(camp._id)}
                      className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                    <span>Progress: {progressPercent}%</span>
                    <span>{sent + failed} / {total}</span>
                  </div>
                  <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-850">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono">
                  <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">Total</span>
                    <span className="text-xs font-bold text-zinc-200">{total}</span>
                  </div>
                  <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">Sent</span>
                    <span className="text-xs font-bold text-zinc-200">{sent}</span>
                  </div>
                  <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">Delivered</span>
                    <span className="text-xs font-bold text-emerald-400">{delivered}</span>
                  </div>
                  <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">Read</span>
                    <span className="text-xs font-bold text-sky-400">{read}</span>
                  </div>
                  <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">Failed</span>
                    <span className="text-xs font-bold text-rose-400">{failed}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Campaign Creation Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title={`New Campaign — Step ${wizardStep} of 4`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 text-xs">
          {wizardStep === 1 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block font-medium text-zinc-300">Campaign Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VIP Product Launch Announcement"
                  className="w-full bg-zinc-950 text-zinc-100 px-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-medium text-zinc-300">Select Approved Template *</label>
                {templates.length === 0 ? (
                  <div className="p-3 bg-zinc-950 rounded-md border border-zinc-800 text-zinc-400 text-xs">
                    No approved templates found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {templates.map((tpl) => (
                      <div
                        key={tpl._id}
                        onClick={() => setSelectedTemplateId(tpl._id)}
                        className={`p-2.5 rounded-md border cursor-pointer transition-colors ${
                          selectedTemplateId === tpl._id
                            ? 'bg-zinc-850 border-zinc-600 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-zinc-100">{tpl.name}</span>
                          <span className="text-[9px] font-mono px-1 rounded bg-emerald-950 text-emerald-400">
                            APPROVED
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{tpl.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-3">
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-200 font-semibold">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Opt-Out Privacy Guarantee</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Opted-out contacts will be automatically excluded from this broadcast.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block font-medium text-zinc-300">
                  Target Audience Tags (Leave empty for all contacts)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const isSelected = selectedTagIds.includes(t._id);
                    return (
                      <button
                        key={t._id}
                        type="button"
                        onClick={() => toggleTag(t._id)}
                        className={`px-2.5 py-1 rounded text-xs font-mono transition-colors border ${
                          isSelected
                            ? 'bg-zinc-800 text-zinc-100 border-zinc-600 font-semibold'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        #{t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-3">
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg max-w-sm mx-auto space-y-2 font-sans">
                {selectedTemplate?.header?.type === 'TEXT' && selectedTemplate?.header?.text && (
                  <div className="font-semibold text-zinc-100 text-xs pb-1 border-b border-zinc-800">
                    {selectedTemplate.header.text}
                  </div>
                )}
                <p className="text-zinc-200 text-xs whitespace-pre-wrap leading-relaxed">
                  {selectedTemplate?.body?.replace(/\{\{1\}\}/g, 'Alex')?.replace(/\{\{2\}\}/g, '+15551234567')}
                </p>
                {selectedTemplate?.footer && (
                  <p className="text-[10px] text-zinc-500">{selectedTemplate.footer}</p>
                )}
              </div>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduled(false)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    !isScheduled
                      ? 'bg-zinc-850 border-zinc-600 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  <Send size={14} className="text-zinc-300 mb-1" />
                  <div className="font-semibold text-xs">Send Immediately</div>
                  <p className="text-[10px] text-zinc-500">Dispatch in worker</p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsScheduled(true)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    isScheduled
                      ? 'bg-zinc-850 border-zinc-600 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  <Calendar size={14} className="text-amber-400 mb-1" />
                  <div className="font-semibold text-xs">Schedule for Later</div>
                  <p className="text-[10px] text-zinc-500">Trigger on date/time</p>
                </button>
              </div>

              {isScheduled && (
                <div className="space-y-1">
                  <label className="block font-medium text-zinc-300">
                    Scheduled Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-zinc-950 text-zinc-100 px-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="pt-3 border-t border-zinc-800 flex justify-between items-center">
            {wizardStep > 1 ? (
              <button
                type="button"
                onClick={() => setWizardStep(wizardStep - 1)}
                className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {wizardStep < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (wizardStep === 1 && !name.trim()) {
                    toast.error('Please enter a campaign name');
                    return;
                  }
                  if (wizardStep === 1 && !selectedTemplateId) {
                    toast.error('Please select an approved template');
                    return;
                  }
                  setWizardStep(wizardStep + 1);
                }}
                className="px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold flex items-center gap-1"
              >
                <span>Next</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleLaunchCampaign(true)}
                className="px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold flex items-center gap-1"
              >
                <CheckCircle2 size={13} />
                <span>Launch Campaign</span>
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Recipient Tracker Modal */}
      {activeCampaign && (
        <Modal
          isOpen={Boolean(activeCampaign)}
          onClose={() => setActiveCampaign(null)}
          title={`Delivery Tracker: ${activeCampaign.name}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-1 font-mono text-xs">
              {['all', 'queued', 'sent', 'delivered', 'read', 'failed'].map((st) => (
                <button
                  key={st}
                  onClick={() => setRecipientFilter(st)}
                  className={`px-2 py-0.5 rounded capitalize transition-colors ${
                    recipientFilter === st
                      ? 'bg-zinc-800 text-zinc-100 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="bg-zinc-950 border border-zinc-850 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900 text-[10px] uppercase font-mono text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-3 py-2">Contact</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850 font-mono text-[11px]">
                  {loadingRecipients ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-500 font-sans">
                        Loading...
                      </td>
                    </tr>
                  ) : recipients.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-500 font-sans">
                        No recipients match this filter.
                      </td>
                    </tr>
                  ) : (
                    recipients.map((rec) => (
                      <tr key={rec._id} className="hover:bg-zinc-900/50">
                        <td className="px-3 py-2 font-sans font-medium text-zinc-100">
                          {rec.contactId?.name || 'Contact'}
                        </td>
                        <td className="px-3 py-2 text-zinc-300">{rec.phoneNumber}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                              rec.status === 'read'
                                ? 'bg-sky-950 text-sky-400'
                                : rec.status === 'delivered'
                                ? 'bg-emerald-950 text-emerald-400'
                                : rec.status === 'sent'
                                ? 'bg-zinc-800 text-zinc-300'
                                : rec.status === 'failed'
                                ? 'bg-rose-950 text-rose-400'
                                : 'bg-zinc-900 text-zinc-500'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-zinc-500 text-[10px]">
                          {rec.sentAt ? new Date(rec.sentAt).toLocaleTimeString() : 'Queued'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CampaignsPage;
