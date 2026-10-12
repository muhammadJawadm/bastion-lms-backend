const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,    
        ref: 'Course',    
    },
    moduleId: {
        type: mongoose.Schema.Types.ObjectId,    
        ref: 'Module',    
    },
    title: {
        type: String,
        required: true,
    },
    // type: {
    //     type: String,
    //     enum: ['video_embed', 'text', 'quiz', 'pdf', 'image', 'video_upload', 'resource','slides'],    
    //     default:"text",
    // },
    durationMinutes: {
        type: String,
    },
    isRequired: {
        type: Boolean,
        default: true,
    },
    sortOrder: {
        type: Number,
        default: 0,
    },
    blocks:[{
        type: {
            type: String,
            default:"text",
        },
        // separate from data (which stays opaque/type-specific) so "topic
        // title" is always readable the same way regardless of block type
        title: {
            type: String,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
        }],
    chapters: [{
       title: {
            type: String,
        },
        sortOrder : {
            type: Number,
            default: 0, 
        }
        }],
    
},
 { timestamps: true }
);

module.exports = mongoose.model('Lesson', lessonSchema);