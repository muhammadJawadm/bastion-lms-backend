const mongoose = require('mongoose');

const formSchema = new mongoose.Schema({
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
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft',
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    // formFields: [{
    //     type: {
    //         type: String,
    //     },
    //     data: {
    //         type: String,
    //     }
    // }],
    pages: [{
        title: {
            type: String,
        },
        sortOrder: {
            type: Number,
            default: 0
        },
        items: [{
                kind: {
                    type: String,
                    enum: ['table', 'section', 'instruction'],
                },
                sortOrder: {
                    type: Number,
                    default: 0,
                },
                title:{
                    type: String,
                },
                body:{
                    type: String,
                },
                columns: [{
                    label: {
                        type: String,
                    },
                    sortOrder: {
                        type: Number,
                        default: 0,
                    },
                }],
                fields: [{
                    type: {
                        type: String,
                    },
                    label: {
                        type: String,
                    },
                    helpText: {
                        type: String,
                    },
                    required: {
                        type: Boolean,
                        default: false,
                    },
                    sortOrder: {
                        type: Number,
                        default: 0,
                    },
                    options: [{
                        type: String,
                    }],
                    answerSetId:{
                        type:String,
                    },
                    minRating: {
                        type: Number,
                    },
                    maxRating: {
                        type: Number,
                    },
                    flagValues: [{
                        type: String,
                    }],
                }],
            }]
        }
    ],
});

module.exports = mongoose.model('Form', formSchema);
