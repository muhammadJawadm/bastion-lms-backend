const mongoose = require('mongoose');

// Display data only — mirrors what Stripe returns about an attached payment
// method so the UI can show "Visa ending 4242" without another Stripe call.
// Never stores card numbers, CVV, or bank account numbers.
const paymentMethodSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    stripePaymentMethodId: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['card', 'bank_account'],
        default: 'card',
    },
    brand: {
        type: String,
    },
    last4: {
        type: String,
    },
    expMonth: {
        type: Number,
    },
    expYear: {
        type: Number,
    },
    bankName: {
        type: String,
    },
    accountType: {
        type: String,
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
},
    { timestamps: true }
);

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);
