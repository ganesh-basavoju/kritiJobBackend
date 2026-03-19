const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  candidateId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  plan: {
    type: String,
    enum: ['premium'],
    default: 'premium'
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active',
    index: true
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  // Payment details
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true
  },
  razorpayPaymentId: {
    type: String,
    sparse: true
  },
  razorpaySignature: {
    type: String,
    sparse: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  // Auto-renewal
  autoRenew: {
    type: Boolean,
    default: true,
    index: true
  },

  // Cancellation tracking
  cancellationReason: {
    type: String,
    enum: ['user_initiated', 'payment_failed', 'chargebacks', 'admin_action', null],
    default: null,
    sparse: true
  },

  cancelledAt: {
    type: Date,
    sparse: true,
    index: true
  },

  // Renewal attempt tracking
  renewalAttempts: {
    type: Number,
    default: 0
  },

  lastRenewalAttempt: {
    type: Date,
    sparse: true,
    index: true
  },

  nextRenewalDate: {
    type: Date,
    sparse: true,
    index: true
  },

  // Failure tracking
  failureReason: {
    type: String,
    sparse: true
  },

  lastFailureAt: {
    type: Date,
    sparse: true
  },

  // Webhook tracking
  razorpayWebhookId: {
    type: String,
    sparse: true
  },

  // Notes
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Index for finding active subscriptions
subscriptionSchema.index({ candidateId: 1, status: 1, endDate: 1 });

// Index for finding subscriptions to renew
subscriptionSchema.index({ 
  autoRenew: 1, 
  status: 1, 
  nextRenewalDate: 1 
});

// Method to check if subscription is currently valid
subscriptionSchema.methods.isValid = function() {
  return this.status === 'active' && 
         this.paymentStatus === 'completed' &&
         this.endDate > new Date();
};

// Method to mark renewal failed
subscriptionSchema.methods.recordRenewalFailure = async function(reason) {
  this.renewalAttempts += 1;
  this.failureReason = reason;
  this.lastFailureAt = new Date();
  
  // If more than 3 attempts failed, disable auto-renewal
  if (this.renewalAttempts >= 3) {
    this.autoRenew = false;
    this.cancellationReason = 'payment_failed';
  }
  
  await this.save();
};

// Method to check if subscription needs renewal soon
subscriptionSchema.methods.needsRenewalSoon = function(daysBeforeExpiry = 3) {
  if (!this.autoRenew || this.status !== 'active' || this.paymentStatus !== 'completed') {
    return false;
  }

  const today = new Date();
  const renewalThreshold = new Date();
  renewalThreshold.setDate(renewalThreshold.getDate() + daysBeforeExpiry);

  return this.endDate >= today && this.endDate <= renewalThreshold;
};

// Static method to get active subscription for a candidate
subscriptionSchema.statics.getActiveSubscription = async function(candidateId) {
  return await this.findOne({
    candidateId,
    status: 'active',
    paymentStatus: 'completed',
    endDate: { $gt: new Date() }
  }).sort({ endDate: -1 });
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
