/**
 * Auto-Renewal Cron Job
 * 
 * Automatically charges users for subscription renewal before expiration
 * Runs every 6 hours to check for subscriptions expiring soon
 * 
 * IMPORTANT: This implementation checks for subscriptions needing renewal
 * but requires Razorpay API tokens or subscriptions to actually charge users.
 * See implementation notes below.
 */

const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const CandidateProfile = require('../models/CandidateProfile');
const Company = require('../models/Company');
const User = require('../models/User');
const logger = require('../config/logger');
const Razorpay = require('razorpay');
const notificationService = require('../services/notification.service');

let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
} else {
  logger.warn('WARNING: Razorpay keys missing. Auto-renewal will not work.');
}

/**
 * Process auto-renewal for subscriptions expiring soon
 * Runs every 6 hours
 */
async function processAutoRenewals() {
  try {
    logger.info('🔄 Starting auto-renewal check...');

    // Find subscriptions that:
    // 1. Have auto-renewal enabled
    // 2. Are still active
    // 3. Expire within next 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const subscriptionsToRenew = await Subscription.find({
      autoRenew: true,
      status: 'active',
      paymentStatus: 'completed',
      endDate: {
        $gte: new Date(), // Not yet expired
        $lte: threeDaysFromNow // Expires within 3 days
      },
      // Don't try to renew if we recently attempted
      $or: [
        { lastRenewalAttempt: { $exists: false } },
        { lastRenewalAttempt: { $lt: new Date(Date.now() - 6 * 60 * 60 * 1000) } } // 6 hours ago
      ]
    });

    logger.info(`📊 Found ${subscriptionsToRenew.length} subscriptions to renew`);

    // Process each subscription
    for (const subscription of subscriptionsToRenew) {
      try {
        await processSubscriptionRenewal(subscription);
      } catch (error) {
        logger.error(
          `❌ Error processing renewal for subscription ${subscription._id}:`,
          error.message
        );
        await subscription.recordRenewalFailure(error.message);
      }
    }

    logger.info('✅ Auto-renewal check completed');
  } catch (error) {
    logger.error('❌ Auto-renewal job failed:', error);
  }
}

/**
 * Process renewal for a single subscription
 * 
 * NOTE: This is a simplified implementation. In production, you need to:
 * 1. Store Razorpay customer tokens from initial payment (setup in verifyPayment)
 * 2. Use Razorpay Subscriptions API or saved tokens for automatic charging
 * 3. Or migrate to Razorpay's native subscription feature
 * 
 * Current implementation creates a renewal order that requires manual payment.
 * To implement true auto-charging, see recommendations at end of file.
 */
async function processSubscriptionRenewal(subscription) {
  logger.info(`🔔 Processing renewal for subscription ${subscription._id}`);

  try {
    if (!razorpay) {
      throw new Error('Razorpay is not configured');
    }

    // Step 1: Get subscription owner
    const user = await User.findById(subscription.candidateId);
    if (!user) {
      throw new Error('User not found');
    }

    // Step 2: Create renewal order
    logger.info(`📝 Creating renewal order for subscription ${subscription._id}`);

    const renewalOrder = await razorpay.orders.create({
      amount: 49900, // ₹499 - Same as original plan
      currency: 'INR',
      receipt: `renewal_${subscription._id}_${Date.now()}`,
      notes: {
        type: 'auto_renewal',
        previousSubscriptionId: subscription._id.toString(),
        candidateId: subscription.candidateId.toString(),
        email: user.email,
        attemptNumber: subscription.renewalAttempts + 1
      }
    });

    logger.info(`✅ Created renewal order ${renewalOrder.id} for subscription ${subscription._id}`);

    // Step 3: Update subscription with renewal attempt tracking
    subscription.lastRenewalAttempt = new Date();
    subscription.renewalAttempts += 1;
    subscription.razorpayOrderId = renewalOrder.id;
    await subscription.save();

    // Step 4: Notify user about renewal attempt
    // In production with actual auto-charging, payment would happen here automatically
    await notificationService.send({
      recipientId: subscription.candidateId,
      type: 'SUBSCRIPTION_RENEWAL_INITIATED',
      title: 'Subscription Renewal',
      message: `Your premium subscription renewal is being processed. Amount: ₹499`,
      entityType: 'subscription',
      entityId: subscription._id,
      data: {
        subscriptionId: subscription._id.toString(),
        orderId: renewalOrder.id,
        amount: 49900
      }
    });

    return renewalOrder;

  } catch (error) {
    logger.error(`❌ Renewal failed for subscription ${subscription._id}:`, error.message);
    
    // Send failure notification to user
    try {
      await notificationService.send({
        recipientId: subscription.candidateId,
        type: 'SUBSCRIPTION_RENEWAL_FAILED',
        title: 'Subscription Renewal Failed',
        message: `We attempted to renew your subscription but failed. Please try again manually or contact support.`,
        entityType: 'subscription',
        entityId: subscription._id
      });
    } catch (notifError) {
      logger.error('Failed to send renewal failure notification:', notifError);
    }

    throw error;
  }
}

