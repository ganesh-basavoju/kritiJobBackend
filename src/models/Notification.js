const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'job_alert',           // New job posted matching candidate preferences
      'application_status',  // Application status changed
      'new_applicant',       // Employer received new application
      'job_deadline',        // Job application deadline approaching
      'general'              // General notifications
    ],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  body: {
    type: String,
    required: true,
    maxlength: 500
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  sent: {
    type: Boolean,
    default: false,
    index: true
  },
  sentAt: {
    type: Date
  },
  failedReason: {
    type: String
  },
  // For deep linking
  actionScreen: {
    type: String,
    enum: [
      'JobDetails',
      'ApplicationDetails',
      'ApplicantDetails',
      'MyApplications',
      'JobFeed',
      'EmployerApplications',
      null
    ]
  },
  actionData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

// Method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.read = true;
  await this.save();
};

// Method to mark as sent
notificationSchema.methods.markAsSent = async function() {
  this.sent = true;
  this.sentAt = Date.now();
  await this.save();
};

// Static method to mark multiple as read
notificationSchema.statics.markMultipleAsRead = async function(notificationIds, userId) {
  return this.updateMany(
    { _id: { $in: notificationIds }, userId },
    { $set: { read: true } }
  );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ userId, read: false });
};

// Static method to mark all as read for a user
notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { userId, read: false },
    { $set: { read: true } }
  );
};

module.exports = mongoose.model('Notification', notificationSchema);
