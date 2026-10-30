const mongoose = require('mongoose');

// Local mirror of a Stripe Invoice, kept in sync via webhooks, so billing
// history can be listed without round-tripping to Stripe on every request.
const invoiceSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    stripeInvoiceId: {
        type: String,
        required: true,
        unique: true,
    },
    number: {
        type: String,
    },
    amountDue: {
        type: Number,
    },
    amountPaid: {
        type: Number,
    },
    currency: {
        type: String,
        default: 'usd',
    },
    status: {
        type: String,
        enum: ['draft', 'open', 'paid', 'payment_failed', 'void', 'uncollectible'],
        default: 'open',
    },
    dueDate: {
        type: Date,
    },
    paidAt: {
        type: Date,
    },
    hostedInvoiceUrl: {
        type: String,
    },
    pdfUrl: {
        type: String,
    },
},
    { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
