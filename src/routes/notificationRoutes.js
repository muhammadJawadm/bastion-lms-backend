const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const {
    getNotifications,
    getNotificationSettings,
    updateNotificationSettings,
} = require('../controllers/notificationController');

// all self-scoped (req.user.id) — any role. Declared before nothing needs
// ":id" here, so no ordering concerns.
router.get('/', verifyToken, getNotifications);
router.get('/settings', verifyToken, getNotificationSettings);
router.patch('/settings', verifyToken, updateNotificationSettings);

module.exports = router;
