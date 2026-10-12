const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const {
    createEnrollment,
    getEnrollmentById,
    updateEnrollment,
    deleteEnrollment,
    getMyCourses,
    getMyCourseDetails,
} = require('../controllers/enrollmentController');

router.post('/', verifyToken, createEnrollment);

// mobile "My Courses" — declared before "/:id" so "my-courses" isn't swallowed as an enrollment id
router.get('/my-courses', verifyToken, getMyCourses);
router.get('/my-courses/:courseId', verifyToken, getMyCourseDetails);

router.get('/:id', verifyToken, getEnrollmentById);
router.patch('/:id', verifyToken, updateEnrollment);
router.delete('/:id', verifyToken, deleteEnrollment);

module.exports = router;
