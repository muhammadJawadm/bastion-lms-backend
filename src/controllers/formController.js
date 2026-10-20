const mongoose = require("mongoose");
const Form = require("../models/Forms");
const FormResponse = require("../models/FormResponses");
const FormAssignment = require("../models/FormAssignment");
const User = require("../models/User");
const { createNotificationIfEnabled } = require("./notificationController");

// client_admin can only touch forms in their own company; platform_admin
// (read/delete-only, enforced at the route) has no restriction.
const canAccessForm = (req, form) =>
    req.user.role !== 'client_admin' || String(form.companyId) === String(req.user.companyId);

// POST /forms
// Step 1 — the "title + description" screen. Creates the form and
// redirects to the form builder page, same pattern as createCourse.
exports.createForm = async (req, res) => {
    const { title, description, ownerId } = req.body;
    // route is client_admin-only — always their own company
    const companyId = req.user.companyId;

    if (!title || !companyId) {
        return res.status(400).json({ message: "Title and Company ID are required" });
    }

    try {
        const newForm = new Form({
            title,
            description,
            companyId,
            ownerId,
            pages: [],
        });

        await newForm.save();
        res.status(201).json({
            success: true,
            message: "Form created successfully",
            data: newForm,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Keeps ownerId as a plain id in the response (not the populated subdocument)
// while adding ownerName/ownerEmail alongside it, so existing consumers that
// expect ownerId to be an id string don't break.
const withOwnerInfo = (form) => {
    const owner = form.ownerId;
    return {
        ...form,
        ownerId: owner ? owner._id : null,
        ownerName: owner ? owner.name : null,
        ownerEmail: owner ? owner.email : null,
    };
};

// GET /forms?companyId=&search=&status=
// The Forms list page — company-scoped.
exports.getForms = async (req, res) => {
    try {
        const { search, status } = req.query;
        let companyId = req.query.companyId;
        if (req.user.role === 'client_admin') companyId = req.user.companyId;

        const filter = {};
        if (companyId) filter.companyId = companyId;
        if (status) filter.status = status;
        if (search) filter.title = { $regex: search, $options: "i" };

        const forms = await Form.find(filter).sort({ updatedAt: -1 }).populate('ownerId', 'name email').lean();
        res.status(200).json({ success: true, data: forms.map(withOwnerInfo) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /forms/:formId
// Loads the whole form — pages/items/fields/columns together — for the
// form builder to reopen, matching how it's edited client-side as one document.
exports.getFormById = async (req, res) => {
    const { formId } = req.params;

    try {
        const form = await Form.findById(formId).populate('ownerId', 'name email').lean();
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        res.status(200).json({ success: true, data: withOwnerInfo(form) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /forms/:formId
// Form settings — title, description, status (draft/published), owner, plus
// the opaque logic/reportLayout blobs the frontend owns (stored as-is, never
// interpreted server-side).
exports.updateForm = async (req, res) => {
    const { formId } = req.params;
    const { title, description, status, ownerId, logic, reportLayout } = req.body;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        if (title) form.title = title;
        if (description !== undefined) form.description = description;
        if (status) form.status = status;
        if (ownerId) form.ownerId = ownerId;
        if (logic !== undefined) form.logic = logic;
        if (reportLayout !== undefined) form.reportLayout = reportLayout;
        await form.save();

        res.status(200).json({
            success: true,
            message: "Form updated successfully",
            data: form,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /forms/:formId/pages
// "+ New Page" on the form builder screen. Items (table/section/instruction)
// get added inside a page later — this just creates the page itself.
exports.addPage = async (req, res) => {
    const { formId } = req.params;
    const { title } = req.body;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = {
            title: title || `Page ${form.pages.length + 1}`,
            sortOrder: form.pages.length,
            items: [],
        };
        form.pages.push(page);
        await form.save();

        res.status(201).json({
            success: true,
            message: "Page added successfully",
            data: form.pages[form.pages.length - 1],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /forms/:formId/pages/:pageId
// Rename a page (sortOrder is normally driven by reorderPages, but settable here too).
exports.updatePage = async (req, res) => {
    const { formId, pageId } = req.params;
    const { title, sortOrder } = req.body;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = form.pages.id(pageId);
        if (!page) {
            return res.status(404).json({ message: "Page not found" });
        }

        if (title !== undefined) page.title = title;
        if (sortOrder !== undefined) page.sortOrder = sortOrder;
        await form.save();

        res.status(200).json({
            success: true,
            message: "Page updated successfully",
            data: page,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /forms/:formId/pages/reorder
// Drag-reordering the page tabs — body: { order: [pageId, pageId, ...] } in
// the new order. Same pattern as the lesson block reorder.
exports.reorderPages = async (req, res) => {
    const { formId } = req.params;
    const { order } = req.body;

    if (!Array.isArray(order) || !order.length) {
        return res.status(400).json({ message: "order must be a non-empty array of page ids" });
    }

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const existingIds = form.pages.map((p) => String(p._id));
        const sameSet =
            order.length === existingIds.length &&
            existingIds.every((id) => order.includes(id));
        if (!sameSet) {
            return res.status(400).json({ message: "order must contain exactly this form's page ids" });
        }

        order.forEach((pageId, index) => {
            form.pages.id(pageId).sortOrder = index;
        });

        await form.save();

        res.status(200).json({
            success: true,
            message: "Pages reordered successfully",
            data: form.pages,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /forms/:formId/pages/:pageId/items
// "+ Add Section, Table, or Instruction" on a page.
exports.addItem = async (req, res) => {
    const { formId, pageId } = req.params;
    const { kind, title, body } = req.body;

    if (!kind || !["table", "section", "instruction"].includes(kind)) {
        return res.status(400).json({ message: "kind must be 'table', 'section' or 'instruction'" });
    }

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = form.pages.id(pageId);
        if (!page) {
            return res.status(404).json({ message: "Page not found" });
        }

        const item = {
            kind,
            title,
            body,
            sortOrder: page.items.length,
            fields: [],
            columns: [],
        };
        page.items.push(item);
        await form.save();

        res.status(201).json({
            success: true,
            message: "Item added successfully",
            data: page.items[page.items.length - 1],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /forms/:formId/pages/:pageId/items/:itemId
// Rename a table's title, or edit an instruction's body text.
exports.updateItem = async (req, res) => {
    const { formId, pageId, itemId } = req.params;
    const { title, body } = req.body;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = form.pages.id(pageId);
        if (!page) {
            return res.status(404).json({ message: "Page not found" });
        }

        const item = page.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        if (title !== undefined) item.title = title;
        if (body !== undefined) item.body = body;
        await form.save();

        res.status(200).json({
            success: true,
            message: "Item updated successfully",
            data: item,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /forms/:formId/pages/:pageId/items/:itemId/fields
// "+ Add Field" inside a section item — the ADD FIELD modal.
exports.addField = async (req, res) => {
    const { formId, pageId, itemId } = req.params;
    const { type, label, helpText, required, options, answerSetId, min, max, flagValues } = req.body;

    if (!type) {
        return res.status(400).json({ message: "Field type is required" });
    }

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = form.pages.id(pageId);
        if (!page) {
            return res.status(404).json({ message: "Page not found" });
        }

        const item = page.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }
        if (item.kind !== "section") {
            return res.status(400).json({ message: "Fields can only be added to a section item" });
        }

        const field = {
            type,
            label,
            helpText,
            required: required || false,
            sortOrder: item.fields.length,
            options,
            answerSetId,
            min,
            max,
            flagValues,
        };
        item.fields.push(field);
        await form.save();

        res.status(201).json({
            success: true,
            message: "Field added successfully",
            data: item.fields[item.fields.length - 1],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /forms/:formId/pages/:pageId/items/:itemId/fields/:fieldId
// Autosave from the field's right-hand panel (Label, Help Text, Required, etc.)
exports.updateField = async (req, res) => {
    const { formId, pageId, itemId, fieldId } = req.params;
    const { type, label, helpText, required, options, answerSetId, min, max, flagValues } = req.body;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = form.pages.id(pageId);
        if (!page) {
            return res.status(404).json({ message: "Page not found" });
        }

        const item = page.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        const field = item.fields.id(fieldId);
        if (!field) {
            return res.status(404).json({ message: "Field not found" });
        }

        if (type !== undefined) field.type = type;
        if (label !== undefined) field.label = label;
        if (helpText !== undefined) field.helpText = helpText;
        if (required !== undefined) field.required = required;
        if (options !== undefined) field.options = options;
        if (answerSetId !== undefined) field.answerSetId = answerSetId;
        if (min !== undefined) field.min = min;
        if (max !== undefined) field.max = max;
        if (flagValues !== undefined) field.flagValues = flagValues;
        await form.save();

        res.status(200).json({
            success: true,
            message: "Field updated successfully",
            data: field,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /forms/:formId/pages/:pageId/items/:itemId/columns
// "+ Add Column" inside a table item.
exports.addColumn = async (req, res) => {
    const { formId, pageId, itemId } = req.params;
    const { label } = req.body;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = form.pages.id(pageId);
        if (!page) {
            return res.status(404).json({ message: "Page not found" });
        }

        const item = page.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }
        if (item.kind !== "table") {
            return res.status(400).json({ message: "Columns can only be added to a table item" });
        }

        const column = {
            label: label || `Column ${item.columns.length + 1}`,
            sortOrder: item.columns.length,
        };
        item.columns.push(column);
        await form.save();

        res.status(201).json({
            success: true,
            message: "Column added successfully",
            data: item.columns[item.columns.length - 1],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /forms/:formId/pages/:pageId/items/:itemId/columns/:columnId
// Renaming a column's label.
exports.updateColumn = async (req, res) => {
    const { formId, pageId, itemId, columnId } = req.params;
    const { label } = req.body;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = form.pages.id(pageId);
        if (!page) {
            return res.status(404).json({ message: "Page not found" });
        }

        const item = page.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        const column = item.columns.id(columnId);
        if (!column) {
            return res.status(404).json({ message: "Column not found" });
        }

        if (label !== undefined) column.label = label;
        await form.save();

        res.status(200).json({
            success: true,
            message: "Column updated successfully",
            data: column,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /forms/:formId/pages/:pageId
exports.deletePage = async (req, res) => {
    const { formId, pageId } = req.params;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = form.pages.id(pageId);
        if (!page) {
            return res.status(404).json({ message: "Page not found" });
        }

        form.pages.pull(pageId);
        await form.save();

        res.status(200).json({ success: true, message: "Page deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /forms/:formId/pages/:pageId/items/:itemId
exports.deleteItem = async (req, res) => {
    const { formId, pageId, itemId } = req.params;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = form.pages.id(pageId);
        if (!page) {
            return res.status(404).json({ message: "Page not found" });
        }

        const item = page.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        page.items.pull(itemId);
        await form.save();

        res.status(200).json({ success: true, message: "Item deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /forms/:formId/pages/:pageId/items/:itemId/fields/:fieldId
exports.deleteField = async (req, res) => {
    const { formId, pageId, itemId, fieldId } = req.params;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = form.pages.id(pageId);
        if (!page) {
            return res.status(404).json({ message: "Page not found" });
        }

        const item = page.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        const field = item.fields.id(fieldId);
        if (!field) {
            return res.status(404).json({ message: "Field not found" });
        }

        item.fields.pull(fieldId);
        await form.save();

        res.status(200).json({ success: true, message: "Field deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /forms/:formId/pages/:pageId/items/:itemId/columns/:columnId
exports.deleteColumn = async (req, res) => {
    const { formId, pageId, itemId, columnId } = req.params;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = form.pages.id(pageId);
        if (!page) {
            return res.status(404).json({ message: "Page not found" });
        }

        const item = page.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        const column = item.columns.id(columnId);
        if (!column) {
            return res.status(404).json({ message: "Column not found" });
        }

        item.columns.pull(columnId);
        await form.save();

        res.status(200).json({ success: true, message: "Column deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /forms/:formId/responses
// Employee submits a filled-out form. Checks every required section field
// was answered, and flags any answer that matches its field's flagValues.
exports.submitFormResponse = async (req, res) => {
    const { formId } = req.params;
    const { answers, tableRows } = req.body;
    // always the caller's own company — never a body override.
    // submittedBy is forced to the caller's own id for a mobile user (so
    // FormAssignment matching below can't be spoofed); a Company Admin may
    // still submit on someone else's behalf via the body, same as before.
    const companyId = req.user.companyId;
    const submittedBy = req.user.role === 'client_admin' ? (req.body.submittedBy || req.user.id) : req.user.id;

    try {
        const form = await Form.findById(formId).lean();
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (req.user.role !== 'platform_admin' && String(form.companyId) !== String(companyId)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        // collect every section field's required/flagValues, keyed by its _id
        const fieldMeta = {};
        (form.pages || []).forEach((page) => {
            (page.items || []).forEach((item) => {
                if (item.kind === "section") {
                    (item.fields || []).forEach((field) => {
                        fieldMeta[String(field._id)] = {
                            required: field.required,
                            flagValues: field.flagValues || [],
                        };
                    });
                }
            });
        });

        const answeredFieldIds = new Set((answers || []).map((a) => String(a.fieldId)));
        const missingRequired = Object.keys(fieldMeta).filter(
            (fieldId) => fieldMeta[fieldId].required && !answeredFieldIds.has(fieldId)
        );
        if (missingRequired.length) {
            return res.status(400).json({
                message: "Missing required fields",
                missingFieldIds: missingRequired,
            });
        }

        const flaggedAnswers = (answers || []).map((a) => {
            const meta = fieldMeta[String(a.fieldId)];
            const flagValues = meta ? meta.flagValues : [];
            const flagged = flagValues.length > 0 && flagValues.includes(String(a.value));
            return { fieldId: a.fieldId, value: a.value, flagged };
        });

        // Incoming contract groups rows by table item:
        // [{ itemId, rows: [{ cells: [{ columnId, value }] }] }]
        // — flatten into the stored shape, one entry per row, tagged with its
        // table item id and position within that table.
        const flattenedTableRows = [];
        (tableRows || []).forEach((group) => {
            (group.rows || []).forEach((row, index) => {
                flattenedTableRows.push({
                    pageItemId: group.itemId,
                    sortOrder: index,
                    cells: row.cells || [],
                });
            });
        });

        const response = new FormResponse({
            formId,
            companyId,
            submittedBy,
            answers: flaggedAnswers,
            tableRows: flattenedTableRows,
        });
        await response.save();

        // If this submission fulfills an assignment, close it out.
        await FormAssignment.findOneAndUpdate(
            { formId, userId: submittedBy },
            { status: 'submitted', submittedAt: new Date(), responseId: response._id }
        );

        // A flagged answer is a safety concern — tell every Company Admin, not
        // just whoever happens to open the responses list later.
        const hasFlagged = flaggedAnswers.some((a) => a.flagged);
        if (hasFlagged) {
            const admins = await User.find({ companyId, role: 'client_admin' }).select('_id');
            await Promise.all(admins.map((admin) => createNotificationIfEnabled({
                userId: admin._id,
                companyId,
                settingCategory: 'safety',
                title: `Safety concern flagged in "${form.title}"`,
                type: 'warning',
                redirectTo: 'form',
                redirectId: formId,
            })));
        }

        res.status(201).json({
            success: true,
            message: "Form submitted successfully",
            data: response,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /forms/:formId/responses
// Admin review list — every submission for this form, newest first.
exports.getFormResponses = async (req, res) => {
    const { formId } = req.params;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const responses = await FormResponse.find({ formId }).sort({ submittedAt: -1 });
        res.status(200).json({ success: true, data: responses });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /forms/:formId/responses/:responseId
// One full submission — e.g. to render a review screen or a PDF.
exports.getFormResponseById = async (req, res) => {
    const { responseId } = req.params;

    try {
        const response = await FormResponse.findById(responseId);
        if (!response) {
            return res.status(404).json({ message: "Response not found" });
        }
        if (req.user.role === 'client_admin' && String(response.companyId) !== String(req.user.companyId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        res.status(200).json({ success: true, data: response });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /forms/:formId  (client_admin own company, or platform_admin any)
// Cascades to every response submitted for this form.
exports.deleteForm = async (req, res) => {
    const { formId } = req.params;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (!canAccessForm(req, form)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        await FormResponse.deleteMany({ formId });
        await Form.findByIdAndDelete(formId);

        res.status(200).json({ success: true, message: "Form deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
