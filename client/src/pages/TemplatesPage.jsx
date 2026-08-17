import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Loader, Modal, Badge } from '../components/common/StatCard';
import {
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  Eye,
  Search,
  ExternalLink,
  Phone,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_VARIANTS = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
  PAUSED: 'default',
  DRAFT: 'default',
};

const TemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activePreviewTemplate, setActivePreviewTemplate] = useState(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('en_US');
  const [headerType, setHeaderType] = useState('NONE');
  const [headerText, setHeaderText] = useState('');
  const [bodyText, setBodyText] = useState('Hi {{1}}! Your order #{{2}} is confirmed.');
  const [footerText, setFooterText] = useState('Reply STOP to unsubscribe');
  const [variables, setVariables] = useState(['Alex', 'ORD-9821']);
  const [buttons, setButtons] = useState([
    { type: 'QUICK_REPLY', text: 'Track Order' },
  ]);

  // Live Preview Variable Inputs
  const [previewVars, setPreviewVars] = useState({
    1: 'Alex',
    2: 'ORD-9821',
  });

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/templates');
      setTemplates(res.data.data.templates || []);
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSyncMeta = async () => {
    setIsSyncing(true);
    try {
      const res = await api.post('/templates/sync');
      toast.success(res.data.message || 'Templates synchronized with Meta');
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sync templates');
    } finally {
      setIsSyncing(false);
    }
  };

  const resetForm = () => {
    setName('');
    setCategory('MARKETING');
    setLanguage('en_US');
    setHeaderType('NONE');
    setHeaderText('');
    setBodyText('Hi {{1}}! Your order #{{2}} is confirmed.');
    setFooterText('Reply STOP to unsubscribe');
    setVariables(['Customer', 'ORD-1234']);
    setButtons([{ type: 'QUICK_REPLY', text: 'View Order' }]);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleAddVariableToBody = () => {
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const nextIndex = matches.length + 1;
    setBodyText((prev) => prev + ` {{${nextIndex}}}`);
    setVariables((prev) => [...prev, `Sample ${nextIndex}`]);
  };

  const handleAddButton = () => {
    if (buttons.length >= 3) {
      toast.error('Maximum 3 buttons supported');
      return;
    }
    setButtons([...buttons, { type: 'QUICK_REPLY', text: 'Action Button' }]);
  };

  const handleRemoveButton = (index) => {
    setButtons(buttons.filter((_, idx) => idx !== index));
  };

  const handleButtonChange = (index, field, val) => {
    const updated = [...buttons];
    updated[index][field] = val;
    setButtons(updated);
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        category,
        language,
        header: {
          type: headerType,
          text: headerText,
        },
        body: bodyText,
        footer: footerText,
        buttons,
        variables,
      };

      await api.post('/templates', payload);
      toast.success('Template submitted for Meta review');
      setIsModalOpen(false);
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit template');
    }
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await api.delete(`/templates/${templateId}`);
      toast.success('Template deleted');
      setTemplates((prev) => prev.filter((t) => t._id !== templateId));
      if (activePreviewTemplate?._id === templateId) {
        setActivePreviewTemplate(null);
      }
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const renderPreviewBody = (text, varMap = previewVars) => {
    if (!text) return '';
    return text.replace(/\{\{(\d+)\}\}/g, (match, idx) => {
      return varMap[idx] || match;
    });
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesSearch =
        tpl.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tpl.body?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = selectedCategory === 'all' || tpl.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || tpl.status === selectedStatus;
      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [templates, searchTerm, selectedCategory, selectedStatus]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            WhatsApp Message Templates
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Create, preview, and synchronize pre-approved Meta Cloud API templates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncMeta}
            disabled={isSyncing}
            className="px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin text-zinc-400' : 'text-zinc-400'} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Meta'}</span>
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus size={14} />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm w-full">
          <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search templates..."
            className="w-full bg-zinc-950 text-zinc-200 text-xs pl-8 pr-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs font-mono">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-zinc-950 text-zinc-300 text-xs px-2.5 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-600"
          >
            <option value="all">All Categories</option>
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utility</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-zinc-950 text-zinc-300 text-xs px-2.5 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-600"
          >
            <option value="all">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
            <option value="PAUSED">Paused</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <Loader size="md" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-12 text-center">
          <FileText size={32} className="mx-auto text-zinc-600 mb-2" />
          <h3 className="text-sm font-semibold text-zinc-200">No Templates Found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Click "Sync Meta" to import approved templates or create a new template.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Create Template</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => (
            <div
              key={tpl._id}
              className="bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-colors group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={STATUS_VARIANTS[tpl.status] || 'default'}>
                    {tpl.status}
                  </Badge>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">
                    {tpl.category} • {tpl.language}
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors font-mono">
                    {tpl.name}
                  </h3>
                </div>

                {/* WhatsApp Chat Preview */}
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-850 text-xs space-y-1.5 font-sans">
                  {tpl.header?.type === 'TEXT' && tpl.header?.text && (
                    <div className="font-semibold text-zinc-200 text-[11px] pb-1 border-b border-zinc-850">
                      {tpl.header.text}
                    </div>
                  )}

                  <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed break-words text-xs">
                    {tpl.body}
                  </p>

                  {tpl.footer && <p className="text-[10px] text-zinc-500">{tpl.footer}</p>}

                  {tpl.buttons?.length > 0 && (
                    <div className="pt-1.5 border-t border-zinc-850 space-y-1">
                      {tpl.buttons.map((btn, i) => (
                        <div
                          key={i}
                          className="bg-zinc-900 text-center py-1 rounded text-[10px] font-medium text-emerald-400 border border-zinc-800 flex items-center justify-center gap-1 font-mono"
                        >
                          {btn.type === 'URL' && <ExternalLink size={10} />}
                          {btn.type === 'PHONE_NUMBER' && <Phone size={10} />}
                          <span>{btn.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-3.5 pt-2.5 border-t border-zinc-850 flex items-center justify-between text-xs text-zinc-500 font-mono">
                <span className="text-[10px] truncate max-w-[140px]">
                  ID: {tpl.metaTemplateId || 'Custom'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActivePreviewTemplate(tpl)}
                    title="Preview"
                    className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(tpl._id)}
                    title="Delete"
                    className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New WhatsApp Template"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateTemplate} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="block font-medium text-zinc-300">Name (lowercase_underscore) *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="order_update_v1"
                className="w-full bg-zinc-950 text-zinc-100 px-2.5 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-medium text-zinc-300">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-zinc-950 text-zinc-200 px-2.5 py-1.5 rounded-md border border-zinc-800 text-xs"
              >
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utility</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-medium text-zinc-300">Language *</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-zinc-950 text-zinc-200 px-2.5 py-1.5 rounded-md border border-zinc-800 text-xs"
              >
                <option value="en_US">English (US)</option>
                <option value="en_GB">English (UK)</option>
                <option value="es_ES">Spanish</option>
                <option value="hi_IN">Hindi</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-medium text-zinc-300">
                Body ({'{{1}}'}, {'{{2}}'} for variables) *
              </label>
              <button
                type="button"
                onClick={handleAddVariableToBody}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
              >
                + Add Variable
              </button>
            </div>
            <textarea
              rows={3}
              required
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Hi {{1}}, your order #{{2}} is confirmed."
              className="w-full bg-zinc-950 text-zinc-100 p-2.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 font-mono text-xs leading-relaxed"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-zinc-300">Footer Text (Optional)</label>
            <input
              type="text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Reply STOP to unsubscribe"
              className="w-full bg-zinc-950 text-zinc-100 px-2.5 py-1.5 rounded-md border border-zinc-800 text-xs"
            />
          </div>

          <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-750"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md bg-zinc-100 text-zinc-950 hover:bg-white text-xs font-semibold"
            >
              Submit to Meta
            </button>
          </div>
        </form>
      </Modal>

      {/* Live Preview Modal */}
      {activePreviewTemplate && (
        <Modal
          isOpen={Boolean(activePreviewTemplate)}
          onClose={() => setActivePreviewTemplate(null)}
          title={`Preview: ${activePreviewTemplate.name}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-3">
            {/* Variable Test Value Inputs */}
            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-3 space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                Variables:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {[1, 2].map((idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="text-zinc-400">{`{{${idx}}}`}:</span>
                    <input
                      type="text"
                      value={previewVars[idx] || ''}
                      onChange={(e) => setPreviewVars({ ...previewVars, [idx]: e.target.value })}
                      placeholder={`Var ${idx}`}
                      className="flex-1 bg-zinc-900 text-zinc-100 px-2 py-0.5 rounded border border-zinc-800 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Bubble */}
            <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-lg max-w-sm mx-auto space-y-2">
              <p className="text-zinc-200 text-xs whitespace-pre-wrap leading-relaxed">
                {renderPreviewBody(activePreviewTemplate.body)}
              </p>
              {activePreviewTemplate.footer && (
                <p className="text-[10px] text-zinc-500">{activePreviewTemplate.footer}</p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TemplatesPage;
