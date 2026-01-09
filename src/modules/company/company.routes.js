const express = require('express');
const { createCompany, getCompany, updateCompany, getMyCompany, getCompanies } = require('./company.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const upload = require('../../middlewares/upload.middleware');

const router = express.Router();

router.get('/me', protect, getMyCompany); 
router.get('/', getCompanies);
router.get('/:id', getCompany);

// Protected routes
// Protected routes (Login required)
router.use(protect);

// Employer/Admin only (Explicitly applied to routes)
router.post('/', authorize('employer', 'admin'), upload.single('logo'), createCompany);
router.put('/:id', authorize('employer', 'admin'), upload.single('logo'), updateCompany);

module.exports = router;
