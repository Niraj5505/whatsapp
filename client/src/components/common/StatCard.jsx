import React from 'react';

export const StatCard = ({ title, value, subtext, icon: Icon, trend }) => {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 sm:p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-400">{title}</p>
        {Icon && (
          <div className="w-7 h-7 rounded-md bg-zinc-800/70 border border-zinc-750 flex items-center justify-center text-zinc-300">
            <Icon size={14} />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-zinc-100 font-mono tracking-tight">
          {value}
        </h3>
        {trend && (
          <span className="text-[11px] font-mono font-medium text-emerald-400">
            {trend}
          </span>
        )}
      </div>
      {subtext && (
        <p className="text-xs text-zinc-500 mt-1 truncate">
          {subtext}
        </p>
      )}
    </div>
  );
};

export const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div
        className={`bg-zinc-900 border border-zinc-800 rounded-xl w-full ${maxWidth} overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150`}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 p-1 rounded-md transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export const Badge = ({ children, variant = 'default' }) => {
  const styles = {
    default: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
    success: 'bg-emerald-950/70 text-emerald-400 border-emerald-800/50',
    warning: 'bg-amber-950/70 text-amber-400 border-amber-800/50',
    danger: 'bg-rose-950/70 text-rose-400 border-rose-800/50',
    info: 'bg-sky-950/70 text-sky-400 border-sky-800/50',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
        styles[variant] || styles.default
      }`}
    >
      {children}
    </span>
  );
};

export const Loader = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-2',
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div
        className={`${sizes[size]} border-zinc-700 border-t-zinc-200 rounded-full animate-spin`}
      />
    </div>
  );
};
