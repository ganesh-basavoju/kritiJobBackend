const express = require('express');
const router = express.Router();
const {
  registerToken,
  unregisterToken,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications
} = require('./notifications.controller');
const { protect } = require('../../middlewares/auth.middleware');

// All routes require authentication
router.use(protect);

// Token management
router.post('/register-token', registerToken);
router.delete('/unregister-token', unregisterToken);

// Notification history
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);

// Mark as read
router.put('/:id/read', markAsRead);
router.put('/mark-read', markMultipleAsRead);
router.put('/mark-all-read', markAllAsRead);

// Delete notifications
router.delete('/:id', deleteNotification);
router.delete('/clear-all', clearAllNotifications);

module.exports = router;
