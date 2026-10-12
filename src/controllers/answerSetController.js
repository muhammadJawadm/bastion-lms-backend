const AnswerSet = require("../models/AnswerSet");

// POST /answer-sets
// A reusable named option list (e.g. "Severity Levels") that a dropdown/
// multiple_choice/checkbox field can point at via field.answerSetId instead
// of repeating the same options inline on every field.
exports.createAnswerSet = async (req, res) => {
    try {
        const { companyId, label, options } = req.body;

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

// GET /answer-sets?companyId=
exports.getAnswerSets = async (req, res) => {
    try {
        const { companyId } = req.query;

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

// PATCH /answer-sets/:id
exports.updateAnswerSet = async (req, res) => {
    try {
        const { id } = req.params;
        const { label, options } = req.body;

        const answerSet = await AnswerSet.findById(id);
        if (!answerSet) {
            return res.status(404).json({ message: "Answer set not found" });
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

// DELETE /answer-sets/:id
exports.deleteAnswerSet = async (req, res) => {
    try {
        const { id } = req.params;

        const answerSet = await AnswerSet.findByIdAndDelete(id);
        if (!answerSet) {
            return res.status(404).json({ message: "Answer set not found" });
        }

        res.status(200).json({ success: true, message: "Answer set deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
