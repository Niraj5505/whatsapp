import React from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Zap,
  GitBranch,
  MessageSquare,
  FileText,
  Clock,
  Tag as TagIcon,
  MinusCircle,
  UserCheck,
  UserCog,
  Square,
  Trash2,
  Copy,
  Settings,
} from 'lucide-react';

const BaseNode = ({
  title,
  icon: Icon,
  color = 'emerald',
  borderColor = 'border-emerald-500/40',
  bgColor = 'bg-emerald-950/40',
  data,
  isConnectable = true,
  hasInput = true,
  hasOutput = true,
  outputLabels = null,
}) => {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (data?.onDelete) data.onDelete();
  };

  const handleDuplicate = (e) => {
    e.stopPropagation();
    if (data?.onDuplicate) data.onDuplicate();
  };

  const handleOpenConfig = (e) => {
    e.stopPropagation();
    if (data?.onOpenConfig) data.onOpenConfig();
  };

  return (
    <div
      onClick={handleOpenConfig}
      className={`min-w-[240px] max-w-[280px] bg-slate-900 border ${borderColor} rounded-2xl p-3.5 shadow-2xl hover:shadow-emerald-950/50 transition-all cursor-pointer group text-slate-200 select-none`}
    >
      {/* Top Input Handle */}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={isConnectable}
          className="w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full hover:scale-125 transition-transform"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-xl ${bgColor} text-white`}>
            <Icon size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white leading-tight">
              {data?.label || title}
            </h4>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              {title}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleOpenConfig}
            title="Configure Node"
            className="p-1 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
          >
            <Settings size={13} />
          </button>
          {data?.onDuplicate && (
            <button
              onClick={handleDuplicate}
              title="Duplicate Node"
              className="p-1 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
            >
              <Copy size={13} />
            </button>
          )}
          {data?.onDelete && (
            <button
              onClick={handleDelete}
              title="Delete Node"
              className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Content Preview */}
      <div className="pt-2 text-xs text-slate-400">
        {data?.preview ? (
          <p className="line-clamp-2 italic">{data.preview}</p>
        ) : (
          <p className="text-[11px] text-slate-500">Click to configure properties</p>
        )}
      </div>

      {/* Output Handles */}
      {hasOutput && !outputLabels && (
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={isConnectable}
          className="w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full hover:scale-125 transition-transform"
        />
      )}

      {/* Conditional Branching Handles (True / False) */}
      {outputLabels && (
        <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-800 text-[10px] font-bold">
          <div className="relative flex items-center gap-1 text-emerald-400">
            <span>YES (Match)</span>
            <Handle
              type="source"
              id="true"
              position={Position.Bottom}
              isConnectable={isConnectable}
              style={{ left: '25%' }}
              className="w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-900 rounded-full"
            />
          </div>
          <div className="relative flex items-center gap-1 text-rose-400">
            <span>NO (Else)</span>
            <Handle
              type="source"
              id="false"
              position={Position.Bottom}
              isConnectable={isConnectable}
              style={{ left: '75%' }}
              className="w-3.5 h-3.5 bg-rose-400 border-2 border-slate-900 rounded-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// 1. Trigger Node
export const TriggerNode = ({ data, isConnectable }) => {
  const kwList = Array.isArray(data?.keywords) ? data.keywords.join(', ') : (data?.keywords || 'all messages');
  const preview = `Trigger: ${data?.triggerType || 'Keyword'} (${kwList})`;
  return (
    <BaseNode
      title="Trigger"
      icon={Zap}
      borderColor="border-amber-500/50"
      bgColor="bg-amber-600/30 text-amber-300"
      hasInput={false}
      hasOutput={true}
      data={{ ...data, preview }}
      isConnectable={isConnectable}
    />
  );
};

// 2. Condition Node (Branching)
export const ConditionNode = ({ data, isConnectable }) => {
  const preview = `If ${data?.field || 'message'} ${data?.operator || 'contains'} "${data?.value || ''}"`;
  return (
    <BaseNode
      title="Condition"
      icon={GitBranch}
      borderColor="border-indigo-500/50"
      bgColor="bg-indigo-600/30 text-indigo-300"
      hasInput={true}
      hasOutput={true}
      outputLabels={true}
      data={{ ...data, preview }}
      isConnectable={isConnectable}
    />
  );
};

// 3. Send Message Node
export const SendMessageNode = ({ data, isConnectable }) => {
  const preview = data?.text || data?.messageText || (data?.mediaUrl ? `[Media: ${data.mediaType || 'Image'}]` : 'Type WhatsApp reply...');
  return (
    <BaseNode
      title="Send Message"
      icon={MessageSquare}
      borderColor="border-emerald-500/50"
      bgColor="bg-emerald-600/30 text-emerald-300"
      data={{ ...data, preview }}
      isConnectable={isConnectable}
    />
  );
};

// 4. Send Template Node
export const SendTemplateNode = ({ data, isConnectable }) => {
  const preview = `Meta Template: ${data?.templateName || 'None selected'}`;
  return (
    <BaseNode
      title="Send Template"
      icon={FileText}
      borderColor="border-teal-500/50"
      bgColor="bg-teal-600/30 text-teal-300"
      data={{ ...data, preview }}
      isConnectable={isConnectable}
    />
  );
};

// 5. Delay Node
export const DelayNode = ({ data, isConnectable }) => {
  const preview = `Wait for ${data?.seconds || 3} seconds`;
  return (
    <BaseNode
      title="Delay"
      icon={Clock}
      borderColor="border-amber-500/40"
      bgColor="bg-amber-600/30 text-amber-300"
      data={{ ...data, preview }}
      isConnectable={isConnectable}
    />
  );
};

// 6. Add Tag Node
export const AddTagNode = ({ data, isConnectable }) => {
  const preview = `Attach Tag: #${data?.tagName || 'VIP'}`;
  return (
    <BaseNode
      title="Add Tag"
      icon={TagIcon}
      borderColor="border-purple-500/50"
      bgColor="bg-purple-600/30 text-purple-300"
      data={{ ...data, preview }}
      isConnectable={isConnectable}
    />
  );
};

