import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Loader, Badge } from '../components/common/StatCard';
import AutomationBuilder from '../components/builder/AutomationBuilder';
import {
  GitFork,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit3,
  Bot,
  Zap,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

const FlowsPage = () => {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAutomation, setSelectedAutomation] = useState(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const fetchAutomations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/automations');
      setAutomations(res.data.data.automations || []);
    } catch (err) {
      toast.error('Failed to load automations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  const handleOpenNewBuilder = () => {
    setSelectedAutomation(null);
    setIsBuilderOpen(true);
  };

  const handleEditBuilder = (automation) => {
    setSelectedAutomation(automation);
    setIsBuilderOpen(true);
  };

  const handleToggleActivate = async (automation) => {
    try {
      if (!automation.enabled) {
        await api.post(`/automations/${automation._id}/activate`);
        toast.success(`Flow "${automation.name}" activated`);
      } else {
        await api.post(`/automations/${automation._id}/deactivate`);
        toast.success(`Flow "${automation.name}" paused`);
      }
      fetchAutomations();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to toggle status';
      toast.error(msg);
    }
  };

  const handleDelete = async (automationId) => {
    if (!window.confirm('Delete this automation flow?')) {
      return;
    }
    try {
      await api.delete(`/automations/${automationId}`);
      toast.success('Automation deleted');
      setAutomations((prev) => prev.filter((a) => a._id !== automationId));
    } catch (err) {
      toast.error('Failed to delete automation');
    }
  };

  if (isBuilderOpen) {
    return (
      <AutomationBuilder
        automation={selectedAutomation}
        onBack={() => {
          setIsBuilderOpen(false);
          fetchAutomations();
        }}
        onSaveSuccess={() => {
          fetchAutomations();
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Automations & Chatbots
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure automated keyword triggers, branching condition trees, and WhatsApp actions.
          </p>
        </div>

        <button
          onClick={handleOpenNewBuilder}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white transition-colors shadow-xs"
        >
          <Plus size={14} />
          <span>New Flow</span>
        </button>
      </div>

      {/* Automations Grid */}
      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <Loader size="md" />
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-12 text-center">
          <Bot size={32} className="mx-auto text-zinc-600 mb-2" />
          <h3 className="text-sm font-semibold text-zinc-200">No Automations Configured</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Create an automation flow to auto-reply to customer keywords or route conversations.
          </p>
          <button
            onClick={handleOpenNewBuilder}
            className="mt-4 px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Launch Builder</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {automations.map((auto) => {
            const nodeCount = auto.nodes?.length || 0;
            const triggerType = auto.trigger?.type || 'keyword';
            const keywords = auto.trigger?.config?.keywords || [];

            return (
              <div
                key={auto._id}
                className="bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-5 flex flex-col justify-between transition-colors group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={auto.enabled ? 'success' : 'default'}>
                      {auto.enabled ? 'Active' : 'Paused'}
                    </Badge>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      {triggerType}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                      {auto.name}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                      {auto.description || 'Automated customer response workflow.'}
                    </p>
                  </div>

                  {/* Keywords Preview */}
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {keywords.slice(0, 3).map((kw, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.2 rounded bg-zinc-950 text-zinc-400 text-[10px] font-mono border border-zinc-800"
                        >
                          #{kw}
                        </span>
                      ))}
                      {keywords.length > 3 && (
                        <span className="text-[10px] font-mono text-zinc-500">+{keywords.length - 3}</span>
                      )}
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-zinc-850 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Layers size={12} className="text-zinc-500" />
                      <span>{nodeCount} Nodes</span>
                    </span>
                    <span>{new Date(auto.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-850 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleEditBuilder(auto)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
                  >
                    <Edit3 size={12} className="text-zinc-400" />
                    <span>Edit Canvas</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActivate(auto)}
                      title={auto.enabled ? 'Pause' : 'Activate'}
                      className={`p-1.5 rounded border transition-colors ${
                        auto.enabled
                          ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-750'
                          : 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/60'
                      }`}
                    >
                      {auto.enabled ? <Pause size={13} /> : <Play size={13} />}
                    </button>

                    <button
                      onClick={() => handleDelete(auto._id)}
                      title="Delete"
                      className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FlowsPage;
