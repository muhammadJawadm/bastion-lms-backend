const multer = require('multer');

// Memory storage — the file buffer goes straight into a Cloudinary upload
// stream (see uploadController), nothing is ever written to local disk.
// This proxy path is for small/medium files (images, PDFs, avatars,
// signatures, short clips). Anything large — especially video — should use
// the signed direct-to-Cloudinary flow instead (GET /uploads/signature),
// which never puts the file bytes through this server at all.
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
        // the hard ceiling multer itself enforces, before the file is even
        // read — set to the video limit since multer can't tell mimetypes
        // apart at this layer; uploadController applies the tighter,
        // type-aware limit (see TYPE_SIZE_LIMITS) after the file lands.
        fileSize: 500 * 1024 * 1024, // 500MB
    },
});

module.exports = upload;
