const mongoose = require('mongoose');

const formResponseSchema = new mongoose.Schema({
    formId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Form',
    },
    respondentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },
    answers: [{
        fieldId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FormField',
        },
        value: {
            type: String,
        },
        flagged: {
            type: Boolean,
            default: false,
        },
    }],
    tableRows: [{
        pageItemId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FormField',
        },
        rows: {
            type: String,
        },
    }],

},
    {
        timestamps: true,
    });

module.exports = mongoose.model('FormResponse', formResponseSchema);