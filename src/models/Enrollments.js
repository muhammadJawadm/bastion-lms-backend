const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({    
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
    },
    status: {
        type: String,
        enum: ['assigned', 'completed', 'overdue', 'in_progress', "waived"],
        default: 'assigned',
    },
    progressPct: {
        type: Number,
        default: 0,    
    },
    dueDate: {
        type: Date,
        default: null,
    },
    completionAt: {
        type: Date,
        default: null,
    },
}, 
    {                
    timestamps: true    ,
    }
);

module.exports = mongoose.model('Enrollment', enrollmentSchema);