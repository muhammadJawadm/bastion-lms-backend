const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const requireRole = require('../middlewares/requireRole');

const {
    getCompanyProfile,
    updateCompanyProfile,
    updateBranding,
    updateNotificationPreferences,
    getDashboardStats,
} = require('../controllers/companyController');

router.get('/:companyId', verifyToken, getCompanyProfile); // all roles; controller enforces own-company for client_admin/user
router.patch('/:companyId/profile', verifyToken, requireRole('client_admin'), updateCompanyProfile);
router.patch('/:companyId/branding', verifyToken, requireRole('client_admin'), updateBranding);
router.patch('/:companyId/notifications', verifyToken, requireRole('client_admin'), updateNotificationPreferences);
router.get('/:companyId/dashboard', verifyToken, requireRole('client_admin', 'platform_admin'), getDashboardStats);

module.exports = router;
