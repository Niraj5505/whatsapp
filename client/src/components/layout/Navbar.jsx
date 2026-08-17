import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, LogOut, MessageSquare, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Navbar = ({ onToggleSidebar, isSidebarOpen }) => {
  const { user, workspace, logout } = useAuth();
  const isMetaConfigured = Boolean(
    user?.metaConfig?.phoneNumberId && user?.metaConfig?.accessToken
  );

  return (
    <header className="h-14 bg-zinc-950 border-b border-zinc-800/80 flex items-center justify-between px-4 sm:px-6 z-30 sticky top-0">
      <div className="flex items-center gap-3">
        {/* Mobile Toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 md:hidden transition-colors"
          title="Toggle Navigation"
        >
          {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-500 group-hover:border-zinc-700 transition-colors">
            <MessageSquare size={15} />
          </div>
          <span className="text-sm font-semibold text-zinc-100 tracking-tight">
            NexaFlow
          </span>
          <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline-block">
            /
          </span>
          <span className="text-xs font-medium text-zinc-400 hidden sm:inline-block truncate max-w-[140px]">
            {workspace?.name || 'Workspace'}
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Meta Status Indicator */}
        <Link
          to="/settings"
          className="flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:border-zinc-700 transition-colors"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isMetaConfigured ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="hidden sm:inline text-xs text-zinc-300">
            {isMetaConfigured ? 'Meta API Connected' : 'Meta API Disconnected'}
          </span>
          <span className="sm:hidden text-xs">
            {isMetaConfigured ? 'Connected' : 'Setup'}
          </span>
        </Link>

        {/* User Profile */}
        <div className="flex items-center gap-2.5 border-l border-zinc-800/80 pl-3 sm:pl-4">
          <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-medium text-xs text-zinc-200">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-medium text-zinc-200 truncate max-w-[120px] leading-none">
              {user?.name}
            </p>
            <p className="text-[10px] text-zinc-500 truncate max-w-[120px] mt-0.5">
              {user?.email}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-md transition-colors ml-1"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
