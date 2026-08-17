import React from 'react';
import {
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  Download,
  MapPin,
  Music,
  Video,
  Bot,
} from 'lucide-react';

const MessageBubble = ({ message }) => {
  const isOutbound = message.direction === 'outbound';
  const time = new Date(message.createdAt || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const renderStatusTicks = () => {
    if (!isOutbound) return null;
    if (message.status === 'read') {
      return <CheckCheck size={14} className="text-sky-400 inline ml-1 shrink-0" title="Read" />;
    }
    if (message.status === 'delivered') {
      return <CheckCheck size={14} className="text-slate-400 inline ml-1 shrink-0" title="Delivered" />;
    }
    if (message.status === 'sent') {
      return <Check size={14} className="text-slate-400 inline ml-1 shrink-0" title="Sent" />;
    }
    if (message.status === 'failed') {
      return (
        <span title={message.error?.message || 'Delivery Failed'}>
          <AlertCircle size={14} className="text-rose-400 inline ml-1 shrink-0" />
        </span>
      );
    }
    return <span className="text-[10px] text-slate-400 ml-1">●</span>;
  };

  const renderMediaContent = () => {
    const media = message.media || {};
    const mediaUrl = media.url || message.mediaUrl;
    const msgType = (message.type || message.messageType || 'text').toLowerCase();

    if (!mediaUrl && !['location', 'interactive'].includes(msgType)) {
      return null;
    }

    if (msgType === 'image' && mediaUrl) {
      return (
        <div className="my-1.5 overflow-hidden rounded-xl bg-black/30 border border-black/20">
          <img
            src={mediaUrl}
            alt="WhatsApp attachment"
            className="max-h-64 max-w-full rounded-xl object-contain cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => window.open(mediaUrl, '_blank')}
          />
        </div>
      );
    }

    if (msgType === 'document' && mediaUrl) {
      return (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="my-1.5 p-3 rounded-xl bg-black/20 hover:bg-black/30 border border-white/10 flex items-center gap-3 transition-colors text-xs"
        >
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
            <FileText size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{media.fileName || 'Download Document'}</p>
            <p className="text-[10px] text-slate-400">Click to open / download</p>
          </div>
          <Download size={16} className="text-slate-400" />
        </a>
      );
    }

    if (msgType === 'audio' && mediaUrl) {
      return (
        <div className="my-1.5 p-2 rounded-xl bg-black/20 border border-white/10">
          <audio controls className="w-full h-8" src={mediaUrl}>
            Your browser does not support audio playback.
          </audio>
        </div>
      );
    }

    if (msgType === 'video' && mediaUrl) {
      return (
        <div className="my-1.5 overflow-hidden rounded-xl bg-black/30">
          <video controls className="max-h-64 max-w-full rounded-xl" src={mediaUrl} />
        </div>
      );
    }

    if (msgType === 'location' && media.url) {
      return (
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="my-1.5 p-2.5 rounded-xl bg-black/20 hover:bg-black/30 border border-white/10 flex items-center gap-2.5 text-xs text-emerald-300"
        >
          <MapPin size={18} className="text-rose-400 shrink-0" />
          <span className="font-medium underline truncate">View Location on Google Maps</span>
        </a>
      );
    }

    return null;
  };

  return (
    <div className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} mb-2.5`}>
      <div
        className={`max-w-[80%] md:max-w-[65%] rounded-2xl px-4 py-2.5 shadow-md text-xs relative group transition-all ${
          isOutbound
            ? 'bg-[#005c4b] text-white rounded-br-none border border-emerald-700/40 shadow-emerald-950/30'
            : 'bg-[#202c33] text-slate-100 rounded-bl-none border border-slate-750'
        }`}
      >
        {/* Automated Bot or Template Badge */}
        {message.metadata?.automated && (
          <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-300 uppercase tracking-wider mb-1">
            <Bot size={11} />
            <span>NexaFlow Bot Reply</span>
          </div>
        )}

        {/* Media */}
        {renderMediaContent()}

        {/* Text Body */}
        {message.body && (
          <p className="whitespace-pre-wrap leading-relaxed break-words text-xs">{message.body}</p>
        )}

        {/* Interactive Buttons / Options */}
        {message.metadata?.interactive && (
          <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
            {message.metadata.interactive.action?.buttons?.map((btn, idx) => (
              <div
                key={idx}
                className="bg-black/25 text-center py-1.5 px-3 rounded-lg font-semibold text-emerald-200 border border-emerald-500/20 text-[11px]"
              >
                {btn.reply?.title || btn.text}
              </div>
            ))}
          </div>
        )}

        {/* Timestamp & Status */}
        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-300/80 mt-1 select-none">
          <span>{time}</span>
          {renderStatusTicks()}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
