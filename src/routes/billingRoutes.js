const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const requireRole = require('../middlewares/requireRole');

const {
    createPlan,
    getPlans,
    updatePlan,
    deletePlan,
    createCheckoutSession,
    confirmCheckoutSession,
    createPortalSession,
    getMyBilling,
    getMyInvoices,
    getMyPaymentMethods,
    cancelMySubscription,
    getAllTenantBilling,
    getTenantBillingByCompany,
    setGracePeriod,
    adminCancelSubscription,
} = require('../controllers/billingController');

// Plan catalog — platform_admin manages it, both admin roles can read it
// (client_admin needs the list to pick a plan to subscribe to).
router.post('/plans', verifyToken, requireRole('platform_admin'), createPlan);
router.get('/plans', verifyToken, requireRole('platform_admin', 'client_admin'), getPlans);
router.patch('/plans/:planId', verifyToken, requireRole('platform_admin'), updatePlan);
router.delete('/plans/:planId', verifyToken, requireRole('platform_admin'), deletePlan);

// client_admin — own-company billing only, scoped via req.user.companyId
router.post('/checkout-session', verifyToken, requireRole('client_admin'), createCheckoutSession);
router.get('/confirm/:sessionId', verifyToken, requireRole('client_admin'), confirmCheckoutSession);
router.post('/portal-session', verifyToken, requireRole('client_admin'), createPortalSession);
router.get('/me', verifyToken, requireRole('client_admin'), getMyBilling);
router.get('/me/invoices', verifyToken, requireRole('client_admin'), getMyInvoices);
router.get('/me/payment-methods', verifyToken, requireRole('client_admin'), getMyPaymentMethods);
router.post('/cancel', verifyToken, requireRole('client_admin'), cancelMySubscription);

// platform_admin — cross-company billing oversight
router.get('/tenants', verifyToken, requireRole('platform_admin'), getAllTenantBilling);
router.get('/tenants/:companyId', verifyToken, requireRole('platform_admin'), getTenantBillingByCompany);
router.post('/tenants/:companyId/grace-period', verifyToken, requireRole('platform_admin'), setGracePeriod);
router.post('/tenants/:companyId/cancel', verifyToken, requireRole('platform_admin'), adminCancelSubscription);

module.exports = router;
