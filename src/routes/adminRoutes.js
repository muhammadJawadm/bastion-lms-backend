const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const requireRole = require('../middlewares/requireRole');

const { getAllCompanies, getAllUsers, getAllCourses, getAllForms } = require('../controllers/adminController');

router.get('/companies', verifyToken, requireRole('platform_admin'), getAllCompanies);
router.get('/users', verifyToken, requireRole('platform_admin'), getAllUsers);
router.get('/courses', verifyToken, requireRole('platform_admin'), getAllCourses);
router.get('/forms', verifyToken, requireRole('platform_admin'), getAllForms);

module.exports = router;
