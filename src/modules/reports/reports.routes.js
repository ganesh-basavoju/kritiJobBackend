const express = require('express');
const { getStats } = require('./reports.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getStats);
router.get('/activity', require('./reports.controller').getRecentActivity);
router.get('/growth', require('./reports.controller').getUserGrowth);

module.exports = router;
