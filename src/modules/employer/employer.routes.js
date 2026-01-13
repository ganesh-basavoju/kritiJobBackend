const express = require('express');
const { searchCandidates, getCandidateById } = require('./employer.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

// All routes are protected and employer only
router.use(protect);
router.use(authorize('employer'));

router.get('/candidates', searchCandidates);
router.get('/candidates/:id', getCandidateById);

module.exports = router;
