const express = require('express');
const { getNotifications, markAllAsRead, registerToken, unregisterToken } = require('./notifications.controller');
const { protect } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.post('/register-token', registerToken);
router.delete('/unregister-token', unregisterToken);
router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);

module.exports = router;
