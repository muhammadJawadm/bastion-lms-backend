const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const requireRole = require('../middlewares/requireRole');

const {
    createCourse,
    createCourseSetting,
    getCourses,
    getCourseDetails,
    getCourseLibrary,
    addToCompany,
    deleteCourse,
} = require('../controllers/courseController');
const { createLesson } = require('../controllers/lessonController');
const { addModule, getModules } = require('../controllers/moduleController');

// Builder writes are client_admin-only; reads are open to client_admin + platform_admin
// (platform_admin is view-only + delete, per the role matrix — never create/update here).
// "user" (mobile) never touches the builder at all — it reads via /enrollments/my-courses.
router.post('/', verifyToken, requireRole('client_admin'), createCourse);
router.get('/', verifyToken, requireRole('client_admin', 'platform_admin'), getCourses);
router.patch('/settings', verifyToken, requireRole('client_admin'), createCourseSetting); // courseId comes from the body

// Course Library — declared before "/:courseId" so "library" isn't swallowed as a course id
router.get('/library', verifyToken, requireRole('client_admin', 'platform_admin'), getCourseLibrary);
router.post('/library/:id/add-to-company', verifyToken, requireRole('client_admin'), addToCompany);

// lesson creation lives under its parent course
router.post('/:courseId/lessons', verifyToken, requireRole('client_admin'), createLesson);

// modules are embedded on the course (Course.modules) — add/list lives here,
// update/delete lives in moduleRoutes since those don't need the courseId
router.post('/:courseId/modules', verifyToken, requireRole('client_admin'), addModule);
router.get('/:courseId/modules', verifyToken, requireRole('client_admin', 'platform_admin'), getModules);

// full course detail (course + lessons + pages) — mobile course screen
router.get('/:courseId', verifyToken, requireRole('client_admin', 'platform_admin'), getCourseDetails);
router.delete('/:courseId', verifyToken, requireRole('client_admin', 'platform_admin'), deleteCourse);

module.exports = router;
