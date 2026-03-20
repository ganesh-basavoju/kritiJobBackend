const express = require('express');
const router = express.Router();
const {
  createEmployerSubscriptionOrder,
  verifyEmployerPayment,
  getEmployerSubscriptionStatus,
  getEmployerSubscriptionHistory,
  cancelEmployerSubscription,
  enableEmployerAutoRenewal
} = require('./employer-subscriptions.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

// All routes require authentication and employer role
router.use(protect);
router.use(authorize('employer'));

router.post('/create-order', createEmployerSubscriptionOrder);
router.post('/verify-payment', verifyEmployerPayment);
router.get('/status', getEmployerSubscriptionStatus);
router.get('/history', getEmployerSubscriptionHistory);
router.post('/cancel', cancelEmployerSubscription);
router.post('/enable-auto-renew', enableEmployerAutoRenewal);

module.exports = router;
