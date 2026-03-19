const express = require('express');
const { getJobs, getJob, createJob, updateJob, deleteJob, getMyJobs, searchJobs, getJobFeed, toggleJobVisibility } = require('./jobs.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

// Public routes
router.get('/', getJobs);

// Protected routes for candidates
router.get('/feed', protect, authorize('candidate'), getJobFeed);

// Protected routes for employers
router.get('/my-jobs', protect, authorize('employer'), getMyJobs);

// Public job details route must be after static paths like /feed and /my-jobs
router.get('/:id', getJob);

// Protected routes
router.use(protect);

router.post('/', authorize('employer', 'admin'), createJob);
router.put('/:id', authorize('employer', 'admin'), updateJob);
router.put('/:id/toggle-visibility', authorize('employer', 'admin'), toggleJobVisibility);
router.delete('/:id', authorize('employer', 'admin'), deleteJob);

module.exports = router;
