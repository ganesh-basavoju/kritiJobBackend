const crypto = require('crypto');
const Razorpay = require('razorpay');
const Subscription = require('../../models/Subscription');
const Company = require('../../models/Company');
const User = require('../../models/User');

let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
} else {
  console.warn('WARNING: Razorpay keys are missing from .env (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET). Employer subscription feature will fail.');
}

const SUBSCRIPTION_PLANS = {
  premium: {
    amount: 49900, // Rs. 499
    currency: 'INR',
    duration: 30 // days
  }
};

const getWebBaseUrl = () => {
  const configured = "https://kritijob-frontend.vercel.app/";
  // const configured = process.env.PAYMENT_WEB_BASE_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  return configured.replace(/\/$/, '');
};

exports.createEmployerSubscriptionOrder = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || user.role !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can purchase employer premium subscriptions'
      });
    }

    const company = await Company.findOne({ ownerId: userId });
    if (!company) {
      return res.status(400).json({
        success: false,
        message: 'Please create a company profile first'
      });
    }

    const existingSubscription = await Subscription.getActiveSubscription(userId);
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active premium subscription',
        data: {
          existingSubscriptionExpiresAt: existingSubscription.endDate
        }
      });
    }

    const plan = SUBSCRIPTION_PLANS.premium;

    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message: 'Payment gateway is not currently configured on the server.'
      });
    }

    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: plan.currency,
      receipt: `emp_sub_${userId.toString().slice(-8)}_${Date.now()}`,
      notes: {
        employerId: userId.toString(),
        plan: 'premium',
        duration: plan.duration
      }
    });

    const authHeader = req.headers.authorization || '';
    const authToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);

    const subscription = await Subscription.create({
      candidateId: userId,
      plan: 'premium',
      status: 'active',
      startDate,
      endDate,
      razorpayOrderId: order.id,
      amount: plan.amount,
      currency: plan.currency,
      paymentStatus: 'pending',
      notes: 'employer'
    });

    const paymentUrl = new URL(`${getWebBaseUrl()}/payment/checkout`);
    paymentUrl.searchParams.set('flow', 'employer');
    paymentUrl.searchParams.set('orderId', order.id);
    paymentUrl.searchParams.set('amount', String(plan.amount));
    paymentUrl.searchParams.set('currency', plan.currency);
    paymentUrl.searchParams.set('keyId', process.env.RAZORPAY_KEY_ID || '');
    if (authToken) {
      paymentUrl.searchParams.set('token', authToken);
    }

    res.status(200).json({
      success: true,
      data: {
        paymentUrl: paymentUrl.toString(),
        orderId: order.id,
        subscriptionId: subscription._id
      }
    });
  } catch (error) {
    console.error('Create employer subscription order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create employer subscription order',
      error: error.message
    });
  }
};

exports.verifyEmployerPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification details'
      });
    }

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

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      subscription.paymentStatus = 'failed';
      subscription.status = 'cancelled';
      await subscription.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    subscription.razorpayPaymentId = razorpay_payment_id;
    subscription.razorpaySignature = razorpay_signature;
    subscription.paymentStatus = 'completed';
    subscription.status = 'active';
    subscription.autoRenew = true;
    subscription.nextRenewalDate = new Date(subscription.endDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    await subscription.save();

    await Company.findOneAndUpdate(
      { ownerId: userId },
      {
        isPremiumEmployer: true,
        subscriptionExpiresAt: subscription.endDate
      },
      {
        new: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Payment verified and employer premium subscription activated successfully',
      data: {
        subscriptionId: subscription._id,
        status: subscription.status,
        expiresAt: subscription.endDate,
        autoRenew: subscription.autoRenew
      }
    });
  } catch (error) {
    console.error('Employer payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

exports.getEmployerSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const company = await Company.findOne({ ownerId: userId });
    const activeSubscription = await Subscription.getActiveSubscription(userId);

    if (!company) {
      return res.status(200).json({
        success: true,
        data: {
          isPremium: false,
          subscriptionExpiresAt: null,
          currentMonthJobPosts: 0,
          jobPostLimit: 10,
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

    const isPremium = company.hasActivePremiumEmployer();
    if (!isPremium && company.isPremiumEmployer) {
      company.isPremiumEmployer = false;
      company.subscriptionExpiresAt = null;
      await company.save();
    }

    res.status(200).json({
      success: true,
      data: {
        isPremium,
        subscriptionExpiresAt: company.subscriptionExpiresAt,
        currentMonthJobPosts: company.getCurrentMonthJobPostCount(),
        jobPostLimit: isPremium ? 'unlimited' : 10,
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
    console.error('Get employer subscription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve employer subscription status',
      error: error.message
    });
  }
};

exports.getEmployerSubscriptionHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      Subscription.find({
        candidateId: userId,
        paymentStatus: 'completed'
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Subscription.countDocuments({
        candidateId: userId,
        paymentStatus: 'completed'
      })
    ]);

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
    console.error('Get employer subscription history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve employer subscription history',
      error: error.message
    });
  }
};

exports.cancelEmployerSubscription = async (req, res) => {
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

    activeSubscription.autoRenew = false;
    activeSubscription.cancellationReason = 'user_initiated';
    activeSubscription.cancelledAt = new Date();
    activeSubscription.nextRenewalDate = null;
    await activeSubscription.save();

    res.status(200).json({
      success: true,
      message: 'Auto-renewal cancelled successfully',
      data: {
        subscriptionId: activeSubscription._id,
        status: activeSubscription.status,
        expiresAt: activeSubscription.endDate,
        autoRenew: activeSubscription.autoRenew
      }
    });
  } catch (error) {
    console.error('Cancel employer subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel employer subscription',
      error: error.message
    });
  }
};

exports.enableEmployerAutoRenewal = async (req, res) => {
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

    activeSubscription.autoRenew = true;
    activeSubscription.cancellationReason = null;
    activeSubscription.cancelledAt = null;
    activeSubscription.nextRenewalDate = new Date(activeSubscription.endDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    activeSubscription.renewalAttempts = 0;
    activeSubscription.failureReason = null;
    await activeSubscription.save();

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
    console.error('Enable employer auto-renewal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enable employer auto-renewal',
      error: error.message
    });
  }
};