/**
 * Check and mark expired subscriptions
 * This runs as part of the cleanup job
 */
async function checkAndMarkExpiredSubscriptions() {
  try {
    logger.info('🔍 Checking for expired subscriptions...');

    // Find all active subscriptions that have expired
    const expiredSubscriptions = await Subscription.find({
      status: 'active',
      endDate: { $lt: new Date() }
    });

    logger.info(`📊 Found ${expiredSubscriptions.length} expired subscriptions`);

    // Update each expired subscription
    let updatedCount = 0;
    for (const subscription of expiredSubscriptions) {
      try {
        // Mark subscription as expired
        subscription.status = 'expired';
        await subscription.save();

        const user = await User.findById(subscription.candidateId).select('role');
        if (!user) {
          continue;
        }

        const activeSubscription = await Subscription.getActiveSubscription(
          subscription.candidateId
        );

        if (activeSubscription) {
          continue;
        }

        if (user.role === 'candidate') {
          const candidateProfile = await CandidateProfile.findOne({
            userId: subscription.candidateId
          });

          if (candidateProfile && candidateProfile.isPremium) {
            candidateProfile.isPremium = false;
            candidateProfile.subscriptionExpiresAt = null;
            await candidateProfile.save();

            logger.info(
              `✅ Removed premium status for candidate ${subscription.candidateId}`
            );

            try {
              await notificationService.send({
                recipientId: subscription.candidateId,
                type: 'SUBSCRIPTION_EXPIRED',
                title: 'Premium Subscription Expired',
                message: 'Your premium subscription has expired. You are back to the free tier with 10 applications/month. Renew now to continue enjoying unlimited benefits!',
                entityType: 'subscription',
                entityId: subscription._id
              });
            } catch (notifError) {
              logger.error('Failed to send expiration notification:', notifError);
            }
          }
        }

        if (user.role === 'employer') {
          const company = await Company.findOne({
            ownerId: subscription.candidateId
          });

          if (company && company.isPremiumEmployer) {
            company.isPremiumEmployer = false;
            company.subscriptionExpiresAt = null;
            await company.save();

            logger.info(
              `✅ Removed premium status for employer ${subscription.candidateId}`
            );

            try {
              await notificationService.send({
                recipientId: subscription.candidateId,
                type: 'SUBSCRIPTION_EXPIRED',
                title: 'Premium Subscription Expired',
                message: 'Your premium subscription has expired. You are back to the free tier with 10 job posts/month. Renew now to continue unlimited job posting.',
                entityType: 'subscription',
                entityId: subscription._id
              });
            } catch (notifError) {
              logger.error('Failed to send expiration notification:', notifError);
            }
          }
        }

        updatedCount++;
      } catch (error) {
        logger.error(
          `❌ Error updating subscription ${subscription._id}:`,
          error.message
        );
      }
    }

    logger.info(`✅ Updated ${updatedCount} expired subscriptions`);
  } catch (error) {
    logger.error('❌ Check expired subscriptions failed:', error);
  }
}

/**
 * Send renewal reminders to users 3 days before expiry
 */
