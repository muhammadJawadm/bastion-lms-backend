const Course = require("../models/Courses");
const Lesson = require("../models/Lesson");

// Modules live embedded on Course.modules (same pattern as blocks on Lesson),
// not a separate collection — Lesson.moduleId just points at that subdocument's _id.

// client_admin can only touch modules on their own company's courses;
// platform_admin (read/delete-only, enforced at the route) has no restriction.
const canAccessCourse = (req, course) =>
    req.user.role !== 'client_admin' || String(course.companyId) === String(req.user.companyId);

// POST /courses/:courseId/modules
exports.addModule = async (req, res) => {
    const { courseId } = req.params;
    const { title, description, sortOrder } = req.body;

    if (!title) {
        return res.status(400).json({ message: "Title is required" });
    }

    try {
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }
        if (!canAccessCourse(req, course)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const module = {
            title,
            description,
            sortOrder: sortOrder !== undefined ? sortOrder : course.modules.length,
        };
        course.modules.push(module);
        await course.save();

        res.status(201).json({
            success: true,
            message: "Module added successfully",
            data: course.modules[course.modules.length - 1],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /courses/:courseId/modules
exports.getModules = async (req, res) => {
    const { courseId } = req.params;

    try {
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }
        if (!canAccessCourse(req, course)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        res.status(200).json({ success: true, data: course.modules });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /modules/:moduleId
exports.updateModule = async (req, res) => {
    const { moduleId } = req.params;
    const { title, description, sortOrder } = req.body;

    try {
        const course = await Course.findOne({ "modules._id": moduleId });
        if (!course) {
            return res.status(404).json({ message: "Module not found" });
        }
        if (!canAccessCourse(req, course)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const module = course.modules.id(moduleId);
        if (title !== undefined) module.title = title;
        if (description !== undefined) module.description = description;
        if (sortOrder !== undefined) module.sortOrder = sortOrder;
        await course.save();

        res.status(200).json({
            success: true,
            message: "Module updated successfully",
            data: module,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /modules/:moduleId
// Unassigns (moduleId -> null) every lesson pointed at this module first —
// a module is just a grouping label, so deleting it must not take lessons with it.
exports.deleteModule = async (req, res) => {
    const { moduleId } = req.params;

    try {
        const course = await Course.findOne({ "modules._id": moduleId });
        if (!course) {
            return res.status(404).json({ message: "Module not found" });
        }
        if (!canAccessCourse(req, course)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        await Lesson.updateMany({ moduleId }, { $set: { moduleId: null } });

        course.modules.pull(moduleId);
        await course.save();

        res.status(200).json({ success: true, message: "Module deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
