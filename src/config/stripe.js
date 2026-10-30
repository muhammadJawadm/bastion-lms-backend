const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY is not set — Stripe billing endpoints will fail until it is configured.');
}

// A placeholder lets the app boot without the key configured (e.g. first
// clone, CI); any real billing call will then fail with a clear Stripe auth
// error instead of crashing the whole server at startup.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_not_configured');

module.exports = stripe;
