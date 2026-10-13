const cloudinary = require("../config/cloudinary");
const Upload = require("../models/Upload");

const ALLOWED_FOLDERS = [
    "course-covers",
    "lesson-media",
    "form-media",
    "signatures",
    "certificates",
    "avatars",
    "supporting-media",
];

// Multer's limit (middlewares/upload.js) is one flat ceiling for every
// mimetype; this is the real, type-aware check applied after the file lands.
const TYPE_SIZE_LIMITS = {
    video: 500 * 1024 * 1024, // 500MB — proxy path; bigger than this, use the signed direct-upload flow
    default: 25 * 1024 * 1024, // 25MB — images, PDFs, audio, avatars, signatures
};

const maxBytesFor = (mimetype) =>
    mimetype.startsWith("video/") ? TYPE_SIZE_LIMITS.video : TYPE_SIZE_LIMITS.default;

// Streams a buffer (from multer's memory storage) into Cloudinary without
// ever touching local disk. upload_large_stream chunks the transfer
// (Cloudinary's recommended path for anything sizeable, video especially),
// rather than sending it as one giant request.
const streamToCloudinary = (buffer, options) =>
    new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_large_stream(options, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
        uploadStream.end(buffer);
    });

// POST /uploads   (multipart/form-data, field name: "file")
// The proxy path — client -> this server -> Cloudinary. Fine for images,
// PDFs, avatars, signatures, short clips. For large video, use
// GET /uploads/signature + POST /uploads/confirm instead (file bytes never
// touch this server that way).
exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded (expected multipart field 'file')" });
        }

        const maxBytes = maxBytesFor(req.file.mimetype);
        if (req.file.size > maxBytes) {
            return res.status(400).json({
                message: `File too large for this type — max ${Math.round(maxBytes / (1024 * 1024))}MB over this endpoint. For larger files, use GET /uploads/signature to upload directly to Cloudinary instead.`,
            });
        }

        const { uploadedBy } = req.body;
        const companyId = req.user.role === "platform_admin" ? (req.body.companyId || null) : req.user.companyId;
        const folder = ALLOWED_FOLDERS.includes(req.body.folder) ? req.body.folder : "lesson-media";

        const result = await streamToCloudinary(req.file.buffer, {
            folder: `bastion-lms/${folder}`,
            resource_type: "auto", // let Cloudinary pick image / video / raw (pdf)
        });

        const upload = await Upload.create({
            companyId,
            uploadedBy: uploadedBy || req.user.id,
            folder,
            storageKey: result.public_id,
            url: result.secure_url,
            resourceType: result.resource_type,
            filename: req.file.originalname,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
        });

        res.status(201).json({
            success: true,
            message: "File uploaded successfully",
            url: upload.url,
            id: upload._id,
            data: upload,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Server error" });
    }
};

// GET /uploads/signature?folder=lesson-media
// Hands the frontend what it needs to upload STRAIGHT to Cloudinary — the
// file bytes never pass through this server, so there's no body-size limit,
// no request timeout, no RAM buffering to worry about. This is the path for
// lesson videos and anything else that can be large.
//
// Frontend usage: POST multipart/form-data directly to
// https://api.cloudinary.com/v1_1/<cloudName>/auto/upload with fields
// file, api_key, timestamp, signature, folder (exactly as returned here).
// Cloudinary's own upload widget/SDK handles chunked/resumable transfer for
// big files automatically when given these signed params. Once Cloudinary
// responds with the result, call POST /uploads/confirm with it.
exports.getUploadSignature = (req, res) => {
    try {
        const folder = ALLOWED_FOLDERS.includes(req.query.folder) ? req.query.folder : "lesson-media";
        const fullFolder = `bastion-lms/${folder}`;
        const timestamp = Math.round(Date.now() / 1000);

        const signature = cloudinary.utils.api_sign_request(
            { timestamp, folder: fullFolder },
            process.env.CLOUDINARY_API_SECRET
        );

        res.status(200).json({
            success: true,
            data: {
                cloudName: process.env.CLOUDINARY_CLOUD_NAME,
                apiKey: process.env.CLOUDINARY_API_KEY,
                timestamp,
                signature,
                folder: fullFolder,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /uploads/confirm
// After a direct-to-Cloudinary upload (see getUploadSignature), the
// frontend reports back what Cloudinary returned so it's recorded the same
// way a proxied upload is. The file already lives in Cloudinary under our
// signed folder by this point — this just persists the metadata.
exports.confirmUpload = async (req, res) => {
    try {
        const { publicId, url, resourceType, folder, filename, mimeType, sizeBytes } = req.body;
        if (!publicId || !url) {
            return res.status(400).json({ message: "publicId and url are required" });
        }

        const companyId = req.user.role === "platform_admin" ? (req.body.companyId || null) : req.user.companyId;

        const upload = await Upload.create({
            companyId,
            uploadedBy: req.user.id,
            folder: ALLOWED_FOLDERS.includes(folder) ? folder : "lesson-media",
            storageKey: publicId,
            url,
            resourceType: resourceType || null,
            filename: filename || null,
            mimeType: mimeType || null,
            sizeBytes: sizeBytes || null,
        });

        res.status(201).json({
            success: true,
            message: "Upload recorded successfully",
            url: upload.url,
            id: upload._id,
            data: upload,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /uploads?companyId=&folder=
exports.getUploads = async (req, res) => {
    try {
        let companyId = req.query.companyId;
        if (req.user.role !== "platform_admin") companyId = req.user.companyId;

        const filter = {};
        if (companyId) filter.companyId = companyId;
        if (req.query.folder && ALLOWED_FOLDERS.includes(req.query.folder)) filter.folder = req.query.folder;

        const uploads = await Upload.find(filter).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: uploads });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /uploads/:id
exports.getUploadById = async (req, res) => {
    try {
        const upload = await Upload.findById(req.params.id);
        if (!upload) {
            return res.status(404).json({ message: "Upload not found" });
        }
        if (req.user.role === "client_admin" && String(upload.companyId) !== String(req.user.companyId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (req.user.role === "user" && String(upload.uploadedBy) !== String(req.user.id)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        res.status(200).json({ success: true, data: upload });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /uploads/:id
// Removes the asset from Cloudinary AND its record here — without this,
// replacing a lesson's video just orphans the old file forever.
exports.deleteUpload = async (req, res) => {
    try {
        const upload = await Upload.findById(req.params.id);
        if (!upload) {
            return res.status(404).json({ message: "Upload not found" });
        }

        const isOwner = String(upload.uploadedBy) === String(req.user.id);
        if (!isOwner) {
            if (req.user.role === "user") {
                return res.status(403).json({ message: "Forbidden" });
            }
            if (req.user.role === "client_admin" && String(upload.companyId) !== String(req.user.companyId)) {
                return res.status(403).json({ message: "Forbidden" });
            }
            // platform_admin can delete any upload
        }

        await cloudinary.uploader.destroy(upload.storageKey, { resource_type: upload.resourceType || "image" });
        await Upload.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, message: "Upload deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Server error" });
    }
};
