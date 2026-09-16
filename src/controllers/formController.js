const mongoose = require("mongoose");
const Form = require("../models/Forms");

// POST /forms
// Step 1 — the "title + description" screen. Creates the form and
// redirects to the form builder page, same pattern as createCourse.
exports.createForm = async (req, res) => {
    const { title, description, companyId, ownerId } = req.body;

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

// PATCH /forms/:formId
// Form settings — title, description, status (draft/published), owner.
exports.updateForm = async (req, res) => {
    const { formId } = req.params;
    const { title, description, status, ownerId } = req.body;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }

        if (title) form.title = title;
        if (description !== undefined) form.description = description;
        if (status) form.status = status;
        if (ownerId) form.ownerId = ownerId;
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
    const { type, label, helpText, required, options, answerSetId, minRating, maxRating, flagValues } = req.body;

    if (!type) {
        return res.status(400).json({ message: "Field type is required" });
    }

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
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
            minRating,
            maxRating,
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
    const { type, label, helpText, required, options, answerSetId, minRating, maxRating, flagValues } = req.body;

    try {
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
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
        if (minRating !== undefined) field.minRating = minRating;
        if (maxRating !== undefined) field.maxRating = maxRating;
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
