const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const requireRole = require('../middlewares/requireRole');

const {
    getLessonById,
    updateLesson,
    deleteLesson,
    addBlock,
    updateBlock,
    deleteBlock,
    reorderBlocks,
    getChapterTopics,
} = require('../controllers/lessonController');

router.get('/:lessonId', verifyToken, requireRole('client_admin', 'platform_admin'), getLessonById);
router.patch('/:lessonId', verifyToken, requireRole('client_admin'), updateLesson);
router.delete('/:lessonId', verifyToken, requireRole('client_admin', 'platform_admin'), deleteLesson);

// "Chapter Topics" screen — the blocks of this lesson, scoped to the caller's own
// enrollment (any role may have personal enrollments, not just mobile "user").
router.get('/:lessonId/topics', verifyToken, requireRole('user', 'client_admin', 'platform_admin'), getChapterTopics);

router.post('/:lessonId/blocks', verifyToken, requireRole('client_admin'), addBlock);
router.post('/:lessonId/blocks/reorder', verifyToken, requireRole('client_admin'), reorderBlocks);
router.patch('/:lessonId/blocks/:blockId', verifyToken, requireRole('client_admin'), updateBlock);
router.delete('/:lessonId/blocks/:blockId', verifyToken, requireRole('client_admin'), deleteBlock);

module.exports = router;
