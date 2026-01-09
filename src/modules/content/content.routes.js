const express = require('express');
const { getAllContent, updateContent } = require('./content.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

// Public route to get content? 
// For now, focusing on Admin Management. The About Page might need a separate public route.
// Let's make GET protected for now as we are integrating Admin Panel.
// Actually, 'About' page exists in frontend... let's check if it needs API.
// Ideally, yes. But user request focuses on Admin features.

router.use(protect);
router.use(authorize('admin'));

router.get('/', getAllContent);
router.put('/', updateContent);

module.exports = router;
