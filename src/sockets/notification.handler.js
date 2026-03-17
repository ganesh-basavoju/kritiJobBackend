const logger = require('../config/logger');
const Notification = require('../models/Notification');

module.exports = (io, socket) => {
    // Join user-specific room automatically upon connection if authenticated
    if (socket.user) {
        const roomName = `user:${socket.user._id}`;
        socket.join(roomName);
        logger.info(`User ${socket.user._id} joined room: ${roomName}`);

        // Join Admin room if user is admin
        if (socket.user.role === 'admin') {
            socket.join('admin');
            logger.info(`User ${socket.user._id} joined room: admin`);
        }
    }

    // Mark notification as read
    socket.on('notification:read', async (notificationId) => {
        try {
            await Notification.findOneAndUpdate(
                { _id: notificationId, recipient: socket.user._id },
                { isRead: true }
            );
            // Optionally confirm back to client
            socket.emit('notification:updated', { id: notificationId, isRead: true });
        } catch (error) {
            logger.error(`Error marking notification read: ${error.message}`);
        }
    });
    
    // Mark all as read
    socket.on('notification:read_all', async () => {
        try {
            await Notification.updateMany(
                { recipient: socket.user._id, isRead: false },
                { isRead: true }
            );
            socket.emit('notification:all_read');
        } catch (error) {
            logger.error(`Error marking all notifications read: ${error.message}`);
        }
    });
};
