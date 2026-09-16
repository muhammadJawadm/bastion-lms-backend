const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const { addBlock, updateBlock } = require('../controllers/lessonController');

router.post('/:lessonId/blocks', verifyToken, addBlock);
router.patch('/:lessonId/blocks/:blockId', verifyToken, updateBlock);

module.exports = router;
