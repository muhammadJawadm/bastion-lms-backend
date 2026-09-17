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

// Streams a buffer (from multer's memory storage) into Cloudinary without
// ever touching local disk.
const streamToCloudinary = (buffer, options) =>
    new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
        uploadStream.end(buffer);
    });

// POST /uploads   (multipart/form-data, field name: "file")
// Every other model just stores the resulting url string — this is the one
// place a real file actually gets sent to storage. Requires the `upload`
// multer middleware ahead of it in the route: upload.single('file').
exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded (expected multipart field 'file')" });
        }

        const { companyId, uploadedBy } = req.body;
        const folder = ALLOWED_FOLDERS.includes(req.body.folder) ? req.body.folder : "lesson-media";

        const result = await streamToCloudinary(req.file.buffer, {
            folder: `bastion-lms/${folder}`,
            resource_type: "auto", // let Cloudinary pick image / video / raw (pdf)
        });

        const upload = await Upload.create({
            companyId: companyId || null,
            uploadedBy: uploadedBy || null,
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
