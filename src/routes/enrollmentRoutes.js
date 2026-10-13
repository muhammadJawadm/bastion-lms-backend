const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const requireRole = require('../middlewares/requireRole');

const {
    getEnrollments,
    createEnrollment,
    getEnrollmentById,
    updateEnrollment,
    deleteEnrollment,
    getMyCourses,
    getMyCourseDetails,
} = require('../controllers/enrollmentController');

router.get('/', verifyToken, requireRole('client_admin', 'platform_admin'), getEnrollments);
router.post('/', verifyToken, requireRole('client_admin'), createEnrollment);

// mobile "My Courses" — declared before "/:id" so "my-courses" isn't swallowed as an enrollment id
router.get('/my-courses', verifyToken, requireRole('user'), getMyCourses);
router.get('/my-courses/:courseId', verifyToken, requireRole('user'), getMyCourseDetails);

// read/update: all three roles can reach these, ownership/company checks happen in the controller
// (platform_admin is view-only, so updateEnrollment 403s it there rather than at the route)
router.get('/:id', verifyToken, getEnrollmentById);
router.patch('/:id', verifyToken, requireRole('client_admin', 'user'), updateEnrollment);
router.delete('/:id', verifyToken, requireRole('client_admin', 'platform_admin'), deleteEnrollment);

module.exports = router;
