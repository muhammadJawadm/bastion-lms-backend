const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,    
    },
    price: {
        type: Number,
        required: true,
    },
    type: {
        type: String,
        enum: ['monthly', 'yearly'],
        required: true,
    },
    maxUsers: {
        type: Number,
        required: true,    
    },
    features: {
        type: String,
    },
});

module.exports = mongoose.model('Plan', planSchema);