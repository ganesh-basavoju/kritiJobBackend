const Notification = require('../../models/Notification');
const DeviceToken = require('../../models/DeviceToken');
const mongoose = require('mongoose');

// @desc    Register FCM token
// @route   POST /api/notifications/register-token
// @access  Private
exports.registerToken = async (req, res, next) => {
    try {
        const { fcmToken, platform, deviceId } = req.body;

        if (!fcmToken || !platform) {
            return res.status(400).json({
                success: false,
                message: 'FCM token and platform are required'
            });
        }

        // Find existing token or create new one
        let token = await DeviceToken.findOne({ fcmToken });

        if (token) {
            // Update existing token
            token.userId = req.user.id;
            token.role = req.user.role;
            token.platform = platform;
            token.deviceId = deviceId;
            token.enabled = true;
            token.lastUsed = Date.now();
            await token.save();
        } else {
            // Create new token
            token = await DeviceToken.create({
                userId: req.user.id,
                role: req.user.role,
                fcmToken,
                platform,
                deviceId
            });
        }

        res.status(200).json({
            success: true,
            data: { tokenId: token._id }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Unregister FCM token
// @route   DELETE /api/notifications/unregister-token
// @access  Private
exports.unregisterToken = async (req, res, next) => {
    try {
        const { fcmToken } = req.body;

        if (!fcmToken) {
            return res.status(400).json({
                success: false,
                message: 'FCM token is required'
            });
        }

        await DeviceToken.deleteOne({ fcmToken, userId: req.user.id });

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const skip = (page - 1) * limit;

        const filters = { recipient: req.user.id };
        if (req.query.isRead === 'true') filters.isRead = true;
        if (req.query.isRead === 'false') filters.isRead = false;

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filters)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Notification.countDocuments(filters),
            Notification.countDocuments({ recipient: req.user.id, isRead: false })
        ]);

        const totalPages = Math.max(Math.ceil(total / limit), 1);

        res.status(200).json({
            success: true,
            data: notifications,
            total,
            page,
            limit,
            totalPages,
            unreadCount
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get unread notifications count
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res, next) => {
    try {
        const unreadCount = await Notification.countDocuments({
            recipient: req.user.id,
            isRead: false
        });

        res.status(200).json({ success: true, unreadCount, count: unreadCount });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid notification id' });
        }

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: req.user.id },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.status(200).json({ success: true, data: notification });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark multiple notifications as read
// @route   PUT /api/notifications/mark-read
// @access  Private
exports.markMultipleAsRead = async (req, res, next) => {
    try {
        const { notificationIds } = req.body;

        if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
            return res.status(400).json({ success: false, message: 'notificationIds array is required' });
        }

        const validIds = notificationIds.filter(id => mongoose.Types.ObjectId.isValid(id));

        const result = await Notification.updateMany(
            { _id: { $in: validIds }, recipient: req.user.id },
            { isRead: true }
        );

        res.status(200).json({ success: true, updatedCount: result.modifiedCount || 0 });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res, next) => {
    try {
        const result = await Notification.updateMany(
            { recipient: req.user.id, isRead: false },
            { isRead: true }
        );

        res.status(200).json({ success: true, updatedCount: result.modifiedCount || 0, data: {} });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete single notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid notification id' });
        }

        const deleted = await Notification.findOneAndDelete({ _id: id, recipient: req.user.id });

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};

// @desc    Clear all notifications for current user
// @route   DELETE /api/notifications/clear-all
// @access  Private
exports.clearAllNotifications = async (req, res, next) => {
    try {
        await Notification.deleteMany({ recipient: req.user.id });
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
