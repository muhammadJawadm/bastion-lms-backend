const mongoose = require('mongoose');

const formResponseSchema = new mongoose.Schema({
    formId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Form',
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
    },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },
    // one entry per section field — value shape depends on the field's type
    // (String for text/dropdown/yes_no, [String] for checkbox, Number for rating, etc.)
    answers: [{
        fieldId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        value: {
            type: mongoose.Schema.Types.Mixed,
        },
        // true when this answer matches one of the field's flagValues (a safety concern)
        flagged: {
            type: Boolean,
            default: false,
        },
    }],
    // one entry per row of a table item — a table can have many rows
    // (e.g. one row per crew member signing in)
    tableRows: [{
        pageItemId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
        cells: [{
            columnId: {
                type: mongoose.Schema.Types.ObjectId,
            },
            value: {
                type: mongoose.Schema.Types.Mixed,
            },
        }],
    }],
},
    { timestamps: true }
);

module.exports = mongoose.model('FormResponse', formResponseSchema);