async function sendRenewalReminders() {
  try {
    logger.info('📬 Checking for subscriptions needing renewal reminders...');

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    const fourDaysFromNow = new Date();
    fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);

    // Find subscriptions expiring in exactly 3 days window
    const subscriptionsForReminder = await Subscription.find({
      autoRenew: true,
      status: 'active',
      paymentStatus: 'completed',
      endDate: {
        $gte: threeDaysFromNow,
        $lt: fourDaysFromNow
      }
    });

    logger.info(`📊 Sending reminders to ${subscriptionsForReminder.length} users`);

    for (const subscription of subscriptionsForReminder) {
      try {
        await notificationService.send({
          recipientId: subscription.candidateId,
          type: 'SUBSCRIPTION_RENEWING_SOON',
          title: 'Subscription Renewing Soon',
          message: `Your premium subscription will renew in 3 days. Amount: ₹499. Your auto-renewal is active.`,
          entityType: 'subscription',
          entityId: subscription._id
        });
      } catch (error) {
        logger.error(
          `Failed to send reminder for subscription ${subscription._id}:`,
          error.message
        );
      }
    }

    logger.info(`✅ Sent ${subscriptionsForReminder.length} renewal reminders`);
  } catch (error) {
    logger.error('❌ Send renewal reminders failed:', error);
  }
}

/**
 * Initialize auto-renewal cron jobs
 * Runs every 6 hours to check for subscriptions to renew
 */
function initAutoRenewalJob() {
  // ✅ Run every 6 hours at minute 0 (00:00, 06:00, 12:00, 18:00)
  // Format: minute, hour (0-23), day of month, month, day of week
  cron.schedule('0 */6 * * *', async () => {
    logger.info('═══════════════════════════════════════');
    logger.info('🔄 Auto-Renewal Cron Job Started');
    logger.info('═══════════════════════════════════════');
    
    await processAutoRenewals();
    
    logger.info('═══════════════════════════════════════');
  });

  // ✅ Send renewal reminders - Run daily at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    logger.info('📬 Renewal Reminder Cron Job Started');
    await sendRenewalReminders();
  });

  // ✅ Check and mark expired subscriptions - Run daily at 2:00 AM
  // (This is now coordinated with auto-renewal job)
  cron.schedule('0 2 * * *', async () => {
    logger.info('🔍 Expired Subscription Check Started');
    await checkAndMarkExpiredSubscriptions();
  });

  logger.info('═══════════════════════════════════════');
  logger.info('✅ Auto-Renewal Jobs Initialized');
  logger.info('  • Auto-renewal check: Every 6 hours');
  logger.info('  • Renewal reminders: Daily at 8 AM');
  logger.info('  • Expired check: Daily at 2 AM');
  logger.info('═══════════════════════════════════════');
}

/**
 * ⚠️ IMPLEMENTATION NOTES & RECOMMENDATIONS
 * ═════════════════════════════════════════════
 * 
 * The current implementation creates renewal orders but does NOT automatically charge users.
 * To implement true auto-charging, choose one of these approaches:
 * 
 * OPTION 1: Razorpay Subscriptions API (RECOMMENDED)
 * ────────────────────────────────────────────────
 * - Use Razorpay's native subscription feature
 * - Customer authorizes recurring charges once during signup
 * - System automatically charges on schedule
 * - Built-in retry logic and failure handling
 * - Implementation: Use planId instead of orderId during payment
 * 
 * OPTION 2: Razorpay Customer Tokens (MEDIUM)
 * ────────────────────────────────────────────
 * - Store customer token from initial payment
 * - Use token to initiate charges periodically
 * - Requires additional Razorpay API integration
 * - Manual retry logic needed
 * - Implementation: POST /api/payments/create-payment with saved token
 * 
 * OPTION 3: Razorpay Recurring Payments (ADVANCED)
 * ────────────────────────────────────────────────
 * - Use saved payment method for automatic charges
 * - Most control and customization
 * - Complex error handling required
 * - Implementation: Custom payment processor
 * 
 * CURRENT LIMITATION:
 * ───────────────────
 * This implementation only creates orders and tracks renewal attempts.
 * For actual payment charging, you need to either:
 * 1. Add Razorpay token storage to the payment verification flow
 * 2. Migrate to Razorpay's Subscription API
 * 3. Use a third-party payment processor with native recurring support
 * 
 * NEXT STEPS:
 * ───────────
 * 1. Implement Razorpay vaults/tokens in verifyPayment()
 * 2. Create a new endpoint: POST /api/subscriptions/charge-renewal
 * 3. Update this job to call the charging endpoint
 * 4. Add comprehensive error handling and retry logic
 */

module.exports = {
  initAutoRenewalJob,
  processAutoRenewals,
  processSubscriptionRenewal,
  checkAndMarkExpiredSubscriptions,
  sendRenewalReminders
};
