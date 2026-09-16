const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
    },
    status: {
        type: String,
        enum: ['active', 'past_due', 'canceled'],   
        default: 'active',
    },
    curentPeriodEnd:{
        type: Date,
        default: null
    },
    cancelAtPeriodEnd: {
        type: Boolean,
        default: false,
    },
    stripeSubscriptionId: {
        type: String,
        default: null, 
    },
    stripeCustomerId: {
        type: String,
        default: null, 
    },
    
},
 {                
    timestamps: true    ,
});
