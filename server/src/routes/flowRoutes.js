const express = require('express');
const router = express.Router();
const {
  getFlows,
  getFlowById,
  createFlow,
  updateFlow,
  deleteFlow,
  toggleFlow,
} = require('../controllers/flowController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { flowSchema } = require('../validators/flowValidator');

router.use(protect);

router.route('/')
  .get(getFlows)
  .post(validate(flowSchema), createFlow);

router.route('/:id')
  .get(getFlowById)
  .put(updateFlow)
  .delete(deleteFlow);

router.patch('/:id/toggle', toggleFlow);

module.exports = router;
