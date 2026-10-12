const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const requireRole = require('../middlewares/requireRole');

const {
    createAnswerSet,
    getAnswerSets,
    updateAnswerSet,
    deleteAnswerSet,
} = require('../controllers/answerSetController');

router.post('/', verifyToken, requireRole('client_admin'), createAnswerSet);
router.get('/', verifyToken, requireRole('client_admin', 'platform_admin'), getAnswerSets);
router.patch('/:id', verifyToken, requireRole('client_admin'), updateAnswerSet);
router.delete('/:id', verifyToken, requireRole('client_admin', 'platform_admin'), deleteAnswerSet);

module.exports = router;
