let io;

module.exports = {
  init: (httpServer) => {
    io = require('socket.io')(httpServer, {
      cors: {
        origin: [process.env.CLIENT_URL || "http://localhost:5173", "http://localhost:5174", "https://kriti-job-portal.vercel.app"],
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    const jwt = require('jsonwebtoken');
    const config = require('./jwt');
    const User = require('../models/User');

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }

            const decoded = jwt.verify(token, config.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            
            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }
            
            if (user.status === 'blocked') {
                return next(new Error('Authentication error: User blocked'));
            }

            // Attach user to socket
            socket.user = user;
            next();
        } catch (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  }
};
