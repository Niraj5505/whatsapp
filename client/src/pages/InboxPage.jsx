import React, { useState, useEffect } from 'react';
import ConversationList from '../components/inbox/ConversationList';
import ChatWindow from '../components/inbox/ChatWindow';
import ContactSidebar from '../components/inbox/ContactSidebar';
import { useChat } from '../context/ChatContext';

const InboxPage = () => {
  const { fetchConversations, activeConversation, selectConversation } = useChat();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 relative">
      {/* LEFT: Conversation List (Hidden on mobile when conversation is active) */}
      <div
        className={`${
          activeConversation ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 lg:w-96 shrink-0 h-full`}
      >
        <ConversationList />
      </div>

      {/* CENTER: Chat Window (Full width on mobile when conversation active) */}
      <div
        className={`${
          !activeConversation ? 'hidden md:flex' : 'flex'
        } flex-1 h-full min-w-0`}
      >
        <ChatWindow
          onBack={() => selectConversation(null)}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen && Boolean(activeConversation)}
        />
      </div>

      {/* RIGHT: Contact Info Sidebar */}
      {isSidebarOpen && activeConversation && (
        <div className="fixed md:static inset-y-0 right-0 z-20 w-full sm:w-80 h-full bg-slate-900 border-l border-slate-800 shadow-2xl">
          <ContactSidebar onClose={() => setIsSidebarOpen(false)} />
        </div>
      )}
    </div>
  );
};

export default InboxPage;
