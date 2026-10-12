const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const {
    getLessonById,
    updateLesson,
    addBlock,
    updateBlock,
    reorderBlocks,
    getChapterTopics,
} = require('../controllers/lessonController');

router.get('/:lessonId', verifyToken, getLessonById);
router.patch('/:lessonId', verifyToken, updateLesson);

// mobile "Chapter Topics" screen — the blocks of this lesson, scoped to the caller's enrollment
router.get('/:lessonId/topics', verifyToken, getChapterTopics);

router.post('/:lessonId/blocks', verifyToken, addBlock);
router.post('/:lessonId/blocks/reorder', verifyToken, reorderBlocks);
router.patch('/:lessonId/blocks/:blockId', verifyToken, updateBlock);

module.exports = router;
