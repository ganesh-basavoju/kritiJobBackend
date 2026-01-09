const express = require('express');
const { applyForJob, getMyApplications, getJobApplications, updateApplicationStatus } = require('./applications.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(protect);

router.post('/', authorize('candidate'), applyForJob);
router.get('/my-applications', authorize('candidate'), getMyApplications);

// Employer Routes
router.get('/employer/all', authorize('employer', 'admin'), require('./applications.controller').getCompanyApplications);

// Employer View Job Applications
router.get('/job/:jobId', authorize('employer', 'admin'), getJobApplications);

router.put('/:id/status', authorize('employer', 'admin'), updateApplicationStatus);

module.exports = router;
