const mongoose = require('mongoose');

const answerSetSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
    },
    label: {
        type: String,
        required: true,
    },
    options: [{
        type: String,
    }],
},
    { timestamps: true }
);

module.exports = mongoose.model('AnswerSet', answerSetSchema);
