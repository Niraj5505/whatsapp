import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import {
  User,
  Phone,
  Mail,
  Clock,
  Plus,
  X,
  Save,
} from 'lucide-react';
import { Badge } from '../common/StatCard';

const ContactSidebar = ({ onClose }) => {
  const { activeConversation, updateConversationStatus, updateActiveContact } = useChat();

  const contact = activeConversation?.contactId || {};
  const [notes, setNotes] = useState(contact.notes || '');
  const [newTag, setNewTag] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    setNotes(contact.notes || '');
  }, [contact.notes]);

  if (!activeConversation) return null;

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await updateActiveContact({ notes });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (!newTag.trim()) return;

    const currentTags = (contact.tags || []).map((t) => (typeof t === 'object' ? t.name : t));
    if (!currentTags.includes(newTag.trim())) {
      const updated = [...currentTags, newTag.trim()];
      await updateActiveContact({ tags: updated });
    }
    setNewTag('');
  };

  const handleRemoveTag = async (tagToRemove) => {
    const currentTags = (contact.tags || []).map((t) => (typeof t === 'object' ? t.name : t));
    const updated = currentTags.filter((t) => t !== tagToRemove);
    await updateActiveContact({ tags: updated });
  };

  return (
    <div className="w-80 bg-zinc-950 border-l border-zinc-800/80 flex flex-col h-full shrink-0 overflow-y-auto select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-zinc-800/80 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
          Contact Details
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-900 transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Profile */}
        <div className="text-center pb-2 border-b border-zinc-900">
          <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-medium text-base text-zinc-200 mb-2">
            {contact.name?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          <h4 className="font-semibold text-zinc-100 text-sm">{contact.name || 'WhatsApp Contact'}</h4>
          <p className="font-mono text-xs text-zinc-400 mt-0.5">{contact.phoneNumber}</p>
          <div className="mt-2 flex justify-center">
            <Badge variant={contact.optedOut ? 'danger' : 'success'}>
              {contact.optedOut ? 'Opted-Out' : 'Subscribed'}
            </Badge>
          </div>
        </div>

        {/* Status Actions */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono block">
            Status
          </label>
          <div className="grid grid-cols-2 gap-1">
            {['open', 'pending', 'resolved', 'closed'].map((st) => (
              <button
                key={st}
                onClick={() => updateConversationStatus(activeConversation._id, st)}
                className={`py-1 px-2 rounded text-xs font-medium capitalize transition-colors ${
                  activeConversation.status === st
                    ? 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-850'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-2 text-xs">
          <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono block">
            Information
          </label>

          <div className="flex items-center gap-2 text-zinc-300">
            <Phone size={13} className="text-zinc-500 shrink-0" />
            <span className="font-mono">{contact.phoneNumber || 'N/A'}</span>
          </div>

          <div className="flex items-center gap-2 text-zinc-300">
            <Mail size={13} className="text-zinc-500 shrink-0" />
            <span className="truncate">{contact.email || 'No email'}</span>
          </div>

          <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
            <Clock size={13} className="text-zinc-500 shrink-0" />
            <span>
              {contact.lastInteractionAt
                ? new Date(contact.lastInteractionAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'No interactions'}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono block">
            Tags
          </label>

          <div className="flex flex-wrap gap-1">
            {contact.tags && contact.tags.length > 0 ? (
              contact.tags.map((tag) => {
                const tagName = typeof tag === 'object' ? tag.name : tag;
                return (
                  <span
                    key={tagName}
                    className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[11px] font-mono border border-zinc-800 flex items-center gap-1"
                  >
                    <span>#{tagName}</span>
                    <button
                      onClick={() => handleRemoveTag(tagName)}
                      className="text-zinc-500 hover:text-rose-400"
                    >
                      <X size={11} />
                    </button>
                  </span>
                );
              })
            ) : (
              <span className="text-xs text-zinc-500 italic">No tags</span>
            )}
          </div>

          <form onSubmit={handleAddTag} className="flex gap-1 mt-1">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add tag..."
              className="flex-1 bg-zinc-900 text-zinc-100 text-xs px-2 py-1 rounded border border-zinc-800 focus:outline-none focus:border-zinc-600"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition-colors"
            >
              <Plus size={14} />
            </button>
          </form>
        </div>

        {/* Internal Notes */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
              Notes
            </label>
            <button
              onClick={handleSaveNotes}
              disabled={isSavingNotes}
              className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 font-medium"
            >
              <Save size={11} />
              <span>{isSavingNotes ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add background notes or client context..."
            className="w-full bg-zinc-900 text-zinc-200 text-xs p-2.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-600 leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};

export default ContactSidebar;
