const cron = require('node-cron');
const Job = require('../models/Job');

const initCronJobs = () => {
  // Run every hour at minute 0
  // '0 * * * *'
  cron.schedule('0 * * * *', async () => {
    console.log('Running Cron: Checking for expired jobs...');
    try {
      const now = new Date();
      
      const result = await Job.updateMany(
        { 
          status: 'Open', 
          applicationDeadline: { $lt: now } 
        },
        { 
          $set: { status: 'Closed' } 
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`Cron: Closed ${result.modifiedCount} expired jobs.`);
      }
    } catch (error) {
      console.error('Cron Error:', error);
    }
  });

  console.log('Cron jobs initialized.');
};

module.exports = initCronJobs;
