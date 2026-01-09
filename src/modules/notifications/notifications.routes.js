const express = require('express');
const { getNotifications, markAsRead } = require('./notifications.controller');
const { protect } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);

module.exports = router;
