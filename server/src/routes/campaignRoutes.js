const express = require('express');
const router = express.Router();
const {
  getCampaigns,
  getCampaignById,
  getCampaignRecipients,
  createCampaign,
  startCampaign,
  pauseCampaign,
  cancelCampaign,
  deleteCampaign,
} = require('../controllers/campaignController');
const { authenticateUser, requireWorkspaceMember } = require('../middleware/auth');

router.use(authenticateUser);
router.use(requireWorkspaceMember);

router.route('/')
  .get(getCampaigns)
  .post(createCampaign);

router.route('/:id')
  .get(getCampaignById)
  .delete(deleteCampaign);

router.get('/:id/recipients', getCampaignRecipients);
router.post('/:id/start', startCampaign);
router.post('/:id/pause', pauseCampaign);
router.post('/:id/cancel', cancelCampaign);

module.exports = router;
