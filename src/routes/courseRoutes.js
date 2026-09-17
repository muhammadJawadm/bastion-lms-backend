const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const {
    createCourse,
    createCourseSetting,
    getCourses,
    getCourseDetails,
    getCourseLibrary,
    addToCompany,
} = require('../controllers/courseController');
const { createLesson } = require('../controllers/lessonController');

router.post('/', verifyToken, createCourse);
router.get('/', verifyToken, getCourses); // company-scoped Courses list page
router.patch('/settings', verifyToken, createCourseSetting); // courseId comes from the body

// Course Library — declared before "/:courseId" so "library" isn't swallowed as a course id
router.get('/library', verifyToken, getCourseLibrary);
router.post('/library/:id/add-to-company', verifyToken, addToCompany);

// lesson creation lives under its parent course
router.post('/:courseId/lessons', verifyToken, createLesson);

// full course detail (course + lessons + pages) — mobile course screen
router.get('/:courseId', verifyToken, getCourseDetails);

module.exports = router;
