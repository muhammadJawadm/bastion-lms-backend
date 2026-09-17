const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const {
    getLessonById,
    updateLesson,
    addBlock,
    updateBlock,
    reorderBlocks,
} = require('../controllers/lessonController');

router.get('/:lessonId', verifyToken, getLessonById);
router.patch('/:lessonId', verifyToken, updateLesson);

router.post('/:lessonId/blocks', verifyToken, addBlock);
router.post('/:lessonId/blocks/reorder', verifyToken, reorderBlocks);
router.patch('/:lessonId/blocks/:blockId', verifyToken, updateBlock);

module.exports = router;
