const express = require('express');
const router = express.Router();

// Import Routes
const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/users/users.routes');
const jobRoutes = require('../modules/jobs/jobs.routes');
const applicationRoutes = require('../modules/applications/applications.routes');
const companyRoutes = require('../modules/company/company.routes');
const candidateRoutes = require('../modules/candidate/candidate.routes');
const chatRoutes = require('../modules/chat/chat.routes');
const notificationRoutes = require('../modules/notifications/notifications.routes');
// const adminRoutes = require('../modules/admin/admin.routes');
const reportRoutes = require('../modules/reports/reports.routes');
const contentRoutes = require('../modules/content/content.routes');

// Mount Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/jobs', jobRoutes);
router.use('/applications', applicationRoutes);
router.use('/company', companyRoutes);
router.use('/candidate', candidateRoutes);
router.use('/chat', chatRoutes);
router.use('/notifications', notificationRoutes);
// router.use('/admin', adminRoutes);
router.use('/reports', reportRoutes);
router.use('/content', contentRoutes);

module.exports = router;
