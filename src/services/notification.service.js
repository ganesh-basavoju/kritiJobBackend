const Notification = require('../models/Notification');
const User = require('../models/User');
const socketConfig = require('../config/socket');
const { getMessaging } = require('../config/firebase');
const logger = require('../config/logger');

class NotificationService {
  /**
   * Send a notification to a specific user
   */
  async send({ recipientId, type, title, message, entityType, entityId, data = {}, channels = ['socket', 'fcm'] }) {
    try {
      // 1. Create Notification in Database
      const notification = await Notification.create({
        recipient: recipientId,
        type,
        title,
        message,
        entityType,
        entityId,
        data,
        deliveryChannels: channels
      });

      // 2. Send via Socket.io
      if (channels.includes('socket')) {
        this.sendToSocket(recipientId, notification);
      }

      // 3. Send via FCM (Push Notification)
      if (channels.includes('fcm')) {
        this.sendToFCM(recipientId, title, message, data);
      }
      
      return notification;

    } catch (error) {
      logger.error(`NotificationService Error: ${error.message}`);
    }
  }

  /**
   * Send notification to all Admins
   */
  async sendToAdmin({ type, title, message, entityType, entityId, data = {} }) {
    try {
        // 1. Find all admins
        const admins = await User.find({ role: 'admin' }).select('_id');
        
        if (admins.length === 0) return;

        // 2. Create and Send Notifications (Individual)
        for (const admin of admins) {
            const notification = await Notification.create({
                recipient: admin._id,
                type,
                title,
                message,
                entityType,
                entityId,
                data,
                deliveryChannels: ['socket']
            });

            this.sendToSocket(admin._id, notification);
        }

        logger.info(`Admin notification sent to ${admins.length} admins: ${title}`);

    } catch (error) {
        logger.error(`Failed to send Admin notification: ${error.message}`);
    }
  }

  sendToSocket(userId, notification) {
    try {
      const io = socketConfig.getIO();
      io.to(`user:${userId}`).emit('notification:new', notification);
      logger.debug(`Socket notification sent to user:${userId}`);
    } catch (error) {
      logger.warn(`Socket emission failed: ${error.message}`);
    }
  }

  async sendToFCM(userId, title, body, data = {}) {
    try {
      const user = await User.findById(userId).select('fcmTokens');
      if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
        return; 
      }

      const stringData = {};
      for (const [key, value] of Object.entries(data)) {
        stringData[key] = String(value);
      }

      const message = {
        notification: { title, body },
        data: stringData,
        tokens: user.fcmTokens
      };

      const messaging = getMessaging();
      const response = await messaging.sendMulticast(message);
      
      if (response.failureCount > 0) {
         // Logic to clean up tokens could go here
      }

      logger.debug(`FCM sent: ${response.successCount} success`);

    } catch (error) {
      logger.warn(`FCM send failed: ${error.message}`);
    }
  }
}

module.exports = new NotificationService();
