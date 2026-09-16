const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const { createEnrollment, updateEnrollment, deleteEnrollment } = require('../controllers/enrollmentController');

router.post('/', verifyToken, createEnrollment);
router.patch('/:id', verifyToken, updateEnrollment);
router.delete('/:id', verifyToken, deleteEnrollment);

module.exports = router;
