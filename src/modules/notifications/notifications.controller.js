const Notification = require('../../models/Notification');
const DeviceToken = require('../../models/DeviceToken');

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
        const notifications = await Notification.find({ recipient: req.user.id })
            .sort({ createdAt: -1 })
            .limit(20); // Limit to last 20

        res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { recipient: req.user.id, isRead: false },
            { isRead: true }
        );

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
