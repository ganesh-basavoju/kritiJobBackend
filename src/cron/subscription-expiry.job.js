/**
 * Subscription Expiry Cron Job
 * 
 * Checks for expired subscriptions and updates candidate profiles
 * Runs daily at 2:00 AM
 */

const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const CandidateProfile = require('../models/CandidateProfile');
const Company = require('../models/Company');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Check and update expired subscriptions
 */
async function checkExpiredSubscriptions() {
  try {
    logger.info('Running subscription expiry check...');

    // Find all active subscriptions that have expired
    const expiredSubscriptions = await Subscription.find({
      status: 'active',
      endDate: { $lt: new Date() }
    });

    logger.info(`Found ${expiredSubscriptions.length} expired subscriptions`);

    // Update each expired subscription
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
              `Removed premium status for candidate ${subscription.candidateId}`
            );
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
              `Removed premium status for employer ${subscription.candidateId}`
            );
          }
        }
      } catch (error) {
        logger.error(
          `Error updating subscription ${subscription._id}:`,
          error.message
        );
      }
    }

    logger.info('Subscription expiry check completed');
  } catch (error) {
    logger.error('Subscription expiry check failed:', error);
  }
}

/**
 * Initialize cron job
 * Runs daily at 2:00 AM
 */
function initSubscriptionExpiryJob() {
  // Schedule: Run at 2:00 AM every day
  cron.schedule('0 2 * * *', async () => {
    await checkExpiredSubscriptions();
  });

  logger.info('Subscription expiry cron job initialized (runs daily at 2 AM)');
}

module.exports = {
  initSubscriptionExpiryJob,
  checkExpiredSubscriptions // Export for manual testing
};
