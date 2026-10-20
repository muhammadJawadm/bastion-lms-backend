const mongoose = require("mongoose");
const FormAssignment = require("../models/FormAssignment");
const Form = require("../models/Forms");
const FormResponse = require("../models/FormResponses");
const User = require("../models/User");
const { createNotificationIfEnabled } = require("./notificationController");

// "overdue" is never stored on the document — it's computed here from
// dueDate vs now, so there's no background job needed to keep it fresh.
const toDisplayStatus = (assignment) => {
    if (assignment.status === 'submitted') return 'submitted';
    if (assignment.dueDate && new Date(assignment.dueDate) < new Date()) return 'overdue';
    return 'assigned';
};

// POST /form-assignments  (client_admin only — route-gated)
// Assigns a form to a specific person in your company, with an optional due date.
exports.createFormAssignment = async (req, res) => {
    try {
        const { formId, userId, dueDate } = req.body;
        const companyId = req.user.companyId;

        if (!formId || !userId) {
            return res.status(400).json({ message: "formId and userId are required" });
        }

        const form = await Form.findById(formId);
        if (!form || String(form.companyId) !== String(companyId)) {
            return res.status(404).json({ message: "Form not found" });
        }

        const assignment = await FormAssignment.create({
            formId,
            userId,
            companyId,
            dueDate: dueDate || null,
            status: 'assigned',
        });

        await createNotificationIfEnabled({
            userId,
            companyId,
            settingCategory: 'form',
            title: `New form assigned: ${form.title}`,
            type: 'form',
            redirectTo: 'form',
            redirectId: formId,
        });

        res.status(201).json({
            success: true,
            message: "Form assigned successfully",
            data: assignment,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /form-assignments?userId=&formId=&status=  (client_admin/platform_admin — route-gated)
// Admin-facing — Dashboard/Employees-style visibility into who has what assigned.
exports.getFormAssignments = async (req, res) => {
    try {
        let companyId = req.query.companyId;
        if (req.user.role === 'client_admin') companyId = req.user.companyId;
        if (!companyId && req.user.role !== 'platform_admin') {
            return res.status(400).json({ message: "Company ID is required" });
        }

        const filter = {};
        if (companyId) filter.companyId = companyId;
        if (req.query.userId) filter.userId = req.query.userId;
        if (req.query.formId) filter.formId = req.query.formId;

        const assignments = await FormAssignment.find(filter).sort({ createdAt: -1 }).lean();
        const data = assignments.map((a) => ({ ...a, displayStatus: toDisplayStatus(a) }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /form-assignments/:id  (client_admin own company, or platform_admin any)
exports.deleteFormAssignment = async (req, res) => {
    try {
        const assignment = await FormAssignment.findById(req.params.id);
        if (!assignment) {
            return res.status(404).json({ message: "Form assignment not found" });
        }
        if (req.user.role === 'client_admin' && String(assignment.companyId) !== String(req.user.companyId)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        await FormAssignment.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Form assignment deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /form-assignments/my-forms?perPage=&pageNo=&query=&status=
// Mobile "All Forms" list — status is assigned|submitted|overdue (overdue computed, not stored).
exports.getMyForms = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, query } = req.query;
        const limit = parseInt(req.query.perPage, 10) || 10;
        const page = parseInt(req.query.pageNo, 10) || 1;
        const skip = (page - 1) * limit;

        const pipeline = [
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $lookup: { from: "forms", localField: "formId", foreignField: "_id", as: "form" } },
            { $unwind: "$form" },
        ];
        if (query) {
            pipeline.push({ $match: { "form.title": { $regex: query, $options: "i" } } });
        }
        pipeline.push({ $sort: { createdAt: -1 } });

        const all = await FormAssignment.aggregate(pipeline);

        let data = all.map((a) => ({
            formID: a.form._id,
            title: a.form.title,
            status: toDisplayStatus(a),
            dueDate: a.dueDate,
            submittedDate: a.status === 'submitted' ? a.submittedAt : null,
        }));

        if (status) data = data.filter((d) => d.status === status);

        const total = data.length;
        const paged = data.slice(skip, skip + limit);

        res.status(200).json({
            success: true,
            data: paged,
            pagination: { perPage: limit, pageNo: page, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Flattens the builder's nested pages -> items(section) -> fields into the
// flat "list of questions" the mobile app expects. Table and instruction
// items don't map to a single question and are deliberately left out of
// this list — a form that's just tables/instructions returns no questions
// here; the mobile client isn't built to render those item kinds anyway.
const flattenQuestions = (form) => {
    const questions = [];
    (form.pages || []).forEach((page) => {
        (page.items || []).forEach((item) => {
            if (item.kind !== "section") return;
            (item.fields || []).forEach((field) => {
                questions.push({
                    id: field._id,
                    question: field.label,
                    type: field.type,
                    isRequired: field.required,
                    answers: ["dropdown", "multiple_choice", "checkbox"].includes(field.type)
                        ? (field.options || [])
                        : undefined,
                });
            });
        });
    });
    return questions;
};

// GET /form-assignments/my-forms/:formId
// Mobile "Form Details" — unfilled shape (list of questions to answer) if
// not yet submitted, or the submitted shape (questions + this user's own
// answers) if it is. 404s if this form was never assigned to you.
exports.getMyFormDetails = async (req, res) => {
    try {
        const { formId } = req.params;
        const userId = req.user.id;

        const assignment = await FormAssignment.findOne({ formId, userId });
        if (!assignment) {
            return res.status(404).json({ message: "This form was not assigned to you" });
        }

        const form = await Form.findById(formId).lean();
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }

        const questions = flattenQuestions(form);

        if (assignment.status !== 'submitted' || !assignment.responseId) {
            return res.status(200).json({
                success: true,
                data: {
                    formID: form._id,
                    title: form.title,
                    description: form.description,
                    questions,
                },
            });
        }

        const [response, user] = await Promise.all([
            FormResponse.findById(assignment.responseId).lean(),
            User.findById(userId).select('name'),
        ]);

        const answerByFieldId = {};
        (response ? response.answers : []).forEach((a) => { answerByFieldId[String(a.fieldId)] = a.value; });

        res.status(200).json({
            success: true,
            data: {
                formID: form._id,
                title: form.title,
                submittedBy: user ? user.name : null,
                assignedDate: assignment.createdAt,
                submittedDate: assignment.submittedAt,
                questions: questions.map((q) => ({ ...q, answer: answerByFieldId[String(q.id)] })),
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
