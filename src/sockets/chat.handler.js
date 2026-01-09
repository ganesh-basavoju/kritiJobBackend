const Message = require('../models/Message');

module.exports = (io, socket) => {
    // Join a room based on User ID to receive private messages
    socket.on('join_room', (userId) => {
        if (userId) {
            socket.join(userId); // Join room named after userID
            // logger.info(`User ${userId} joined room`);
        }
    });

    socket.on('send_message', async (data) => {
        // Data should contain senderId, receiverId, content
        // In a real app, validate token from socket handshake to ensure sender is who they say they are.
        // Assuming done in connection middleware or trusted for this MVP scope.
        try {
            const { senderId, receiverId, content } = data;
            const conversationId = [senderId, receiverId].sort().join('_');
            
            const message = await Message.create({
                conversationId,
                senderId,
                receiverId,
                content
            });

            // Emit to receiver's room
            io.to(receiverId).emit('receive_message', message);
            // Emit back to sender (optional, or just handle optimistic UI)
            socket.emit('receive_message', message);
            
        } catch (err) {
            console.error('Socket Message Error:', err);
        }
    });
};
