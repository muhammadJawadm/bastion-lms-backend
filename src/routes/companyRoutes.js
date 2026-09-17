const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const {
    getCompanyProfile,
    updateCompanyProfile,
    updateBranding,
    updateNotificationPreferences,
    getDashboardStats,
} = require('../controllers/companyController');

router.get('/:companyId', verifyToken, getCompanyProfile);
router.patch('/:companyId/profile', verifyToken, updateCompanyProfile);
router.patch('/:companyId/branding', verifyToken, updateBranding);
router.patch('/:companyId/notifications', verifyToken, updateNotificationPreferences);
router.get('/:companyId/dashboard', verifyToken, getDashboardStats);

module.exports = router;