// 7. Remove Tag Node
export const RemoveTagNode = ({ data, isConnectable }) => {
  const preview = `Remove Tag: #${data?.tagName || 'Tag'}`;
  return (
    <BaseNode
      title="Remove Tag"
      icon={MinusCircle}
      borderColor="border-rose-500/50"
      bgColor="bg-rose-600/30 text-rose-300"
      data={{ ...data, preview }}
      isConnectable={isConnectable}
    />
  );
};

// 8. Assign Conversation Node
export const AssignConversationNode = ({ data, isConnectable }) => {
  const preview = `Assign to Agent: ${data?.agentName || data?.userId || 'Support Team'}`;
  return (
    <BaseNode
      title="Assign Conversation"
      icon={UserCheck}
      borderColor="border-blue-500/50"
      bgColor="bg-blue-600/30 text-blue-300"
      data={{ ...data, preview }}
      isConnectable={isConnectable}
    />
  );
};

// 9. Update Contact Node
export const UpdateContactNode = ({ data, isConnectable }) => {
  const preview = `Update attributes & notes`;
  return (
    <BaseNode
      title="Update Contact"
      icon={UserCog}
      borderColor="border-cyan-500/50"
      bgColor="bg-cyan-600/30 text-cyan-300"
      data={{ ...data, preview }}
      isConnectable={isConnectable}
    />
  );
};

// 10. End Node
export const EndNode = ({ data, isConnectable }) => {
  return (
    <BaseNode
      title="End Flow"
      icon={Square}
      borderColor="border-slate-600"
      bgColor="bg-slate-800 text-slate-400"
      hasInput={true}
      hasOutput={false}
      data={{ ...data, preview: 'Workflow execution finishes here' }}
      isConnectable={isConnectable}
    />
  );
};
