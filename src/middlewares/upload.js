const multer = require('multer');

// Memory storage — the file buffer goes straight into a Cloudinary upload
// stream (see uploadController), nothing is ever written to local disk.
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
    // images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // video
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
    // audio
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
    // documents
    'application/pdf',
];

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(null, true);
    }
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 200 * 1024 * 1024, // 200MB — generous for lesson video; tighten later if needed
    },
});

module.exports = upload;
