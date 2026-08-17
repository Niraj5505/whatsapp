import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Zap,
  GitBranch,
  MessageSquare,
  FileText,
  Clock,
  Tag,
  UserCheck,
  UserCog,
  Square,
  Plus,
  Trash2,
} from 'lucide-react';

const VARIABLE_CHIPS = [
  { label: 'Name', code: '{{contact.name}}' },
  { label: 'Phone', code: '{{contact.phoneNumber}}' },
  { label: 'Email', code: '{{contact.email}}' },
  { label: 'Message Text', code: '{{message.body}}' },
  { label: 'Workspace', code: '{{workspace.name}}' },
];

const NodeConfigPanel = ({ selectedNode, onUpdateNode, onClose }) => {
  if (!selectedNode) return null;

  const nodeType = (selectedNode.type || selectedNode.data?.type || '').toLowerCase();
  const [formData, setFormData] = useState({ ...(selectedNode.data || {}) });

  useEffect(() => {
    setFormData({ ...(selectedNode.data || {}) });
  }, [selectedNode]);

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdateNode(selectedNode.id, updated);
  };

  const insertVariable = (variableCode, targetField = 'text') => {
    const current = formData[targetField] || '';
    handleChange(targetField, current + ' ' + variableCode);
  };

  return (
    <div className="w-80 md:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0 select-none shadow-2xl z-20">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Configure Node</span>
          </h3>
          <p className="text-[11px] text-slate-400 capitalize">{nodeType.replace('_', ' ')} Node</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Form Content */}
      <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
        {/* Node Label */}
        <div>
          <label className="block font-semibold text-slate-300 mb-1.5">Node Title / Label</label>
          <input
            type="text"
            value={formData.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="Custom title..."
            className="w-full bg-slate-950 text-slate-100 text-xs px-3.5 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* 1. TRIGGER NODE CONFIG */}
        {nodeType === 'trigger' && (
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Trigger Condition</label>
              <select
                value={formData.triggerType || 'keyword'}
                onChange={(e) => handleChange('triggerType', e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
              >
                <option value="keyword">Contains Keyword</option>
                <option value="exact_text">Exact Text Match</option>
                <option value="starts_with">Starts With Prefix</option>
                <option value="ends_with">Ends With Suffix</option>
                <option value="any_message">Any Incoming Message</option>
                <option value="contact_tag">Contact Has Tag</option>
                <option value="business_hours">Within Business Hours</option>
              </select>
            </div>

            {['keyword', 'contains_text'].includes(formData.triggerType || 'keyword') && (
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Keywords (comma separated)
                </label>
                <input
                  type="text"
                  value={Array.isArray(formData.keywords) ? formData.keywords.join(', ') : formData.keywords || ''}
                  onChange={(e) =>
                    handleChange(
                      'keywords',
                      e.target.value.split(',').map((k) => k.trim()).filter(Boolean)
                    )
                  }
                  placeholder="e.g., pricing, demo, help, support"
                  className="w-full bg-slate-950 text-slate-100 text-xs px-3.5 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {['exact_text', 'starts_with', 'ends_with'].includes(formData.triggerType) && (
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Match Text</label>
                <input
                  type="text"
                  value={formData.text || ''}
                  onChange={(e) => handleChange('text', e.target.value)}
                  placeholder="e.g. #start"
                  className="w-full bg-slate-950 text-slate-100 text-xs px-3.5 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {formData.triggerType === 'contact_tag' && (
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Required Contact Tag</label>
                <input
                  type="text"
                  value={formData.tagName || ''}
                  onChange={(e) => handleChange('tagName', e.target.value)}
                  placeholder="e.g., VIP"
                  className="w-full bg-slate-950 text-slate-100 text-xs px-3.5 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>
        )}

        {/* 2. SEND MESSAGE CONFIG */}
        {nodeType === 'send_message' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-300">Message Text *</label>
                <span className="text-[10px] text-emerald-400">Supports variables</span>
              </div>
              <textarea
                rows={4}
                value={formData.text || formData.messageText || ''}
                onChange={(e) => {
                  handleChange('text', e.target.value);
                  handleChange('messageText', e.target.value);
                }}
                placeholder="Type your WhatsApp message..."
                className="w-full bg-slate-950 text-slate-100 text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 leading-relaxed"
              />
            </div>

            {/* Variable chips */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Insert Variable
              </label>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLE_CHIPS.map((chip) => (
                  <button
                    key={chip.code}
                    type="button"
                    onClick={() => insertVariable(chip.code, 'text')}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-emerald-400 text-[10px] font-semibold rounded-lg border border-slate-800 transition-colors"
                  >
                    +{chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Media Attachment URL (Optional)</label>
              <input
                type="url"
                value={formData.mediaUrl || ''}
                onChange={(e) => handleChange('mediaUrl', e.target.value)}
                placeholder="https://example.com/image.png"
                className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* 3. CONDITION NODE CONFIG */}
        {nodeType === 'condition' && (
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Field to Evaluate</label>
              <select
                value={formData.field || 'message.body'}
                onChange={(e) => handleChange('field', e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-800"
              >
                <option value="message.body">Incoming Message Text</option>
                <option value="contact.name">Contact Name</option>
                <option value="contact.phoneNumber">Contact Phone Number</option>
                <option value="contact.email">Contact Email</option>
                <option value="contact.tags">Contact Tags</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Operator</label>
              <select
                value={formData.operator || 'contains'}
                onChange={(e) => handleChange('operator', e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-800"
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals Exact</option>
                <option value="starts_with">Starts With</option>
                <option value="ends_with">Ends With</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Target Value *</label>
              <input
                type="text"
                value={formData.value || ''}
                onChange={(e) => handleChange('value', e.target.value)}
                placeholder="Value to compare..."
                className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800"
              />
            </div>
          </div>
        )}

        {/* 4. SEND TEMPLATE CONFIG */}
        {nodeType === 'send_template' && (
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Meta Template Name *</label>
              <input
                type="text"
                value={formData.templateName || ''}
                onChange={(e) => handleChange('templateName', e.target.value)}
                placeholder="e.g. seasonal_promo_v1"
                className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Language Code</label>
              <input
                type="text"
                value={formData.languageCode || 'en_US'}
                onChange={(e) => handleChange('languageCode', e.target.value)}
                placeholder="en_US"
                className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800"
              />
            </div>
          </div>
        )}

        {/* 5. DELAY CONFIG */}
        {nodeType === 'delay' && (
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Delay Duration (Seconds)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.seconds || 3}
                onChange={(e) => handleChange('seconds', parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800"
              />
            </div>
          </div>
        )}

        {/* 6. TAGS CONFIG */}
        {['add_tag', 'remove_tag'].includes(nodeType) && (
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Tag Name *</label>
              <input
                type="text"
                value={formData.tagName || formData.tag || ''}
                onChange={(e) => {
                  handleChange('tagName', e.target.value);
                  handleChange('tag', e.target.value);
                }}
                placeholder="e.g. VIP, Interested, Support"
                className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800"
              />
            </div>
          </div>
        )}

        {/* 7. ASSIGN CONVERSATION CONFIG */}
        {nodeType === 'assign_conversation' && (
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Agent / Team Role</label>
              <input
                type="text"
                value={formData.agentName || ''}
                onChange={(e) => handleChange('agentName', e.target.value)}
                placeholder="e.g. Sales Team / Agent ID"
                className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-800"
              />
            </div>
          </div>
        )}

        {/* 8. UPDATE CONTACT CONFIG */}
        {nodeType === 'update_contact' && (
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Update Notes</label>
              <textarea
                rows={2}
                value={formData.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Contact notes..."
                className="w-full bg-slate-950 text-slate-100 text-xs p-3 rounded-xl border border-slate-800"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeConfigPanel;
