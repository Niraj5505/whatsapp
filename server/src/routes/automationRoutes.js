const express = require('express');
const router = express.Router();
const {
  getAutomations,
  getAutomationById,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  activateAutomation,
  deactivateAutomation,
  testAutomation,
  getAutomationExecutions,
} = require('../controllers/automationController');
const { authenticateUser, requireWorkspaceMember } = require('../middleware/auth');

router.use(authenticateUser);
router.use(requireWorkspaceMember);

router.route('/')
  .get(getAutomations)
  .post(createAutomation);

router.route('/:id')
  .get(getAutomationById)
  .put(updateAutomation)
  .delete(deleteAutomation);

router.post('/:id/activate', activateAutomation);
router.post('/:id/deactivate', deactivateAutomation);
router.post('/:id/test', testAutomation);
router.get('/:id/executions', getAutomationExecutions);

module.exports = router;
