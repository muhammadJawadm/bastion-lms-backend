// Route-level gate on req.user.role (set by verifyToken, which must run first).
// Ownership/company-scoping (e.g. "only within your own company") is a separate
// check done inside each controller, since it depends on the resource being touched.
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    next();
};

module.exports = requireRole;
