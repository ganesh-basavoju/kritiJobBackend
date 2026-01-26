const express = require('express');
const { getJobs, getJob, createJob, updateJob, deleteJob, getMyJobs, searchJobs, getJobFeed } = require('./jobs.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.get('/', getJobs);
router.get('/feed', protect, authorize('candidate'), getJobFeed);
router.get('/my-jobs', protect, authorize('employer'), getMyJobs);
router.get('/:id', getJob);

// Protected routes
router.use(protect);

router.post('/', authorize('employer', 'admin'), createJob);
router.put('/:id', authorize('employer', 'admin'), updateJob);
router.delete('/:id', authorize('employer', 'admin'), deleteJob);

module.exports = router;
