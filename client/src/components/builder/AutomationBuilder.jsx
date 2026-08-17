import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  TriggerNode,
  ConditionNode,
  SendMessageNode,
  SendTemplateNode,
  DelayNode,
  AddTagNode,
  RemoveTagNode,
  AssignConversationNode,
  UpdateContactNode,
  EndNode,
} from './CustomNodes';
import NodeConfigPanel from './NodeConfigPanel';
import { Modal, Loader, Badge } from '../common/StatCard';
import {
  Zap,
  GitBranch,
  MessageSquare,
  FileText,
  Clock,
  Tag,
  MinusCircle,
  UserCheck,
  UserCog,
  Square,
  Save,
  Play,
  Pause,
  ArrowLeft,
  FlaskConical,
  Plus,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const NODE_PALETTE = [
  { type: 'trigger', label: 'Trigger', icon: Zap, color: 'text-amber-400', desc: 'Message keyword, prefix, or tag' },
  { type: 'condition', label: 'Condition', icon: GitBranch, color: 'text-indigo-400', desc: 'Branching YES/NO logic' },
  { type: 'send_message', label: 'Send Message', icon: MessageSquare, color: 'text-emerald-400', desc: 'Reply with text or media' },
  { type: 'send_template', label: 'Send Template', icon: FileText, color: 'text-teal-400', desc: 'Meta approved template' },
  { type: 'delay', label: 'Delay', icon: Clock, color: 'text-amber-400', desc: 'Pause execution seconds' },
  { type: 'add_tag', label: 'Add Tag', icon: Tag, color: 'text-purple-400', desc: 'Attach tag to contact' },
  { type: 'remove_tag', label: 'Remove Tag', icon: MinusCircle, color: 'text-rose-400', desc: 'Remove tag from contact' },
  { type: 'assign_conversation', label: 'Assign Agent', icon: UserCheck, color: 'text-blue-400', desc: 'Route to team member' },
  { type: 'update_contact', label: 'Update Contact', icon: UserCog, color: 'text-cyan-400', desc: 'Mutate attributes & notes' },
  { type: 'end', label: 'End Flow', icon: Square, color: 'text-slate-400', desc: 'Terminate workflow' },
];

const AutomationBuilder = ({ automation, onBack, onSaveSuccess }) => {
  const [name, setName] = useState(automation?.name || 'New WhatsApp Flow');
  const [description, setDescription] = useState(automation?.description || '');
  const [enabled, setEnabled] = useState(Boolean(automation?.enabled));
  const [saving, setSaving] = useState(false);

  // Nodes & Edges state
  const [nodes, setNodes] = useState(() => {
    const rawNodes = automation?.nodes || [
      { id: 'node_1', type: 'trigger', position: { x: 300, y: 50 }, data: { label: 'Message Trigger', triggerType: 'keyword', keywords: ['help', 'start'] } },
      { id: 'node_2', type: 'send_message', position: { x: 300, y: 220 }, data: { label: 'Send Welcome Reply', text: 'Hello {{contact.name}}! How can we assist you today?' } },
      { id: 'node_3', type: 'end', position: { x: 300, y: 390 }, data: { label: 'End Flow' } },
    ];
    return rawNodes;
  });

  const [edges, setEdges] = useState(() => {
    return automation?.edges || [
      { id: 'e1-2', source: 'node_1', target: 'node_2' },
      { id: 'e2-3', source: 'node_2', target: 'node_3' },
    ];
  });

  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Test Simulation State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testInput, setTestInput] = useState('Hello, pricing info please');
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);

  // Node deletion helper
  const deleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId((prev) => (prev === nodeId ? null : prev));
  }, []);

  // Node duplication helper
  const duplicateNode = useCallback((nodeToDup) => {
    const newId = `node_${Date.now()}`;
    const newNode = {
      ...nodeToDup,
      id: newId,
      position: {
        x: nodeToDup.position.x + 40,
        y: nodeToDup.position.y + 40,
      },
      data: {
        ...nodeToDup.data,
        label: `${nodeToDup.data?.label || 'Node'} (Copy)`,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newId);
  }, []);

  // Node Types Definition for ReactFlow
  const nodeTypes = useMemo(
    () => ({
      trigger: (props) => (
        <TriggerNode
          {...props}
          data={{
            ...props.data,
            onDelete: () => deleteNode(props.id),
            onDuplicate: () => duplicateNode(props),
            onOpenConfig: () => setSelectedNodeId(props.id),
          }}
        />
      ),
      condition: (props) => (
        <ConditionNode
          {...props}
          data={{
            ...props.data,
            onDelete: () => deleteNode(props.id),
            onDuplicate: () => duplicateNode(props),
            onOpenConfig: () => setSelectedNodeId(props.id),
          }}
        />
      ),
      send_message: (props) => (
        <SendMessageNode
          {...props}
          data={{
            ...props.data,
            onDelete: () => deleteNode(props.id),
            onDuplicate: () => duplicateNode(props),
            onOpenConfig: () => setSelectedNodeId(props.id),
          }}
        />
      ),
      send_template: (props) => (
        <SendTemplateNode
          {...props}
          data={{
            ...props.data,
            onDelete: () => deleteNode(props.id),
            onDuplicate: () => duplicateNode(props),
            onOpenConfig: () => setSelectedNodeId(props.id),
          }}
        />
      ),
      delay: (props) => (
        <DelayNode
          {...props}
          data={{
            ...props.data,
            onDelete: () => deleteNode(props.id),
            onDuplicate: () => duplicateNode(props),
            onOpenConfig: () => setSelectedNodeId(props.id),
          }}
        />
      ),
      add_tag: (props) => (
        <AddTagNode
          {...props}
          data={{
            ...props.data,
            onDelete: () => deleteNode(props.id),
            onDuplicate: () => duplicateNode(props),
            onOpenConfig: () => setSelectedNodeId(props.id),
          }}
        />
      ),
      remove_tag: (props) => (
        <RemoveTagNode
          {...props}
          data={{
            ...props.data,
            onDelete: () => deleteNode(props.id),
            onDuplicate: () => duplicateNode(props),
            onOpenConfig: () => setSelectedNodeId(props.id),
          }}
        />
      ),
      assign_conversation: (props) => (
        <AssignConversationNode
          {...props}
          data={{
            ...props.data,
            onDelete: () => deleteNode(props.id),
            onDuplicate: () => duplicateNode(props),
            onOpenConfig: () => setSelectedNodeId(props.id),
          }}
        />
      ),
      update_contact: (props) => (
        <UpdateContactNode
          {...props}
          data={{
            ...props.data,
            onDelete: () => deleteNode(props.id),
            onDuplicate: () => duplicateNode(props),
            onOpenConfig: () => setSelectedNodeId(props.id),
          }}
        />
      ),
      end: (props) => (
        <EndNode
          {...props}
          data={{
            ...props.data,
            onDelete: () => deleteNode(props.id),
            onOpenConfig: () => setSelectedNodeId(props.id),
          }}
        />
      ),
    }),
    [deleteNode, duplicateNode]
  );

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#10b981', strokeWidth: 2 } }, eds)),
    []
  );

  const addNodeFromPalette = (type) => {
    const newId = `node_${Date.now()}`;
    const paletteItem = NODE_PALETTE.find((p) => p.type === type);

    const defaultData = {
      label: paletteItem?.label || 'Node',
      type,
    };

    if (type === 'trigger') {
      defaultData.triggerType = 'keyword';
      defaultData.keywords = ['info'];
    } else if (type === 'send_message') {
      defaultData.text = 'Hello from NexaFlow!';
    } else if (type === 'condition') {
      defaultData.field = 'message.body';
      defaultData.operator = 'contains';
      defaultData.value = 'yes';
    } else if (type === 'delay') {
      defaultData.seconds = 3;
    } else if (type === 'add_tag') {
      defaultData.tagName = 'Lead';
    }

    const newNode = {
      id: newId,
      type,
      position: { x: 300 + Math.random() * 50, y: 150 + Math.random() * 50 },
      data: defaultData,
    };

    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newId);
  };

  const handleUpdateNode = (nodeId, updatedData) => {
    setNodes((nds) =>
      nds.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...updatedData } } : node))
    );
  };

  const handleSave = async (showToast = true) => {
    setSaving(true);
    try {
      // Find trigger node config
      const triggerNode = nodes.find((n) => n.type === 'trigger');
      const triggerConfig = {
        type: triggerNode?.data?.triggerType || 'keyword',
        config: {
          keywords: triggerNode?.data?.keywords || [],
          text: triggerNode?.data?.text || '',
          tagName: triggerNode?.data?.tagName || '',
        },
      };

      const payload = {
        name,
        description,
        enabled,
        trigger: triggerConfig,
        nodes,
        edges,
      };

      let res;
      if (automation?._id) {
        res = await api.put(`/automations/${automation._id}`, payload);
      } else {
        res = await api.post('/automations', payload);
      }

      if (showToast) toast.success('Automation workflow saved successfully!');
      if (onSaveSuccess) onSaveSuccess(res.data.data.automation);
      return res.data.data.automation;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save workflow');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      const current = await handleSave(false);
      const autoId = current?._id || automation?._id;

      if (!enabled) {
        // Activate with validation
        const res = await api.post(`/automations/${autoId}/activate`);
        setEnabled(true);
        toast.success('Automation activated!');
      } else {
        // Deactivate
        await api.post(`/automations/${autoId}/deactivate`);
        setEnabled(false);
        toast.success('Automation paused');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Validation failed. Fix workflow errors before activating.';
      toast.error(errMsg, { duration: 4000 });
    }
  };

  const handleRunTestSimulation = async (e) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResults(null);
    try {
      const current = await handleSave(false);
      const autoId = current?._id || automation?._id;

      const res = await api.post(`/automations/${autoId}/test`, {
        testMessage: testInput,
      });

      setTestResults(res.data.data);
      toast.success('Simulation executed!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Test simulation failed');
    } finally {
      setIsTesting(false);
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="h-16 px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-20 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent font-bold text-white text-base focus:outline-none focus:border-b border-emerald-500"
            />
            <p className="text-[11px] text-slate-400">Visual Flow Engine & Trigger Rules</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsTestModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <FlaskConical size={15} className="text-teal-400" />
            <span>Test Flow</span>
          </button>

          <button
            onClick={handleToggleActive}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
              enabled
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {enabled ? <Pause size={14} /> : <Play size={14} />}
            <span>{enabled ? 'Pause Flow' : 'Activate Flow'}</span>
          </button>

          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save size={15} />
            <span>{saving ? 'Saving...' : 'Save Workflow'}</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Palette Toolbar */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 z-10">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Add Nodes</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Click any node to add to canvas</p>
          </div>

          <div className="p-3 space-y-1.5 overflow-y-auto flex-1 text-xs">
            {NODE_PALETTE.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => addNodeFromPalette(item.type)}
                  className="w-full p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center gap-3 text-left group"
                >
                  <div className={`p-2 rounded-lg bg-slate-900 ${item.color}`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-xs group-hover:text-emerald-400 transition-colors">
                      {item.label}
                    </h5>
                    <p className="text-[10px] text-slate-500 line-clamp-1">{item.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center React Flow Canvas */}
        <div className="flex-1 h-full bg-[#090e13]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="react-flow-dark"
          >
            <Background color="#1e293b" gap={20} size={1} />
            <Controls className="bg-slate-900 border border-slate-800 text-white rounded-xl shadow-xl" />
            <MiniMap
              nodeColor="#10b981"
              maskColor="rgba(15, 23, 42, 0.7)"
              className="bg-slate-900 border border-slate-800 rounded-xl"
            />
          </ReactFlow>
        </div>

        {/* Right Configuration Inspector Drawer */}
        {selectedNode && (
          <NodeConfigPanel
            selectedNode={selectedNode}
            onUpdateNode={handleUpdateNode}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>

      {/* Test Simulation Modal */}
      <Modal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        title="Simulate WhatsApp Flow Execution"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleRunTestSimulation} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Simulated Incoming Message
            </label>
            <input
              type="text"
              required
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="e.g. pricing, hello, info"
              className="w-full bg-slate-950 text-slate-100 text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isTesting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950 flex items-center gap-2"
            >
              {isTesting && <Loader size="sm" />}
              <span>{isTesting ? 'Simulating...' : 'Run Simulation'}</span>
            </button>
          </div>

          {/* Test Results Output */}
          {testResults && (
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Execution Path & Results:</span>
                <Badge variant={testResults.status === 'completed' ? 'success' : 'danger'}>
                  {testResults.status}
                </Badge>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {testResults.stepsExecuted?.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold text-emerald-400">
                      <span className="capitalize">{step.actionType?.replace('_', ' ')}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{step.nodeId}</span>
                    </div>
                    <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap bg-slate-900/60 p-2 rounded-lg">
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};

export default AutomationBuilder;
