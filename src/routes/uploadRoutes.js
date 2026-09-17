const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const upload = require('../middlewares/upload');

const { uploadFile } = require('../controllers/uploadController');

// multipart/form-data, field name "file" — must run before the controller
// so multer has parsed req.file by the time uploadFile runs.
router.post('/', verifyToken, upload.single('file'), uploadFile);

module.exports = router;
