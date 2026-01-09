const fs = require('fs');

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    fs.writeFileSync('crash_dump.txt', `Uncaught Exception: ${err.stack}\n`);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
    fs.writeFileSync('crash_dump.txt', `Unhandled Rejection: ${err.stack}\n`);
    process.exit(1);
});

require('dotenv').config();
const http = require('http');
const connectDB = require('./config/db');
const socketConfig = require('./config/socket');
const logger = require('./config/logger');
const app = require('./app');
const runCronJobs = require('./cron/cleanup.job');
const chatHandler = require('./sockets/chat.handler');
const notificationHandler = require('./sockets/notification.handler');

// Connect to Database
connectDB();

// Init Cron
runCronJobs();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Init Socket.io
const io = socketConfig.init(server);

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  
  // Load socket handlers
  try {
      chatHandler(io, socket);
      notificationHandler(io, socket);
  } catch (err) {
      logger.error(`Socket Handler Error: ${err.message}`);
  }

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
