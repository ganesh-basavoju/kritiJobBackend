const express = require('express');
const router = express.Router();
const {
  createSubscriptionOrder,
  verifyPayment,
  getSubscriptionStatus,
  getSubscriptionHistory,
  cancelSubscription,
  enableAutoRenewal
} = require('./subscriptions.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

// All routes require authentication and candidate role
router.use(protect);
router.use(authorize('candidate'));

router.post('/create-order', createSubscriptionOrder);
router.post('/verify-payment', verifyPayment);
router.get('/status', getSubscriptionStatus);
router.get('/history', getSubscriptionHistory);
router.post('/cancel', cancelSubscription);
router.post('/enable-auto-renew', enableAutoRenewal);

module.exports = router;
