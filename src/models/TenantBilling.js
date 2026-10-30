const mongoose = require('mongoose');

// One document per Company ("tenant"). Mirrors Stripe's subscription state so
// the rest of the app can gate features without calling Stripe on every
// request. Stripe remains the source of truth; webhooks keep this in sync.
const tenantBillingSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        unique: true,
    },
    stripeCustomerId: {
        type: String,
    },
    stripeSubscriptionId: {
        type: String,
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
    },
    status: {
        type: String,
        enum: ['trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid'],
        default: 'incomplete',
    },
    seatLimit: {
        type: Number,
        default: null,
    },
    currentPeriodEnd: {
        type: Date,
    },
    cancelAtPeriodEnd: {
        type: Boolean,
        default: false,
    },
    collectionMethod: {
        type: String,
        enum: ['card', 'ach', 'invoice'],
        default: 'card',
    },
    poReference: {
        type: String,
    },
    billingContact: {
        name: { type: String },
        email: { type: String },
    },
    gracePeriodUntil: {
        type: Date,
        default: null,
    },
},
    { timestamps: true }
);

module.exports = mongoose.model('TenantBilling', tenantBillingSchema);
