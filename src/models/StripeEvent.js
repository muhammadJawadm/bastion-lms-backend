const mongoose = require('mongoose');

// Idempotency ledger for the Stripe webhook — Stripe retries delivery on
// timeout/failure, so every processed event id is recorded here first.
const stripeEventSchema = new mongoose.Schema({
    stripeEventId: {
        type: String,
        required: true,
        unique: true,
    },
    type: {
        type: String,
        required: true,
    },
    processedAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('StripeEvent', stripeEventSchema);
