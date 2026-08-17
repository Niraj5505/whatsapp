const express = require('express');
const router = express.Router();
const {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  importContacts,
  exportContacts,
} = require('../controllers/contactController');
const { authenticateUser, requireWorkspaceMember } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createContactSchema, updateContactSchema } = require('../validators/contactValidator');

// Apply workspace authorization to all contact routes
router.use(authenticateUser);
router.use(requireWorkspaceMember);

// CSV Import & Export routes
router.post('/import', importContacts);
router.get('/export', exportContacts);

// Main CRUD routes
router
  .route('/')
  .get(getContacts)
  .post(validate(createContactSchema), createContact);

router
  .route('/:id')
  .get(getContactById)
  .put(validate(updateContactSchema), updateContact)
  .delete(deleteContact);

module.exports = router;
