const express = require('express');
const router = express.Router();
const {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  syncTemplates,
} = require('../controllers/templateController');
const { authenticateUser, requireWorkspaceMember } = require('../middleware/auth');

router.use(authenticateUser);
router.use(requireWorkspaceMember);

router.post('/sync', syncTemplates);

router.route('/')
  .get(getTemplates)
  .post(createTemplate);

router.route('/:id')
  .get(getTemplateById)
  .put(updateTemplate)
  .delete(deleteTemplate);

module.exports = router;
