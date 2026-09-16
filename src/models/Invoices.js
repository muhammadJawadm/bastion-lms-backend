const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
    },
    number: {
        type: String,
        required: true,
    },
    amountCents: { 
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'overdue', 'canceled'],
        default: 'draft',
    },
    issuedAt: {
        type: Date,
        default: null,
    },
    stripeInvoiceId: {
        type: String,
        default: null,
    },
},
 {                
    timestamps: true    ,
});

module.exports = mongoose.model('Invoice', invoiceSchema);