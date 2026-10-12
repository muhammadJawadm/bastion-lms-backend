const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const {
    createAnswerSet,
    getAnswerSets,
    updateAnswerSet,
    deleteAnswerSet,
} = require('../controllers/answerSetController');

router.post('/', verifyToken, createAnswerSet);
router.get('/', verifyToken, getAnswerSets);
router.patch('/:id', verifyToken, updateAnswerSet);
router.delete('/:id', verifyToken, deleteAnswerSet);

module.exports = router;
