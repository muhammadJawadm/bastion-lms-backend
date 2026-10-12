const AnswerSet = require("../models/AnswerSet");

// client_admin can only touch answer sets in their own company; platform_admin
// (read/delete-only, enforced at the route) has no restriction.
const canAccess = (req, answerSet) =>
    req.user.role !== 'client_admin' || String(answerSet.companyId) === String(req.user.companyId);

// POST /answer-sets  (client_admin only — route-gated)
// A reusable named option list (e.g. "Severity Levels") that a dropdown/
// multiple_choice/checkbox field can point at via field.answerSetId instead
// of repeating the same options inline on every field.
exports.createAnswerSet = async (req, res) => {
    try {
        const { label, options } = req.body;
        // route is client_admin-only — always their own company
        const companyId = req.user.companyId;

        if (!companyId || !label) {
            return res.status(400).json({ message: "Company ID and label are required" });
        }

        const answerSet = await AnswerSet.create({
            companyId,
            label,
            options: options || [],
        });

        res.status(201).json({
            success: true,
            message: "Answer set created successfully",
            data: answerSet,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /answer-sets?companyId=  (client_admin or platform_admin — route-gated)
exports.getAnswerSets = async (req, res) => {
    try {
        let companyId = req.query.companyId;
        if (req.user.role === 'client_admin') companyId = req.user.companyId;

        if (!companyId) {
            return res.status(400).json({ message: "Company ID is required" });
        }

        const answerSets = await AnswerSet.find({ companyId }).sort({ label: 1 });
        res.status(200).json({ success: true, data: answerSets });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /answer-sets/:id  (client_admin only — route-gated)
exports.updateAnswerSet = async (req, res) => {
    try {
        const { id } = req.params;
        const { label, options } = req.body;

        const answerSet = await AnswerSet.findById(id);
        if (!answerSet) {
            return res.status(404).json({ message: "Answer set not found" });
        }
        if (!canAccess(req, answerSet)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        if (label !== undefined) answerSet.label = label;
        if (options !== undefined) answerSet.options = options;
        await answerSet.save();

        res.status(200).json({
            success: true,
            message: "Answer set updated successfully",
            data: answerSet,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /answer-sets/:id  (client_admin own company, or platform_admin any)
exports.deleteAnswerSet = async (req, res) => {
    try {
        const { id } = req.params;

        const answerSet = await AnswerSet.findById(id);
        if (!answerSet) {
            return res.status(404).json({ message: "Answer set not found" });
        }
        if (!canAccess(req, answerSet)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        await AnswerSet.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Answer set deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
