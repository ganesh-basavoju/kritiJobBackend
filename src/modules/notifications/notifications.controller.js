const DeviceToken = require('../../models/DeviceToken');
const Notification = require('../../models/Notification');
const logger = require('../../config/logger');

// @desc    Register or update FCM token
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

    // Check if token already exists
    let deviceToken = await DeviceToken.findOne({ fcmToken });

    if (deviceToken) {
      // Update existing token
      deviceToken.userId = req.user.id;
      deviceToken.role = req.user.role;
      deviceToken.platform = platform;
      deviceToken.deviceId = deviceId || deviceToken.deviceId;
      deviceToken.enabled = true;
      deviceToken.lastUsed = Date.now();
      await deviceToken.save();

      logger.info(`FCM token updated for user: ${req.user.id}`);
    } else {
      // Create new token
      deviceToken = await DeviceToken.create({
        userId: req.user.id,
        role: req.user.role,
        fcmToken,
        platform,
        deviceId,
        enabled: true
      });

      logger.info(`FCM token registered for user: ${req.user.id}`);
    }

    res.status(200).json({
      success: true,
      message: 'Device token registered successfully',
      data: {
        tokenId: deviceToken._id
      }
    });
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(200).json({
        success: true,
        message: 'Token already registered'
      });
    }
    next(error);
  }
};

// @desc    Unregister FCM token (on logout)
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

    // Delete the token
    await DeviceToken.deleteOne({ fcmToken, userId: req.user.id });

    logger.info(`FCM token unregistered for user: ${req.user.id}`);

    res.status(200).json({
      success: true,
      message: 'Device token unregistered successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's notification history
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
  try {
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 20;
    const skip = (page - 1) * limit;

    // Get total count
    const total = await Notification.countDocuments({ userId: req.user.id });
    const totalPages = Math.ceil(total / limit);

    // Get notifications
    const notifications = await Notification.find({ userId: req.user.id })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .select('-__v');

    // Get unread count
    const unreadCount = await Notification.getUnreadCount(req.user.id);

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
      unreadCount,
      page,
      totalPages,
      total
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.getUnreadCount(req.user.id);

    res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found' 
      });
    }

    await notification.markAsRead();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
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
      return res.status(400).json({ 
        success: false, 
        message: 'Notification IDs array is required' 
      });
    }

    const result = await Notification.markMultipleAsRead(notificationIds, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
exports.markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.markAllAsRead(req.user.id);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear all notifications
// @route   DELETE /api/notifications/clear-all
// @access  Private
exports.clearAllNotifications = async (req, res, next) => {
  try {
    const result = await Notification.deleteMany({ userId: req.user.id });

    res.status(200).json({
      success: true,
      message: 'All notifications cleared',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    next(error);
  }
};
