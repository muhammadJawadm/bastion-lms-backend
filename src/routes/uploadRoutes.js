const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const upload = require('../middlewares/upload');

const {
    uploadFile,
    getUploadSignature,
    confirmUpload,
    getUploads,
    getUploadById,
    deleteUpload,
} = require('../controllers/uploadController');

// signed direct-to-Cloudinary flow — for large files (video especially),
// so the bytes never pass through this server. Declared before "/:id" so
// "signature" isn't swallowed as an upload id.
router.get('/signature', verifyToken, getUploadSignature);
router.post('/confirm', verifyToken, confirmUpload);

// proxy path — fine for images/PDFs/avatars/signatures/short clips.
// multipart/form-data, field name "file" — upload.single must run before
// the controller so multer has parsed req.file by the time uploadFile runs.
router.post('/', verifyToken, upload.single('file'), uploadFile);

router.get('/', verifyToken, getUploads);
router.get('/:id', verifyToken, getUploadById);
router.delete('/:id', verifyToken, deleteUpload);

module.exports = router;
