import React from 'react';
import { useChat } from '../../context/ChatContext';
import { Search, MessageSquare, Check, CheckCheck, AlertCircle } from 'lucide-react';

const ConversationList = () => {
  const {
    conversations,
    activeConversation,
    selectConversation,
    activeFilter,
    setActiveFilter,
    searchTerm,
    setSearchTerm,
    loadingConversations,
  } = useChat();

  const handleStatusTab = (status) => {
    setActiveFilter(status);
  };

  const renderMessagePreview = (conv) => {
    const lastMsg = conv.lastMessage;
    if (!lastMsg || !lastMsg.body) {
      return <span className="italic text-zinc-500">No messages yet</span>;
    }

    const isOutbound = lastMsg.direction === 'outbound';
    let statusIcon = null;

    if (isOutbound) {
      if (lastMsg.status === 'read') {
        statusIcon = <CheckCheck size={12} className="text-emerald-400 shrink-0 inline mr-1" />;
      } else if (lastMsg.status === 'delivered') {
        statusIcon = <CheckCheck size={12} className="text-zinc-400 shrink-0 inline mr-1" />;
      } else if (lastMsg.status === 'sent') {
        statusIcon = <Check size={12} className="text-zinc-400 shrink-0 inline mr-1" />;
      } else if (lastMsg.status === 'failed') {
        statusIcon = <AlertCircle size={12} className="text-rose-400 shrink-0 inline mr-1" />;
      }
    }

    return (
      <span className="flex items-center truncate">
        {statusIcon}
        <span className="truncate">{lastMsg.body}</span>
      </span>
    );
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full md:w-80 lg:w-88 bg-zinc-950 border-r border-zinc-800/80 flex flex-col h-full shrink-0 select-none">
      {/* Header & Search */}
      <div className="p-3.5 border-b border-zinc-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
              Conversations
            </h2>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
              {conversations.length}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-zinc-900/90 text-zinc-200 text-xs pl-8 pr-3 py-1.5 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          {[
            { id: 'all', label: 'All' },
            { id: 'open', label: 'Open' },
            { id: 'pending', label: 'Pending' },
            { id: 'resolved', label: 'Resolved' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleStatusTab(tab.id)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                activeFilter === tab.id
                  ? 'bg-zinc-800 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List Scrollable */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/70">
        {loadingConversations ? (
          <div className="p-8 text-center text-xs text-zinc-500">Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            <MessageSquare size={24} className="mx-auto mb-2 text-zinc-700" />
            <p className="font-medium text-zinc-400">No conversations</p>
            <p className="text-[11px] text-zinc-500 mt-1">Inbound WhatsApp messages will appear here in real time.</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = activeConversation?._id === conv._id;
            const contact = conv.contactId || {};
            const contactName = contact.name || contact.phoneNumber || 'Customer';
            const time = formatTimestamp(conv.lastMessageAt || conv.updatedAt);

            return (
              <div
                key={conv._id}
                onClick={() => selectConversation(conv)}
                className={`p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-zinc-900 border-l-2 border-emerald-500'
                    : 'hover:bg-zinc-900/50 border-l-2 border-transparent'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-medium text-xs text-zinc-200">
                    {contactName.charAt(0).toUpperCase()}
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-emerald-500 text-zinc-950 text-[10px] font-mono font-bold rounded-full flex items-center justify-center">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>

                {/* Info & Last Message */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <h4 className="text-xs font-medium text-zinc-200 truncate">{contactName}</h4>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">{time}</span>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 mt-0.5">
                    <div className="text-xs text-zinc-400 truncate max-w-[160px]">
                      {renderMessagePreview(conv)}
                    </div>
                    {conv.status === 'resolved' && (
                      <span className="shrink-0 text-[9px] font-mono px-1 rounded bg-zinc-800 text-zinc-400">
                        DONE
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationList;
