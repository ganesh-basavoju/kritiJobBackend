const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler.middleware');

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());

// Skip body parsing entirely for multipart/form-data (handled by multer)
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.startsWith('multipart/form-data')) {
    console.log('Skipping body parsing for multipart request');
    return next();
  }
  express.json({ limit: '50mb' })(req, res, next);
});

app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.startsWith('multipart/form-data')) {
    return next();
  }
  express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
});

app.use(morgan('dev'));

// Static folder for local uploads (if needed)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api', routes);

// Base route
app.get('/', (req, res) => {
  res.send('Job Portal API is running...');
});

// Error Handler
app.use(errorHandler);

module.exports = app;
