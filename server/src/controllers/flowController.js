const Flow = require('../models/Flow');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get all automation flows for user
 * GET /api/flows
 */
const getFlows = async (req, res, next) => {
  try {
    const flows = await Flow.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return sendSuccess(res, 'Flows retrieved', { flows });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single flow by ID
 * GET /api/flows/:id
 */
const getFlowById = async (req, res, next) => {
  try {
    const flow = await Flow.findOne({ _id: req.params.id, userId: req.user._id });
    if (!flow) return sendError(res, 'Flow not found', 404);

    return sendSuccess(res, 'Flow retrieved', { flow });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new flow
 * POST /api/flows
 */
const createFlow = async (req, res, next) => {
  try {
    const { name, description, triggerType, triggerKeywords, nodes, edges, isActive } = req.body;

    const flow = await Flow.create({
      userId: req.user._id,
      name,
      description: description || '',
      triggerType: triggerType || 'keyword',
      triggerKeywords: triggerKeywords || [],
      nodes: nodes || [
        { id: 'node_1', type: 'trigger', data: { label: 'Start Trigger' }, position: { x: 100, y: 100 } },
        { id: 'node_2', type: 'send_message', data: { label: 'Send Welcome Message', messageText: 'Hello! How can we assist you today?' }, position: { x: 100, y: 250 } }
      ],
      edges: edges || [
        { id: 'edge_1_2', source: 'node_1', target: 'node_2' }
      ],
      isActive: isActive !== undefined ? isActive : true,
    });

    return sendSuccess(res, 'Flow created successfully', { flow }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update existing flow
 * PUT /api/flows/:id
 */
const updateFlow = async (req, res, next) => {
  try {
    const flow = await Flow.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!flow) return sendError(res, 'Flow not found', 404);

    return sendSuccess(res, 'Flow updated successfully', { flow });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete flow
 * DELETE /api/flows/:id
 */
const deleteFlow = async (req, res, next) => {
  try {
    const flow = await Flow.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!flow) return sendError(res, 'Flow not found', 404);

    return sendSuccess(res, 'Flow deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle active status of flow
 * PATCH /api/flows/:id/toggle
 */
const toggleFlow = async (req, res, next) => {
  try {
    const flow = await Flow.findOne({ _id: req.params.id, userId: req.user._id });
    if (!flow) return sendError(res, 'Flow not found', 404);

    flow.isActive = !flow.isActive;
    await flow.save();

    return sendSuccess(res, `Flow is now ${flow.isActive ? 'active' : 'paused'}`, { flow });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFlows,
  getFlowById,
  createFlow,
  updateFlow,
  deleteFlow,
  toggleFlow,
};
