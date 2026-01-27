const { getMessaging } = require('../config/firebase');
const DeviceToken = require('../models/DeviceToken');
const Notification = require('../models/Notification');
const logger = require('../config/logger');

/**
 * Notification Service
 * Handles all push notification operations using Firebase Admin SDK
 */
class NotificationService {
  /**
   * Send push notification to a single user
   * @param {String} userId - User ID to send notification to
   * @param {Object} notification - Notification payload
   * @returns {Promise<Object>} Result of the operation
   */
  async sendToUser(userId, notification) {
    try {
      const { title, body, type, data = {}, actionScreen, actionData = {} } = notification;

      // Get active FCM tokens for the user
      const deviceTokens = await DeviceToken.findActiveTokensForUser(userId);

      if (!deviceTokens || deviceTokens.length === 0) {
        logger.warn(`No active device tokens found for user: ${userId}`);
        return { success: false, message: 'No active tokens' };
      }

      // Create notification record in database
      const notificationRecord = await Notification.create({
        userId,
        type,
        title,
        body,
        data,
        actionScreen,
        actionData,
        sent: false
      });

      // Extract FCM tokens
      const tokens = deviceTokens.map(dt => dt.fcmToken);

      // Prepare FCM message payload
      const message = {
        notification: {
          title,
          body
        },
        data: {
          notificationId: notificationRecord._id.toString(),
          type,
          screen: actionScreen || '',
          ...this._convertDataToStrings(actionData)
        },
        tokens
      };

      // Send via FCM
      const response = await getMessaging().sendEachForMulticast(message);

      // Handle results
      const invalidTokens = [];
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            logger.error(`Failed to send to token: ${tokens[idx]}, error: ${resp.error?.message}`);
            
            // Check for invalid token errors
            if (this._isInvalidTokenError(resp.error)) {
              invalidTokens.push(tokens[idx]);
            }
          }
        });

        // Remove invalid tokens
        if (invalidTokens.length > 0) {
          await DeviceToken.removeInvalidTokens(invalidTokens);
          logger.info(`Removed ${invalidTokens.length} invalid tokens`);
        }
      }

      // Mark notification as sent
      await notificationRecord.markAsSent();

      logger.info(`Notification sent to user ${userId}: ${response.successCount}/${tokens.length} succeeded`);

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        notificationId: notificationRecord._id
      };
    } catch (error) {
      logger.error(`Error sending notification to user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send push notification to multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} notification - Notification payload
   * @returns {Promise<Object>} Result of the operation
   */
  async sendToMultipleUsers(userIds, notification) {
    try {
      const results = await Promise.allSettled(
        userIds.map(userId => this.sendToUser(userId, notification))
      );

      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failureCount = results.length - successCount;

      logger.info(`Bulk notification sent: ${successCount}/${userIds.length} users succeeded`);

      return { success: true, successCount, failureCount };
    } catch (error) {
      logger.error(`Error sending bulk notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notification to all users with a specific role
   * @param {String} role - Role to target (candidate/employer/admin)
   * @param {Object} notification - Notification payload
   * @param {Array} excludeUserIds - User IDs to exclude
   * @returns {Promise<Object>} Result of the operation
   */
  async sendToRole(role, notification, excludeUserIds = []) {
    try {
      const deviceTokens = await DeviceToken.findActiveTokensByRole(role, excludeUserIds);

      if (!deviceTokens || deviceTokens.length === 0) {
        logger.warn(`No active device tokens found for role: ${role}`);
        return { success: false, message: 'No active tokens' };
      }

      // Group by userId to avoid duplicate notifications
      const userIds = [...new Set(deviceTokens.map(dt => dt.userId.toString()))];

      return await this.sendToMultipleUsers(userIds, notification);
    } catch (error) {
      logger.error(`Error sending notification to role ${role}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notification about new job to relevant candidates
   * @param {Object} job - Job object
   * @returns {Promise<Object>} Result of the operation
   */
  async sendNewJobAlert(job) {
    try {
      const notification = {
        title: 'New Job Alert! 🎯',
        body: `${job.title} at ${job.companyId?.name || 'a company'} in ${job.location}`,
        type: 'job_alert',
        actionScreen: 'JobDetails',
        actionData: {
          jobId: job._id.toString()
        }
      };

      // Send to all active candidates (you can add filtering logic based on preferences)
      return await this.sendToRole('candidate', notification, [job.employerId.toString()]);
    } catch (error) {
      logger.error(`Error sending new job alert: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notification about application status change
   * @param {Object} application - Application object
   * @param {String} previousStatus - Previous status
   * @returns {Promise<Object>} Result of the operation
   */
  async sendApplicationStatusUpdate(application, previousStatus) {
    try {
      const statusMessages = {
        'Reviewing': 'Your application is being reviewed 📋',
        'Interviewing': 'You have been shortlisted for interview! 🎉',
        'Selected': 'Congratulations! You have been selected! 🎊',
        'Rejected': 'Application status updated'
      };

      const notification = {
        title: 'Application Status Update',
        body: statusMessages[application.status] || 'Your application status has been updated',
        type: 'application_status',
        actionScreen: 'ApplicationDetails',
        actionData: {
          applicationId: application._id.toString(),
          jobId: application.jobId.toString(),
          status: application.status
        }
      };

      return await this.sendToUser(application.candidateId.toString(), notification);
    } catch (error) {
      logger.error(`Error sending application status update: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notification about new applicant to employer
   * @param {Object} application - Application object
   * @param {Object} job - Job object
   * @param {Object} candidate - Candidate user object
   * @returns {Promise<Object>} Result of the operation
   */
  async sendNewApplicantAlert(application, job, candidate) {
    try {
      const notification = {
        title: 'New Applicant! 👤',
        body: `${candidate.name} applied for ${job.title}`,
        type: 'new_applicant',
        actionScreen: 'ApplicantDetails',
        actionData: {
          applicationId: application._id.toString(),
          jobId: job._id.toString(),
          candidateId: candidate._id.toString()
        }
      };

      return await this.sendToUser(application.employerId.toString(), notification);
    } catch (error) {
      logger.error(`Error sending new applicant alert: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper: Convert data object to strings (FCM requirement)
   */
  _convertDataToStrings(data) {
    const stringData = {};
    for (const [key, value] of Object.entries(data)) {
      stringData[key] = value?.toString() || '';
    }
    return stringData;
  }

  /**
   * Helper: Check if error is due to invalid token
   */
  _isInvalidTokenError(error) {
    if (!error) return false;
    
    const invalidTokenCodes = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument'
    ];
    
    return invalidTokenCodes.includes(error.code);
  }
}

module.exports = new NotificationService();
