const cron = require('node-cron');
const Job = require('../models/Job');
const logger = require('../config/logger');

const runCronJobs = () => {
    // Run every day at midnight
    cron.schedule('0 0 * * *', async () => {
        logger.info('Running cron job: Auto-close expired jobs');
        
        try {
            // Find jobs posted more than 30 days ago (EXAMPLE POLICY)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const result = await Job.updateMany(
                { status: 'Open', postedAt: { $lt: thirtyDaysAgo } },
                { $set: { status: 'Closed' } }
            );

            logger.info(`Closed ${result.modifiedCount} expired jobs.`);
        } catch (err) {
            logger.error(`Cron Job Error: ${err.message}`);
        }
    });

    // Run every Sunday at midnight to clean logs (Optional/Placeholder)
    cron.schedule('0 0 * * 0', () => {
        logger.info('Running cron job: System cleanup');
        // Logic to archive logs or old notifications
    });
};

module.exports = runCronJobs;
