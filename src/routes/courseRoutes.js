const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const { createCourse, createCourseSetting } = require('../controllers/courseController');
const { createLesson } = require('../controllers/lessonController');

router.post('/', verifyToken, createCourse);
router.patch('/settings', verifyToken, createCourseSetting); // courseId comes from the body

// lesson creation lives under its parent course
router.post('/:courseId/lessons', verifyToken, createLesson);

module.exports = router;
