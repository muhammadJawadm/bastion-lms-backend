const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        default: null, // null for Bastion-owned / library assets
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    folder: {
        type: String,
        enum: [
            'course-covers',
            'lesson-media',
            'form-media',
            'signatures',
            'certificates',
            'avatars',
            'supporting-media',
        ],
        default: 'lesson-media',
    },
    storageKey: {
        type: String, // Cloudinary public_id — needed to delete/replace the asset later
        required: true,
    },
    url: {
        type: String, // Cloudinary secure_url — this is what every other model stores
        required: true,
    },
    resourceType: {
        type: String, // image | video | raw (Cloudinary's own classification)
    },
    filename: {
        type: String,
    },
    mimeType: {
        type: String,
    },
    sizeBytes: {
        type: Number,
    },
},
    { timestamps: true }
);

module.exports = mongoose.model('Upload', uploadSchema);
