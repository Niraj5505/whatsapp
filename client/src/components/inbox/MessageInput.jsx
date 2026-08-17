import React, { useState, useRef } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Image as ImageIcon,
  FileText,
  Music,
  Video,
  X,
} from 'lucide-react';

const QUICK_EMOJIS = ['👍', '👋', '🙏', '😊', '❤️', '🎉', '🔥', '⚡', '❓', '📦', '✅', '🚀'];

const MessageInput = ({ onSendMessage }) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [attachmentModal, setAttachmentModal] = useState({
    open: false,
    type: 'image',
    url: '',
    caption: '',
    filename: '',
  });

  const textareaRef = useRef(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim() || isSending) return;

    const msg = text.trim();
    setText('');
    setIsSending(true);

    try {
      await onSendMessage(msg, 'text');
    } catch (err) {
      setText(msg);
    } finally {
      setIsSending(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSendAttachment = async (e) => {
    e.preventDefault();
    if (!attachmentModal.url) return;

    setIsSending(true);
    try {
      await onSendMessage(
        attachmentModal.caption || '',
        attachmentModal.type,
        attachmentModal.url,
        attachmentModal.caption,
        attachmentModal.filename
      );
      setAttachmentModal({ open: false, type: 'image', url: '', caption: '', filename: '' });
    } catch (err) {
      // handled
    } finally {
      setIsSending(false);
    }
  };

  const addEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    if (textareaRef.current) textareaRef.current.focus();
  };

  return (
    <div className="bg-zinc-950 border-t border-zinc-800/80 p-2.5 sm:p-3 relative select-none">
      {/* Quick Emoji Bar */}
      {showEmojiPicker && (
        <div className="p-1.5 mb-2 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-1.5 overflow-x-auto shadow-xl">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => addEmoji(emoji)}
              className="text-base hover:bg-zinc-800 p-1 rounded transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Attachment Popover Menu */}
      {showAttachmentMenu && (
        <div className="absolute bottom-14 left-3 bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 shadow-2xl flex flex-col gap-0.5 z-30 min-w-[160px]">
          <button
            type="button"
            onClick={() => {
              setAttachmentModal({ open: true, type: 'image', url: '', caption: '', filename: '' });
              setShowAttachmentMenu(false);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md transition-colors"
          >
            <ImageIcon size={14} className="text-emerald-400" />
            <span>Image</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAttachmentModal({ open: true, type: 'document', url: '', caption: '', filename: 'Document.pdf' });
              setShowAttachmentMenu(false);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md transition-colors"
          >
            <FileText size={14} className="text-sky-400" />
            <span>Document</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAttachmentModal({ open: true, type: 'audio', url: '', caption: '', filename: '' });
              setShowAttachmentMenu(false);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md transition-colors"
          >
            <Music size={14} className="text-amber-400" />
            <span>Audio</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAttachmentModal({ open: true, type: 'video', url: '', caption: '', filename: '' });
              setShowAttachmentMenu(false);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md transition-colors"
          >
            <Video size={14} className="text-purple-400" />
            <span>Video</span>
          </button>
        </div>
      )}

      {/* Main Input Bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <div className="flex items-center text-zinc-400">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Emoji"
            className={`p-1.5 rounded-md transition-colors ${
              showEmojiPicker ? 'text-zinc-100 bg-zinc-850' : 'hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Smile size={17} />
          </button>
          <button
            type="button"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            title="Attach"
            className={`p-1.5 rounded-md transition-colors ${
              showAttachmentMenu ? 'text-zinc-100 bg-zinc-850' : 'hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Paperclip size={17} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a WhatsApp message (Enter to send)..."
          rows={1}
          className="flex-1 bg-zinc-900 text-zinc-100 placeholder-zinc-500 text-xs px-3 py-2 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-600 resize-none max-h-28 transition-colors"
        />

        <button
          type="submit"
          disabled={!text.trim() || isSending}
          className="p-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send size={14} />
        </button>
      </form>

      {/* Attachment Modal */}
      {attachmentModal.open && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-xs font-semibold text-zinc-100 uppercase font-mono">
                Send {attachmentModal.type}
              </h3>
              <button
                onClick={() => setAttachmentModal({ ...attachmentModal, open: false })}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendAttachment} className="mt-3.5 space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-300">
                  Public Media URL *
                </label>
                <input
                  type="url"
                  required
                  value={attachmentModal.url}
                  onChange={(e) => setAttachmentModal({ ...attachmentModal, url: e.target.value })}
                  placeholder="https://example.com/media.jpg"
                  className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-2 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {attachmentModal.type === 'document' && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-300">
                    File Name
                  </label>
                  <input
                    type="text"
                    value={attachmentModal.filename}
                    onChange={(e) => setAttachmentModal({ ...attachmentModal, filename: e.target.value })}
                    placeholder="Statement_2026.pdf"
                    className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-2 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              )}

              {['image', 'video', 'document'].includes(attachmentModal.type) && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-300">
                    Caption (Optional)
                  </label>
                  <input
                    type="text"
                    value={attachmentModal.caption}
                    onChange={(e) => setAttachmentModal({ ...attachmentModal, caption: e.target.value })}
                    placeholder="Message caption"
                    className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-2 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAttachmentModal({ ...attachmentModal, open: false })}
                  className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-3 py-1.5 rounded-md bg-zinc-100 text-zinc-950 hover:bg-white text-xs font-semibold"
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageInput;
