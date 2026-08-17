const express = require('express');
const router = express.Router();
const { getDashboardAnalytics } = require('../controllers/analyticsController');
const { authenticateUser, requireWorkspaceMember } = require('../middleware/auth');

router.use(authenticateUser);
router.use(requireWorkspaceMember);

router.get('/dashboard', getDashboardAnalytics);
router.get('/', getDashboardAnalytics);

module.exports = router;
