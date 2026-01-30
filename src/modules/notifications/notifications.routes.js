const express = require('express');
const { getNotifications, markAllAsRead } = require('./notifications.controller');
const { protect } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);

module.exports = router;
