const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const requireRole = require('../middlewares/requireRole');

const { updateModule, deleteModule } = require('../controllers/moduleController');

router.patch('/:moduleId', verifyToken, requireRole('client_admin'), updateModule);
router.delete('/:moduleId', verifyToken, requireRole('client_admin', 'platform_admin'), deleteModule);

module.exports = router;
