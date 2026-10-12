const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,    
    },
    password: {
        type: String,
        required: true,    
    },    
    role: {
        type: String,
        enum: ['platform_admin', 'client_admin', 'user'],
        required: true,
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    department:{
        type: String,
    },
    jobTitle: {
        type: String,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    avatarUrl: {
        type: String,
        default: null,
    },
    lastLoginAt: {
        type: Date,
        default: null,
    },
    mustChangePassword: {
        type: Boolean,
        default: false,
    },
    is_verified: {
        type: Boolean,
        default: false,
    },
},
 {                
    timestamps: true    ,
});

module.exports = mongoose.model('User', userSchema);
