const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    name: {
        type: String,    
        required: true,
    },
    industry: {
        type: String,    
    },
    contactName: {
        type: String,    
    },
    contactEmail: {
        type: String,    
    },
    contactPhone: {
        type: String,    
    },
    city: {
        type: String,    
    },
    state: {
        type: String,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    branding: {
        logoUrl: {
            type: String,
        },
        primaryColor: {
            type: String,
        },
        accentColor: {
            type: String,
        },
    },
    notificationPreferences: {
        trainingDueReminders: {
            type: Boolean,
            default: true,
        },
        overdueTrainingAlerts: {
            type: Boolean,
            default: true,
        },
        courseCompletionNotifications: {
            type: Boolean,
            default: true,
        },
        certificateExpirationWarnings: {
            type: Boolean,
            default: true,
        },
        newCourseAssignments: {
            type: Boolean,
            default: true,
        },
        weeklyComplianceDigest: {
            type: Boolean,
            default: false,
        },
    },
    paymentMethods:{
        type: String,
    }
},
    { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);