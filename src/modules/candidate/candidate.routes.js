const express = require('express');
const { getProfile, updateProfile, uploadResume, deleteResume, getSavedJobs, saveJob, removeSavedJob } = require('./candidate.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const upload = require('../../middlewares/upload.middleware');

const router = express.Router();

router.use(protect);
router.use(authorize('candidate'));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);

router.post('/resume', upload.single('resume'), uploadResume);
router.delete('/resume/:resumeId', deleteResume);

router.post('/avatar', upload.single('avatar'), require('./candidate.controller').uploadAvatar);

// Saved Jobs
router.get('/saved-jobs', getSavedJobs);
router.post('/saved-jobs', saveJob);
router.delete('/saved-jobs/:jobId', removeSavedJob);

module.exports = router;
