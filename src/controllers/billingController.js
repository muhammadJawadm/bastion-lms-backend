const stripe = require('../config/stripe');
const Plan = require('../models/Plan');
const TenantBilling = require('../models/TenantBilling');
const Invoice = require('../models/Invoice');
const PaymentMethod = require('../models/PaymentMethod');
const Company = require('../models/Company');
const { syncSubscription } = require('./stripeWebhookController');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Plans are created in the Stripe dashboard first (Product + monthly/annual/
// per-seat Prices); this just registers those price IDs in our own catalog
// so client_admin can pick a plan without talking to Stripe directly.
exports.createPlan = async (req, res) => {
    try {
        const { name, description, stripeProductId, monthlyPriceId, annualPriceId, perSeatPriceId, seatLimit, features } = req.body;
        if (!name || !stripeProductId) {
            return res.status(400).json({ message: "name and stripeProductId are required" });
        }
        const plan = await Plan.create({
            name, description, stripeProductId, monthlyPriceId, annualPriceId, perSeatPriceId,
            seatLimit: seatLimit ?? null,
            features: features || [],
        });
        res.status(201).json({ success: true, data: plan });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /billing/plans — readable by both admin roles so client_admin can see
// what's available to subscribe to.
exports.getPlans = async (req, res) => {
    try {
        const onlyActive = req.user.role !== 'platform_admin';
        const filter = onlyActive ? { isActive: true } : {};
        const plans = await Plan.find(filter).sort({ createdAt: 1 });
        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.updatePlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const { name, description, monthlyPriceId, annualPriceId, perSeatPriceId, seatLimit, features, isActive } = req.body;
        const plan = await Plan.findById(planId);
        if (!plan) return res.status(404).json({ message: "Plan not found" });

        if (name !== undefined) plan.name = name;
        if (description !== undefined) plan.description = description;
        if (monthlyPriceId !== undefined) plan.monthlyPriceId = monthlyPriceId;
        if (annualPriceId !== undefined) plan.annualPriceId = annualPriceId;
        if (perSeatPriceId !== undefined) plan.perSeatPriceId = perSeatPriceId;
        if (seatLimit !== undefined) plan.seatLimit = seatLimit;
        if (features !== undefined) plan.features = features;
        if (isActive !== undefined) plan.isActive = isActive;
        await plan.save();

        res.status(200).json({ success: true, data: plan });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Hard-delete only if no company is currently subscribed to it — otherwise
// deactivate so existing subscriptions keep a valid reference.
exports.deletePlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const inUse = await TenantBilling.exists({ planId });
        if (inUse) {
            await Plan.findByIdAndUpdate(planId, { isActive: false });
            return res.status(200).json({ success: true, message: "Plan is in use by a company — deactivated instead of deleted" });
        }
        const plan = await Plan.findByIdAndDelete(planId);
        if (!plan) return res.status(404).json({ message: "Plan not found" });
        res.status(200).json({ success: true, message: "Plan deleted" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const getOrCreateTenantBilling = async (companyId) => {
    let billing = await TenantBilling.findOne({ companyId });
    if (billing) return billing;

    const company = await Company.findById(companyId);
    if (!company) throw new Error("Company not found");

    const customer = await stripe.customers.create({
        name: company.name,
        email: company.contactEmail || undefined,
        metadata: { companyId: String(companyId) },
    });

    billing = await TenantBilling.create({
        companyId,
        stripeCustomerId: customer.id,
        billingContact: { name: company.contactName, email: company.contactEmail },
    });
    return billing;
};

// POST /billing/checkout-session — client_admin only, always against their
// own company. Returns a Stripe-hosted Checkout URL to redirect the browser to.
exports.createCheckoutSession = async (req, res) => {
    try {
        const { planId, interval, seatQuantity } = req.body; // interval: 'monthly' | 'annual' | 'perSeat'
        const companyId = req.user.companyId;
        if (!companyId) return res.status(400).json({ message: "No company associated with this account" });

        const plan = await Plan.findById(planId);
        if (!plan || !plan.isActive) return res.status(404).json({ message: "Plan not found" });

        const priceId = interval === 'annual' ? plan.annualPriceId
            : interval === 'perSeat' ? plan.perSeatPriceId
            : plan.monthlyPriceId;
        if (!priceId) return res.status(400).json({ message: `Plan has no price configured for interval "${interval}"` });

        // seatLimit is a hard cap on a per-seat plan when set (null = uncapped);
        // flat monthly/annual plans always buy quantity 1, so it's just
        // "seats included" display text for those and isn't checked here.
        const quantity = interval === 'perSeat' ? (seatQuantity || 1) : 1;
        if (interval === 'perSeat' && plan.seatLimit != null && quantity > plan.seatLimit) {
            return res.status(400).json({ message: `This plan allows at most ${plan.seatLimit} seats` });
        }

        const billing = await getOrCreateTenantBilling(companyId);

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: billing.stripeCustomerId,
            line_items: [{
                price: priceId,
                quantity,
            }],
            success_url: `${FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/billing`,
            metadata: { companyId: String(companyId), planId: String(plan._id) },
            subscription_data: {
                metadata: { companyId: String(companyId), planId: String(plan._id) },
            },
        });

        res.status(200).json({ success: true, data: { url: session.url } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /billing/confirm/:sessionId — client_admin only. Fallback for the
// success page: don't just wait on the webhook (delivery can lag or, in dev,
// may not be running at all) — actively pull the Checkout Session from
// Stripe and apply the same sync the webhook would have, so the success page
// can show the real status immediately instead of "still finishing".
exports.confirmCheckoutSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (String(session.metadata?.companyId) !== String(req.user.companyId)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        if (session.mode === 'subscription' && session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            await syncSubscription(subscription);
        }

        const billing = await TenantBilling.findOne({ companyId: req.user.companyId }).populate('planId');
        res.status(200).json({ success: true, data: billing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /billing/portal-session — client_admin only. Stripe's hosted portal
// handles payment method updates, invoice history, and self-serve cancel —
// we don't need to build any of that UI ourselves.
exports.createPortalSession = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const billing = await TenantBilling.findOne({ companyId });
        if (!billing || !billing.stripeCustomerId) {
            return res.status(404).json({ message: "No billing account yet — subscribe to a plan first" });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: billing.stripeCustomerId,
            return_url: `${FRONTEND_URL}/billing`,
        });

        res.status(200).json({ success: true, data: { url: session.url } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /billing/me — client_admin's own company billing snapshot
exports.getMyBilling = async (req, res) => {
    try {
        const billing = await TenantBilling.findOne({ companyId: req.user.companyId }).populate('planId');
        if (!billing) return res.status(200).json({ success: true, data: null });
        res.status(200).json({ success: true, data: billing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getMyInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.find({ companyId: req.user.companyId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: invoices });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getMyPaymentMethods = async (req, res) => {
    try {
        const methods = await PaymentMethod.find({ companyId: req.user.companyId }).sort({ isDefault: -1, createdAt: -1 });
        res.status(200).json({ success: true, data: methods });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /billing/cancel — client_admin cancels their own subscription
// (at period end, not immediately — they keep access until it lapses).
exports.cancelMySubscription = async (req, res) => {
    try {
        const billing = await TenantBilling.findOne({ companyId: req.user.companyId });
        if (!billing || !billing.stripeSubscriptionId) {
            return res.status(404).json({ message: "No active subscription" });
        }
        await stripe.subscriptions.update(billing.stripeSubscriptionId, { cancel_at_period_end: true });
        billing.cancelAtPeriodEnd = true;
        await billing.save();
        res.status(200).json({ success: true, message: "Subscription will cancel at the end of the current period", data: billing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// ---- platform_admin: cross-company billing views ----

// GET /billing/tenants?status=&perPage=&pageNo=
exports.getAllTenantBilling = async (req, res) => {
    try {
        const limit = parseInt(req.query.perPage, 10) || 20;
        const page = parseInt(req.query.pageNo, 10) || 1;
        const skip = (page - 1) * limit;
        const filter = {};
        if (req.query.status) filter.status = req.query.status;

        const [total, tenants] = await Promise.all([
            TenantBilling.countDocuments(filter),
            TenantBilling.find(filter)
                .populate('companyId', 'name contactEmail')
                .populate('planId', 'name')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit),
        ]);

        res.status(200).json({
            success: true,
            data: tenants,
            pagination: { perPage: limit, pageNo: page, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getTenantBillingByCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        const [billing, invoices, paymentMethods] = await Promise.all([
            TenantBilling.findOne({ companyId }).populate('companyId', 'name contactEmail').populate('planId'),
            Invoice.find({ companyId }).sort({ createdAt: -1 }),
            PaymentMethod.find({ companyId }),
        ]);
        if (!billing) return res.status(404).json({ message: "No billing record for this company" });
        res.status(200).json({ success: true, data: { billing, invoices, paymentMethods } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /billing/tenants/:companyId/grace-period — support override, e.g.
// extending access a few days while a wire transfer clears.
exports.setGracePeriod = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { until } = req.body;
        if (!until) return res.status(400).json({ message: "until date is required" });

        const billing = await TenantBilling.findOneAndUpdate(
            { companyId },
            { gracePeriodUntil: new Date(until) },
            { new: true }
        );
        if (!billing) return res.status(404).json({ message: "No billing record for this company" });
        res.status(200).json({ success: true, data: billing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /billing/tenants/:companyId/cancel — platform_admin force-cancels a
// company's subscription (e.g. contract termination).
exports.adminCancelSubscription = async (req, res) => {
    try {
        const { companyId } = req.params;
        const billing = await TenantBilling.findOne({ companyId });
        if (!billing || !billing.stripeSubscriptionId) {
            return res.status(404).json({ message: "No active subscription for this company" });
        }
        await stripe.subscriptions.cancel(billing.stripeSubscriptionId);
        billing.status = 'canceled';
        billing.cancelAtPeriodEnd = false;
        await billing.save();
        res.status(200).json({ success: true, message: "Subscription cancelled", data: billing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
