const express = require('express');
const {
	getNotifications,
	getUnreadCount,
	markAsRead,
	markMultipleAsRead,
	markAllAsRead,
	deleteNotification,
	clearAllNotifications,
	registerToken,
	unregisterToken
} = require('./notifications.controller');
const { protect } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.post('/register-token', registerToken);
router.delete('/unregister-token', unregisterToken);
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/mark-read', markMultipleAsRead);
router.put('/mark-all-read', markAllAsRead);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/clear-all', clearAllNotifications);
router.delete('/:id', deleteNotification);

module.exports = router;
