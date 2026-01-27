const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['candidate', 'employer', 'admin'],
    required: true,
    index: true
  },
  fcmToken: {
    type: String,
    required: true,
    unique: true
  },
  platform: {
    type: String,
    enum: ['android', 'ios'],
    required: true
  },
  deviceId: {
    type: String,
    index: true
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for user queries
deviceTokenSchema.index({ userId: 1, enabled: 1 });

// Method to disable token
deviceTokenSchema.methods.disable = async function() {
  this.enabled = false;
  await this.save();
};

// Static method to find active tokens for a user
deviceTokenSchema.statics.findActiveTokensForUser = async function(userId) {
  return this.find({ userId, enabled: true }).select('fcmToken platform');
};

// Static method to find active tokens for multiple users
deviceTokenSchema.statics.findActiveTokensForUsers = async function(userIds) {
  return this.find({ 
    userId: { $in: userIds }, 
    enabled: true 
  }).select('userId fcmToken platform');
};

// Static method to find active tokens by role
deviceTokenSchema.statics.findActiveTokensByRole = async function(role, excludeUserIds = []) {
  return this.find({ 
    role, 
    enabled: true,
    ...(excludeUserIds.length > 0 && { userId: { $nin: excludeUserIds } })
  }).select('userId fcmToken platform');
};

// Static method to remove invalid tokens
deviceTokenSchema.statics.removeInvalidTokens = async function(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return;
  
  await this.deleteMany({ fcmToken: { $in: tokens } });
};

// Auto-cleanup old disabled tokens (older than 30 days)
deviceTokenSchema.index({ enabled: 1, updatedAt: 1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
