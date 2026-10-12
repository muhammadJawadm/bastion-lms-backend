const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const { updateModule, deleteModule } = require('../controllers/moduleController');

router.patch('/:moduleId', verifyToken, updateModule);
router.delete('/:moduleId', verifyToken, deleteModule);

module.exports = router;
