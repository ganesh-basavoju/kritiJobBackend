const app = require('../src/app');
const connectDB = require('../src/config/db');

// Connect to Database
connectDB();

// Export the Express API
module.exports = app;
