import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { user, workspace } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });

  // 1. Fetch Conversations from API
  const fetchConversations = useCallback(
    async (status = activeFilter, search = searchTerm) => {
      if (!user) return;
      setLoadingConversations(true);
      try {
        const queryParams = new URLSearchParams();
        if (status && status !== 'all') queryParams.append('status', status);
        if (search && search.trim()) queryParams.append('search', search.trim());

        const res = await api.get(`/conversations?${queryParams.toString()}`);
        const data = res.data.data;
        setConversations(data.conversations || []);
        if (data.pagination) setPagination(data.pagination);
      } catch (error) {
        console.error('Failed to load conversations', error);
      } finally {
        setLoadingConversations(false);
      }
    },
    [user, activeFilter, searchTerm]
  );

  // 2. Select & Load Conversation Messages
  const selectConversation = useCallback(
    async (conversation) => {
      if (!conversation) return;
      setActiveConversation(conversation);
      setLoadingMessages(true);
      try {
        const res = await api.get(`/conversations/${conversation._id}/messages?limit=50`);
        setMessages(res.data.data.messages || []);

        const socket = getSocket();
        if (socket) {
          socket.emit('join_conversation', conversation._id);
        }

        // Mark read locally and on server
        if (conversation.unreadCount > 0) {
          api.patch(`/conversations/${conversation._id}/read`).catch(() => {});
          setConversations((prev) =>
            prev.map((c) => (c._id === conversation._id ? { ...c, unreadCount: 0 } : c))
          );
        }
      } catch (error) {
        toast.error('Failed to load conversation messages');
      } finally {
        setLoadingMessages(false);
      }
    },
    []
  );

  // 3. Send Outbound Message
  const sendMessage = async (content, messageType = 'text', mediaUrl = '', caption = '', filename = '') => {
    if (!activeConversation) return;

    try {
      const res = await api.post(`/conversations/${activeConversation._id}/messages`, {
        body: content,
        content,
        type: messageType,
        mediaUrl,
        caption,
        filename,
      });

      const newMsg = res.data.data.message;
      setMessages((prev) => {
        if (prev.some((m) => m._id === newMsg._id)) return prev;
        return [...prev, newMsg];
      });

      // Update conversation in list
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeConversation._id
            ? {
                ...c,
                lastMessage: {
                  body: content || `[${messageType.toUpperCase()}]`,
                  type: messageType,
                  direction: 'outbound',
                  timestamp: new Date(),
                  status: newMsg.status,
                },
                lastMessageAt: new Date(),
              }
            : c
        )
      );

      return newMsg;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to dispatch WhatsApp message');
      throw error;
    }
  };

  // 4. Update Status (open, pending, resolved, closed)
  const updateConversationStatus = async (conversationId, status) => {
    try {
      const res = await api.patch(`/conversations/${conversationId}/status`, { status });
      const updated = res.data.data.conversation;
      setConversations((prev) =>
        prev.map((c) => (c._id === conversationId ? { ...c, status: updated.status } : c))
      );
      if (activeConversation && activeConversation._id === conversationId) {
        setActiveConversation((prev) => ({ ...prev, status: updated.status }));
      }
      toast.success(`Conversation marked as ${status}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // 5. Update Active Contact Profile (Notes, Tags)
  const updateActiveContact = async (updatedFields) => {
    if (!activeConversation || !activeConversation.contactId) return;
    try {
      const contactId = activeConversation.contactId._id;
      const res = await api.put(`/contacts/${contactId}`, updatedFields);
      const updatedContact = res.data.data.contact;

      setActiveConversation((prev) => ({
        ...prev,
        contactId: updatedContact,
      }));

      setConversations((prev) =>
        prev.map((c) => (c._id === activeConversation._id ? { ...c, contactId: updatedContact } : c))
      );
      toast.success('Contact updated');
    } catch (err) {
      toast.error('Failed to update contact');
    }
  };

  // 6. Socket.IO Real-time Subscriptions
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    if (workspace && (workspace.id || workspace._id)) {
      socket.emit('join_workspace', workspace.id || workspace._id);
    }

    // Event: message:new
    const handleNewMessage = ({ conversationId, message, contact }) => {
      // Append to active conversation if open
      if (activeConversation && activeConversation._id === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
      }

      // Update Conversation List Preview
      setConversations((prev) => {
        const index = prev.findIndex((c) => c._id === conversationId);
        if (index !== -1) {
          const updated = [...prev];
          const conv = { ...updated[index] };
          conv.lastMessage = {
            body: message.body,
            type: message.type,
            direction: message.direction,
            timestamp: message.createdAt || new Date(),
            status: message.status,
          };
          conv.lastMessageAt = message.createdAt || new Date();

          if (!activeConversation || activeConversation._id !== conversationId) {
            conv.unreadCount = (conv.unreadCount || 0) + 1;
            const contactName = conv.contactId?.name || contact?.name || 'Customer';
            toast.success(`WhatsApp message from ${contactName}: "${(message.body || '').substring(0, 30)}"`, {
              icon: '💬',
            });
          }

          updated.splice(index, 1);
          return [conv, ...updated];
        } else {
          // If conversation wasn't in the list, fetch fresh list
          fetchConversations();
          return prev;
        }
      });
    };

    // Event: message:updated
    const handleMessageUpdated = ({ messageId, status, error }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, status, ...(error && { error }) } : m))
      );
    };

    // Event: conversation:updated
    const handleConversationUpdated = ({ conversation }) => {
      if (!conversation) return;
      setConversations((prev) =>
        prev.map((c) => (c._id === conversation._id ? { ...c, ...conversation } : c))
      );
      if (activeConversation && activeConversation._id === conversation._id) {
        setActiveConversation((prev) => ({ ...prev, ...conversation }));
      }
    };

    // Event: conversation:read
    const handleConversationRead = ({ conversationId }) => {
      setConversations((prev) =>
        prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
      );
    };

    // Event: user_typing
    const handleTyping = ({ conversationId, userName, isTyping }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [conversationId]: isTyping ? userName : null,
      }));
    };

    socket.on('message:new', handleNewMessage);
    socket.on('new_message', handleNewMessage);
    socket.on('message:updated', handleMessageUpdated);
    socket.on('message_status_updated', handleMessageUpdated);
    socket.on('conversation:updated', handleConversationUpdated);
    socket.on('conversation:read', handleConversationRead);
    socket.on('user_typing', handleTyping);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('new_message', handleNewMessage);
      socket.off('message:updated', handleMessageUpdated);
      socket.off('message_status_updated', handleMessageUpdated);
      socket.off('conversation:updated', handleConversationUpdated);
      socket.off('conversation:read', handleConversationRead);
      socket.off('user_typing', handleTyping);
    };
  }, [workspace, activeConversation, fetchConversations]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversation,
        messages,
        loadingConversations,
        loadingMessages,
        typingUsers,
        activeFilter,
        searchTerm,
        pagination,
        setActiveFilter,
        setSearchTerm,
        fetchConversations,
        selectConversation,
        sendMessage,
        updateConversationStatus,
        updateActiveContact,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
