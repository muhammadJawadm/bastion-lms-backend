const mongoose = require("mongoose");
const Enrollment = require("../models/Enrollments");

// POST /enrollments
// Admin assigns a course to an employee.
exports.createEnrollment = async (req, res) => {
    try {
        const { courseId, userId, companyId, dueDate } = req.body;

        if (!courseId || !userId || !companyId) {
            return res.status(400).json({ message: "Course ID, User ID and Company ID are required" });
        }

        const newEnrollment = new Enrollment({
            courseId,
            userId,
            companyId,
            dueDate: dueDate || null,
            status: "assigned",
            progressPct: 0,
        });

        await newEnrollment.save();
        res.status(201).json({
            success: true,
            message: "Course assigned successfully",
            data: newEnrollment,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /enrollments/:id
// Employee completing lessons updates progress here; hitting 100% auto-completes it.
// An admin can also use this to change status directly (e.g. "waived").
exports.updateEnrollment = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, progressPct, dueDate } = req.body;

        const enrollment = await Enrollment.findById(id);
        if (!enrollment) {
            return res.status(404).json({ message: "Enrollment not found" });
        }

        if (progressPct !== undefined) {
            enrollment.progressPct = progressPct;
            if (progressPct >= 100) {
                enrollment.status = "completed";
                enrollment.completionAt = new Date();
            } else if (enrollment.status === "assigned") {
                enrollment.status = "in_progress";
            }
        }

        if (status) {
            enrollment.status = status;
            if (status === "completed" && !enrollment.completionAt) {
                enrollment.completionAt = new Date();
            }
        }

        if (dueDate) enrollment.dueDate = dueDate;

        await enrollment.save();
        res.status(200).json({
            success: true,
            message: "Enrollment updated successfully",
            data: enrollment,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /enrollments/:id
// Admin unassigns a course from an employee.
exports.deleteEnrollment = async (req, res) => {
    try {
        const { id } = req.params;
        const enrollment = await Enrollment.findByIdAndDelete(id);
        if (!enrollment) {
            return res.status(404).json({ message: "Enrollment not found" });
        }

        res.status(200).json({
            success: true,
            message: "Enrollment deleted successfully",
            data: enrollment,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
