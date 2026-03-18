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
  // Auto-renewal (for future implementation)
  autoRenew: {
    type: Boolean,
    default: true
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

// Method to check if subscription is currently valid
subscriptionSchema.methods.isValid = function() {
  return this.status === 'active' && 
         this.paymentStatus === 'completed' &&
         this.endDate > new Date();
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
