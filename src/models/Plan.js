const mongoose = require('mongoose');

// Plan catalog — mirrors the Stripe Products/Prices that platform_admin sets
// up in the Stripe dashboard. We never price anything locally; these price
// IDs are what gets handed to Stripe Checkout.
const planSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    stripeProductId: {
        type: String,
        required: true,
    },
    monthlyPriceId: {
        type: String,
    },
    annualPriceId: {
        type: String,
    },
    // set when this plan bills per mobile-user seat instead of/alongside a flat price
    perSeatPriceId: {
        type: String,
    },
    seatLimit: {
        type: Number,
        default: null, // null = unlimited
    },
    features: [{
        type: String,
    }],
    isActive: {
        type: Boolean,
        default: true,
    },
},
    { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
