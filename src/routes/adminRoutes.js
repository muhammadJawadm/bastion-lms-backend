const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const { getAllCompanies, getAllUsers, getAllCourses, getAllForms } = require('../controllers/adminController');

// role check (platform_admin only) happens inside each controller function,
// since there's no role-checking middleware yet — verifyToken just confirms
// there's a valid logged-in user at all.
router.get('/companies', verifyToken, getAllCompanies);
router.get('/users', verifyToken, getAllUsers);
router.get('/courses', verifyToken, getAllCourses);
router.get('/forms', verifyToken, getAllForms);

module.exports = router;
