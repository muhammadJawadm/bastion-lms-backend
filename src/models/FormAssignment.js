const mongoose = require('mongoose');

// The "Enrollment" equivalent for forms — a form is a shared company
// document; this is what makes it assigned-to-a-specific-person-by-a-date,
// which nothing else in the Form/FormResponse models tracked before this.
const formAssignmentSchema = new mongoose.Schema({
    formId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Form',
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
    },
    dueDate: {
        type: Date,
        default: null,
    },
    // "overdue" is never stored — it's derived at read time from dueDate vs
    // now (see formAssignmentController), so there's no background job
    // needed to keep it fresh.
    status: {
        type: String,
        enum: ['assigned', 'submitted'],
        default: 'assigned',
    },
    submittedAt: {
        type: Date,
        default: null,
    },
    responseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FormResponse',
        default: null,
    },
},
    { timestamps: true }
);

module.exports = mongoose.model('FormAssignment', formAssignmentSchema);
