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
    createCompany,
    updateCompany,
    deleteCompany,
} = require('../controllers/companyController');

// platform_admin-only direct CRUD on the company record itself
router.post('/', verifyToken, requireRole('platform_admin'), createCompany);
router.patch('/:companyId', verifyToken, requireRole('platform_admin'), updateCompany);
router.delete('/:companyId', verifyToken, requireRole('platform_admin'), deleteCompany);

router.get('/:companyId', verifyToken, getCompanyProfile); // all roles; controller enforces own-company for client_admin/user
router.patch('/:companyId/profile', verifyToken, requireRole('client_admin'), updateCompanyProfile);
router.patch('/:companyId/branding', verifyToken, requireRole('client_admin'), updateBranding);
router.patch('/:companyId/notifications', verifyToken, requireRole('client_admin'), updateNotificationPreferences);
router.get('/:companyId/dashboard', verifyToken, requireRole('client_admin', 'platform_admin'), getDashboardStats);

module.exports = router;
