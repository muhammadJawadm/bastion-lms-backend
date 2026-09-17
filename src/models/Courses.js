const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,    
    },
    category: {
        type: String,    
    },    
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft',
    },
    durationMinutes: {
        type: String,
    },
    certificateTitle:{
        type: String,
    },
    coverImageUrl: {
        type: String,
        default: null,
    },
    passScore: {
        type: String,
    },
    isDemo: {
        type: Boolean,
        default: false,
    },
    issuesCertificate: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    sourceLibraryCourseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        default: null,
    },
    modules: [{
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,    
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
    }],
},
 {                
    timestamps: true    ,
});

module.exports = mongoose.model('Course', courseSchema);