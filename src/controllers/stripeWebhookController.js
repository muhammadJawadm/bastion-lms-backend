const stripe = require('../config/stripe');
const TenantBilling = require('../models/TenantBilling');
const Invoice = require('../models/Invoice');
const PaymentMethod = require('../models/PaymentMethod');
const StripeEvent = require('../models/StripeEvent');
const User = require('../models/User');
const { createNotificationIfEnabled } = require('./notificationController');

const GRACE_PERIOD_DAYS = 7;

const notifyCompanyAdmins = async (companyId, { title, type, buttonText, redirectTo, redirectId }) => {
    const admins = await User.find({ companyId, role: 'client_admin' }).select('_id');
    await Promise.all(admins.map((admin) => createNotificationIfEnabled({
        userId: admin._id,
        companyId,
        settingCategory: 'billing',
        title, type, buttonText, redirectTo, redirectId,
    })));
};

const notifyPlatformAdmins = async ({ title, type, buttonText, redirectTo, redirectId }) => {
    const admins = await User.find({ role: 'platform_admin' }).select('_id');
    await Promise.all(admins.map((admin) => createNotificationIfEnabled({
        userId: admin._id,
        settingCategory: 'billing',
        title, type, buttonText, redirectTo, redirectId,
    })));
};

// Exported so the "confirm checkout" fallback (billingController) can apply
// the exact same update when the webhook hasn't arrived yet by the time the
// success page loads.
exports.syncSubscription = async (subscription) => {
    const companyId = subscription.metadata && subscription.metadata.companyId;
    const filter = companyId ? { companyId } : { stripeSubscriptionId: subscription.id };

    const update = {
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    };
    if (subscription.metadata && subscription.metadata.planId) {
        update.planId = subscription.metadata.planId;
    }

    return TenantBilling.findOneAndUpdate(filter, update, { new: true });
};

const upsertInvoiceRecord = async (invoice, status) => {
    const companyId = invoice.subscription_details?.metadata?.companyId
        || invoice.metadata?.companyId
        || (await TenantBilling.findOne({ stripeCustomerId: invoice.customer }).select('companyId'))?.companyId;

    if (!companyId) return null;

    return Invoice.findOneAndUpdate(
        { stripeInvoiceId: invoice.id },
        {
            companyId,
            stripeInvoiceId: invoice.id,
            number: invoice.number,
            amountDue: invoice.amount_due,
            amountPaid: invoice.amount_paid,
            currency: invoice.currency,
            status,
            dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
            paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            pdfUrl: invoice.invoice_pdf,
        },
        { upsert: true, new: true }
    );
};

// POST /webhooks/stripe — public, verified by Stripe signature, not JWT.
// Mounted with express.raw() in webhookRoutes.js so req.body is the raw
// buffer Stripe's signature was computed over.
exports.handleStripeWebhook = async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        console.error('Stripe webhook signature verification failed:', error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    // Idempotency — Stripe retries on timeout, don't double-apply an event.
    const already = await StripeEvent.findOne({ stripeEventId: event.id });
    if (already) {
        return res.status(200).json({ received: true, duplicate: true });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                if (session.mode === 'subscription' && session.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(session.subscription);
                    const billing = await exports.syncSubscription(subscription);
                    if (billing) {
                        await notifyCompanyAdmins(billing.companyId, {
                            title: 'Your subscription is now active',
                            type: 'success',
                            redirectTo: null,
                        });
                        await notifyPlatformAdmins({
                            title: 'A company just subscribed',
                            type: 'success',
                        });
                    }
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                await exports.syncSubscription(subscription);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const billing = await exports.syncSubscription({ ...subscription, status: 'canceled' });
                if (billing) {
                    await notifyCompanyAdmins(billing.companyId, {
                        title: 'Your subscription has ended',
                        type: 'warning',
                    });
                    await notifyPlatformAdmins({ title: 'A company subscription was cancelled', type: 'warning' });
                }
                break;
            }

            case 'invoice.paid': {
                const invoice = event.data.object;
                const record = await upsertInvoiceRecord(invoice, 'paid');
                if (record) {
                    await TenantBilling.findOneAndUpdate(
                        { companyId: record.companyId, status: 'past_due' },
                        { status: 'active', gracePeriodUntil: null }
                    );
                    await notifyCompanyAdmins(record.companyId, {
                        title: `Payment received — invoice ${record.number || ''}`.trim(),
                        type: 'success',
                        buttonText: 'View invoice',
                        redirectTo: null,
                    });
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const record = await upsertInvoiceRecord(invoice, 'payment_failed');
                if (record) {
                    const gracePeriodUntil = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
                    await TenantBilling.findOneAndUpdate(
                        { companyId: record.companyId },
                        { status: 'past_due', gracePeriodUntil }
                    );
                    await notifyCompanyAdmins(record.companyId, {
                        title: 'Payment failed — please update your payment method',
                        type: 'warning',
                        buttonText: 'Update payment method',
                    });
                    await notifyPlatformAdmins({
                        title: 'A company payment failed',
                        type: 'warning',
                    });
                }
                break;
            }

            case 'payment_method.attached': {
                const pm = event.data.object;
                const billing = await TenantBilling.findOne({ stripeCustomerId: pm.customer });
                if (billing) {
                    await PaymentMethod.findOneAndUpdate(
                        { stripePaymentMethodId: pm.id },
                        {
                            companyId: billing.companyId,
                            stripePaymentMethodId: pm.id,
                            type: pm.type,
                            brand: pm.card?.brand,
                            last4: pm.card?.last4 || pm.us_bank_account?.last4,
                            expMonth: pm.card?.exp_month,
                            expYear: pm.card?.exp_year,
                            bankName: pm.us_bank_account?.bank_name,
                            accountType: pm.us_bank_account?.account_type,
                        },
                        { upsert: true }
                    );
                }
                break;
            }

            default:
                break; // unhandled event types are safe to ignore
        }

        await StripeEvent.create({ stripeEventId: event.id, type: event.type, processedAt: new Date() });
        res.status(200).json({ received: true });
    } catch (error) {
        console.error(`Error processing Stripe webhook ${event.type}:`, error);
        // 500 so Stripe retries — this event was NOT recorded in StripeEvent,
        // so the retry will attempt processing again instead of short-circuiting.
        res.status(500).json({ message: "Webhook processing error" });
    }
};
