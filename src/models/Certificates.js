const  mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
    },
    enrollmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Enrollment',
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
    },
    certificateTitle: {
        type: String,
        required: true,
    },
    certificateNumber: {
        type: String,
        required: true,
    },
    score: {
        type: Number,
        default: 0,
    },
    issuedAt: {
        type: Date,
        default: null,
    },
    expiresAt: {
        type: Date,
        default: null,
    },
    pdfUrl: {
        type: String,
        default: null,
    },
}, 
    {                
    timestamps: true    ,
    }
);

module.exports = mongoose.model('Certificate', certificateSchema);