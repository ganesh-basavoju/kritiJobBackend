const crypto = require('crypto');
const Razorpay = require('razorpay');
const Subscription = require('../../models/Subscription');
const CandidateProfile = require('../../models/CandidateProfile');
const User = require('../../models/User');

// Initialize Razorpay instance conditionally to avoid crashes if keys are missing
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
} else {
  console.warn('WARNING: Razorpay keys are missing from .env (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET). Subscription feature will fail.');
}

// Subscription pricing (in paise for INR, e.g., 29900 = ₹299)
const SUBSCRIPTION_PLANS = {
  premium: {
    amount: 49900, // ₹499
    currency: 'INR',
    duration: 30 // days
  }
};

/**
 * @desc    Create Razorpay order for premium subscription
 * @route   POST /api/subscriptions/create-order
 * @access  Private (Candidate only)
 */
exports.createSubscriptionOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if user is a candidate
    const user = await User.findById(userId);
    if (!user || user.role !== 'candidate') {
      return res.status(403).json({
        success: false,
        message: 'Only candidates can purchase premium subscriptions'
      });
    }

    // Ensure candidate profile exists for new users before subscription flow.
    let candidateProfile = await CandidateProfile.findOne({ userId });
    if (!candidateProfile) {
      candidateProfile = await CandidateProfile.create({ userId });
    }

    const plan = SUBSCRIPTION_PLANS.premium;

    // Create Razorpay order
    const options = {
      amount: plan.amount, // amount in smallest currency unit
      currency: plan.currency,
      receipt: `sub_${userId.toString().slice(-8)}_${Date.now()}`,
      notes: {
        candidateId: userId.toString(),
        plan: 'premium',
        duration: plan.duration
      }
    };

    // Create Razorpay order
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message: 'Payment gateway is not currently configured on the server.'
      });
    }

    const order = await razorpay.orders.create(options);

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);

    // Create subscription record with pending status
    const subscription = await Subscription.create({
      candidateId: userId,
      plan: 'premium',
      status: 'active',
      startDate,
      endDate,
      razorpayOrderId: order.id,
      amount: plan.amount,
      currency: plan.currency,
      paymentStatus: 'pending'
    });

    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: plan.amount,
        currency: plan.currency,
        subscriptionId: subscription._id,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    console.error('Create subscription order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription order',
      error: error.message
    });
  }
};

/**
 * @desc    Verify Razorpay payment and activate subscription
 * @route   POST /api/subscriptions/verify-payment
 * @access  Private (Candidate only)
 */
exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    // ✅ NEW: Check for existing active subscription FIRST
    const existingSubscription = await Subscription.getActiveSubscription(userId);
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active premium subscription',
        data: {
          existingSubscriptionExpiresAt: existingSubscription.endDate,
          message: `Your premium access will remain valid until ${existingSubscription.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        }
      });
    }

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification details'
      });
    }

    // Find subscription by order ID
    const subscription = await Subscription.findOne({
      razorpayOrderId: razorpay_order_id,
      candidateId: userId
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      // Mark payment as failed
      subscription.paymentStatus = 'failed';
      subscription.status = 'cancelled';
      await subscription.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Update subscription with payment details
    subscription.razorpayPaymentId = razorpay_payment_id;
    subscription.razorpaySignature = razorpay_signature;
    subscription.paymentStatus = 'completed';
    subscription.status = 'active';
    subscription.autoRenew = true; // Enable auto-renewal on successful payment
    subscription.nextRenewalDate = new Date(subscription.endDate.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days before expiry
    await subscription.save();

    // Update candidate profile to premium (upsert for safety with newly registered users).
    await CandidateProfile.findOneAndUpdate(
      { userId },
      {
        isPremium: true,
        subscriptionExpiresAt: subscription.endDate,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    res.status(200).json({
      success: true,
      message: 'Payment verified and subscription activated successfully',
      data: {
        subscriptionId: subscription._id,
        status: subscription.status,
        expiresAt: subscription.endDate,
        autoRenew: subscription.autoRenew
      }
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

/**
 * @desc    Get current subscription status
 * @route   GET /api/subscriptions/status
 * @access  Private (Candidate only)
 */
exports.getSubscriptionStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get candidate profile
    const candidateProfile = await CandidateProfile.findOne({ userId });
    // Get active subscription
    const activeSubscription = await Subscription.getActiveSubscription(userId);

    // New candidates may not have a profile yet. Return default free status.
    if (!candidateProfile) {
      return res.status(200).json({
        success: true,
        data: {
          isPremium: false,
          subscriptionExpiresAt: null,
          currentMonthApplications: 0,
          applicationLimit: 10,
          activeSubscription: activeSubscription ? {
            id: activeSubscription._id,
            startDate: activeSubscription.startDate,
            endDate: activeSubscription.endDate,
            status: activeSubscription.status,
            autoRenew: activeSubscription.autoRenew
          } : null
        }
      });
    }

    // Check if subscription is expired
    const isPremium = candidateProfile.hasActivePremium();
    if (!isPremium && candidateProfile.isPremium) {
      // Subscription expired, update profile
      candidateProfile.isPremium = false;
      await candidateProfile.save();
    }

    res.status(200).json({
      success: true,
      data: {
        isPremium: isPremium,
        subscriptionExpiresAt: candidateProfile.subscriptionExpiresAt,
        currentMonthApplications: candidateProfile.getCurrentMonthApplicationCount(),
        applicationLimit: isPremium ? 'unlimited' : 10,
        activeSubscription: activeSubscription ? {
          id: activeSubscription._id,
          startDate: activeSubscription.startDate,
          endDate: activeSubscription.endDate,
          status: activeSubscription.status,
          autoRenew: activeSubscription.autoRenew
        } : null
      }
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription status',
      error: error.message
    });
  }
};

/**
 * @desc    Get subscription history with pagination
 * @route   GET /api/subscriptions/history?page=1&limit=10
 * @access  Private (Candidate only)
 */
exports.getSubscriptionHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // ✅ NEW: Extract pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10); // Max 50 items per page
    const skip = (page - 1) * limit;

    // ✅ NEW: Run two queries in parallel - one for data, one for count
    const [subscriptions, total] = await Promise.all([
      Subscription.find({
        candidateId: userId,
        paymentStatus: 'completed'
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(), // Use lean() for faster query
      
      Subscription.countDocuments({
        candidateId: userId,
        paymentStatus: 'completed'
      })
    ]);

    // ✅ NEW: Return paginated response
    res.status(200).json({
      success: true,
      data: subscriptions,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get subscription history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription history',
      error: error.message
    });
  }
};

/**
 * @desc    Cancel auto-renewal for current subscription
 * @route   POST /api/subscriptions/cancel
 * @access  Private (Candidate only)
 */
exports.cancelSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const activeSubscription = await Subscription.getActiveSubscription(userId);
    if (!activeSubscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    if (!activeSubscription.autoRenew) {
      return res.status(400).json({
        success: false,
        message: 'Auto-renewal is already disabled for this membership'
      });
    }

    // ✅ IMPROVED: Update subscription to disable auto-renewal with full tracking
    activeSubscription.autoRenew = false;
    activeSubscription.cancellationReason = 'user_initiated';
    activeSubscription.cancelledAt = new Date();
    activeSubscription.nextRenewalDate = null;
    await activeSubscription.save();

    // ✅ NEW: Send notification to user (non-blocking)
    try {
      const notificationService = require('../../services/notification.service');
      await notificationService.send({
        recipientId: userId,
        type: 'SUBSCRIPTION_CANCELLED',
        title: 'Auto-Renewal Cancelled',
        message: `Auto-renewal has been disabled. Your premium benefits will be active until ${activeSubscription.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        entityType: 'subscription',
        entityId: activeSubscription._id,
        data: {
          subscriptionId: activeSubscription._id.toString(),
          expiresAt: activeSubscription.endDate
        }
      });
    } catch (notifError) {
      console.error('Failed to send cancellation notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Auto-renewal cancelled successfully',
      data: {
        subscriptionId: activeSubscription._id,
        status: activeSubscription.status,
        expiresAt: activeSubscription.endDate,
        autoRenew: activeSubscription.autoRenew,
        cancellationMessage: `Your premium subscription will expire on ${activeSubscription.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
};

/**
 * @desc    Enable auto-renewal for active subscription
 * @route   POST /api/subscriptions/enable-auto-renew
 * @access  Private (Candidate only)
 */
exports.enableAutoRenewal = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const activeSubscription = await Subscription.getActiveSubscription(userId);
    if (!activeSubscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    if (activeSubscription.autoRenew) {
      return res.status(400).json({
        success: false,
        message: 'Auto-renewal is already enabled for this membership'
      });
    }

    // ✅ IMPROVED: Enable auto-renewal and set renewal date
    activeSubscription.autoRenew = true;
    activeSubscription.cancellationReason = null;
    activeSubscription.cancelledAt = null;
    activeSubscription.nextRenewalDate = new Date(activeSubscription.endDate.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days before expiry
    activeSubscription.renewalAttempts = 0; // Reset renewal attempts
    activeSubscription.failureReason = null;
    await activeSubscription.save();

    // ✅ NEW: Send notification to user (non-blocking)
    try {
      const notificationService = require('../../services/notification.service');
      await notificationService.send({
        recipientId: userId,
        type: 'SUBSCRIPTION_RENEWED',
        title: 'Auto-Renewal Enabled',
        message: 'Auto-renewal has been enabled. Your subscription will be automatically renewed on expiration.',
        entityType: 'subscription',
        entityId: activeSubscription._id,
        data: {
          subscriptionId: activeSubscription._id.toString(),
          expiresAt: activeSubscription.endDate
        }
      });
    } catch (notifError) {
      console.error('Failed to send renewal notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Auto-renewal enabled successfully',
      data: {
        subscriptionId: activeSubscription._id,
        expiresAt: activeSubscription.endDate,
        nextRenewalDate: activeSubscription.nextRenewalDate,
        autoRenew: activeSubscription.autoRenew
      }
    });
  } catch (error) {
    console.error('Enable auto-renewal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enable auto-renewal',
      error: error.message
    });
  }
};
