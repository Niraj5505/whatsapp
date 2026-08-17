import React, { useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { Loader } from '../common/StatCard';
import {
  CheckCircle2,
  User,
  Shield,
  PanelRight,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react';

const ChatWindow = ({ onToggleSidebar, isSidebarOpen, onBack }) => {
  const {
    activeConversation,
    messages,
    loadingMessages,
    sendMessage,
    typingUsers,
    updateConversationStatus,
  } = useChat();

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0b141a] text-slate-400 select-none">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 shadow-xl shadow-emerald-950/30">
          <Shield size={28} />
        </div>
        <h3 className="text-lg font-bold text-white">NexaFlow Real-Time Live Inbox</h3>
        <p className="text-xs max-w-md mt-1.5 text-slate-400 leading-relaxed">
          Select a customer conversation from the list to send and receive real-time messages with two-way Meta WhatsApp Cloud API synchronization.
        </p>
      </div>
    );
  }

  const contact = activeConversation.contactId || {};
  const isTyping = typingUsers[activeConversation._id];

  const handleStatusChange = (newStatus) => {
    updateConversationStatus(activeConversation._id, newStatus);
  };

  const renderMessagesWithDates = () => {
    let lastDate = null;
    return messages.map((msg) => {
      const msgDate = new Date(msg.createdAt || Date.now()).toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const showDivider = msgDate !== lastDate;
      lastDate = msgDate;

      return (
        <React.Fragment key={msg._id}>
          {showDivider && (
            <div className="flex justify-center my-3 select-none">
              <span className="px-3 py-1 rounded-full bg-slate-900/90 text-slate-400 text-[10px] font-semibold uppercase tracking-wider border border-slate-800 shadow-sm">
                {msgDate}
              </span>
            </div>
          )}
          <MessageBubble message={msg} />
        </React.Fragment>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b141a] overflow-hidden">
      {/* Header */}
      <div className="h-16 px-4 sm:px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-10 select-none shadow-md">
        <div className="flex items-center gap-3">
          {/* Mobile Back Button */}
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg md:hidden transition-colors"
              title="Back to conversations"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-white shadow-md text-sm shrink-0">
            {contact.name?.charAt(0)?.toUpperCase() || 'C'}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white text-sm truncate max-w-[150px] sm:max-w-xs">
                {contact.name || contact.phoneNumber}
              </h4>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-950 text-slate-400 border border-slate-800">
                {activeConversation.status || 'open'}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 font-mono truncate">
              <span>{contact.phoneNumber}</span>
              {isTyping && <span className="text-emerald-400 italic font-sans animate-pulse">● typing...</span>}
            </p>
          </div>
        </div>

        {/* Actions & Sidebar Toggle */}
        <div className="flex items-center gap-2">
          {activeConversation.status !== 'resolved' ? (
            <button
              onClick={() => handleStatusChange('resolved')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-slate-700 transition-colors shadow-sm"
            >
              <CheckCircle2 size={14} />
              <span className="hidden sm:inline">Mark Resolved</span>
            </button>
          ) : (
            <button
              onClick={() => handleStatusChange('open')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors shadow-sm"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Reopen</span>
            </button>
          )}

          <button
            onClick={onToggleSidebar}
            title={isSidebarOpen ? 'Hide Details' : 'Show Details'}
            className={`p-2 rounded-xl border transition-colors ${
              isSidebarOpen
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <PanelRight size={17} />
          </button>
        </div>
      </div>

      {/* Messages Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-1 whatsapp-chat-bg">
        {loadingMessages ? (
          <div className="flex justify-center items-center h-full text-slate-400 text-xs gap-2">
            <Loader size="md" />
            <span>Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            <div className="w-12 h-12 rounded-full bg-slate-900 mx-auto flex items-center justify-center text-slate-600 mb-2">
              <User size={20} />
            </div>
            <p className="font-semibold text-slate-400">No message history yet</p>
            <p className="mt-1">Send a message below to start chatting with {contact.name || contact.phoneNumber}.</p>
          </div>
        ) : (
          renderMessagesWithDates()
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <MessageInput onSendMessage={sendMessage} />
    </div>
  );
};

export default ChatWindow;
