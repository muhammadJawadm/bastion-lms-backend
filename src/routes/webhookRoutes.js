const express = require('express');
const router = express.Router();
const { handleStripeWebhook } = require('../controllers/stripeWebhookController');

// Stripe needs the raw request body to verify the signature, so this route
// is mounted in app.js BEFORE express.json() and uses express.raw() here,
// not the global JSON parser.
router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;
