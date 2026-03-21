const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(NOTIFICATION_TYPES),
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  entityType: {
    type: String,
    enum: ['job', 'application', 'user', 'company', 'subscription'],
    required: false
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  deliveryChannels: [{
    type: String,
    enum: ['socket', 'fcm', 'email'],
    default: ['socket']
  }]
}, {
  timestamps: true
});

// Index for fetching user's notifications sorted by date
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
