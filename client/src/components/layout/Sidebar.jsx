import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  GitFork,
  Radio,
  Users,
  FileText,
  Settings,
  Terminal,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { conversations } = useChat();
  const totalUnread = conversations.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0);

  const sections = [
    {
      title: 'Overview',
      links: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      ],
    },
    {
      title: 'Messaging',
      links: [
        { to: '/inbox', label: 'Live Inbox', icon: MessageSquare, badge: totalUnread },
        { to: '/contacts', label: 'Contacts', icon: Users },
        { to: '/campaigns', label: 'Campaigns', icon: Radio },
      ],
    },
    {
      title: 'Automation & Meta',
      links: [
        { to: '/flows', label: 'Automations', icon: GitFork },
        { to: '/templates', label: 'Templates', icon: FileText },
        { to: '/test-whatsapp', label: 'WhatsApp Test', icon: Terminal },
        { to: '/simulator', label: 'API Simulator', icon: Terminal },
        { to: '/settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-60 bg-zinc-950 border-r border-zinc-800/80 flex flex-col justify-between shrink-0 transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0 top-14 h-[calc(100vh-3.5rem)]' : '-translate-x-full md:translate-x-0'
        } min-h-[calc(100vh-3.5rem)]`}
      >
        <div className="p-3 space-y-6 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase px-2.5 mb-1.5 font-mono">
                {section.title}
              </div>
              {section.links.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => {
                      if (window.innerWidth < 768 && onClose) {
                        onClose();
                      }
                    }}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-zinc-800/90 text-zinc-100 font-semibold shadow-xs'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={15} className="text-zinc-400" />
                      <span>{link.label}</span>
                    </div>
                    {Boolean(link.badge) && (
                      <span className="px-1.5 py-0.2 text-[10px] font-mono font-medium rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                        {link.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Minimal Footer */}
        <div className="p-3 border-t border-zinc-900 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
          <span>Meta Cloud v21.0</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
