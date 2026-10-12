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
    // which of the course's lessons ("chapters" on the mobile side) this user
    // has finished — drives Course Details' isCompleted/currentChapter.
    completedLessonIds: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Lesson',
        default: [],
    },
    // which blocks ("topics" on the mobile side, within a chapter) this user
    // has finished — drives Chapter Topics' isCompleted/currentTopicIndex.
    completedBlockIds: {
        type: [mongoose.Schema.Types.ObjectId],
        default: [],
    },
},
    {                
    timestamps: true    ,
    }
);

module.exports = mongoose.model('Enrollment', enrollmentSchema);