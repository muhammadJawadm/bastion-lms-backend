const mongoose = require("mongoose");
const Enrollment = require("../models/Enrollments");
const Course = require("../models/Courses");
const Lesson = require("../models/Lesson");

// The DB's enrollment.status has 5 values; the mobile "My Courses" screen
// only ever shows 3. overdue folds into inProgress, waived folds into
// completed (it's done, just not by actually finishing it).
const ENROLLMENT_STATUS_GROUPS = {
    notStarted: ["assigned"],
    inProgress: ["in_progress", "overdue"],
    completed: ["completed", "waived"],
};

const toMobileStatus = (status) => {
    if (status === "assigned") return "notStarted";
    if (status === "completed" || status === "waived") return "completed";
    return "inProgress"; // in_progress, overdue
};

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

// GET /enrollments/:id
// One assignment's detail — e.g. the mobile app's "My Training" detail screen.
exports.getEnrollmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const enrollment = await Enrollment.findById(id);
        if (!enrollment) {
            return res.status(404).json({ message: "Enrollment not found" });
        }

        res.status(200).json({ success: true, data: enrollment });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /enrollments/my-courses?perPage=&pageNo=&status=&query=
// Mobile "My Courses" list — every course the logged-in user is enrolled in.
exports.getMyCourses = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, query } = req.query;
        const limit = parseInt(req.query.perPage, 10) || 10;
        const page = parseInt(req.query.pageNo, 10) || 1;
        const skip = (page - 1) * limit;

        const match = { userId: new mongoose.Types.ObjectId(userId) };
        if (status && ENROLLMENT_STATUS_GROUPS[status]) {
            match.status = { $in: ENROLLMENT_STATUS_GROUPS[status] };
        }

        const pipeline = [
            { $match: match },
            { $lookup: { from: "courses", localField: "courseId", foreignField: "_id", as: "course" } },
            { $unwind: "$course" },
        ];
        if (query) {
            pipeline.push({ $match: { "course.title": { $regex: query, $options: "i" } } });
        }
        pipeline.push({ $sort: { updatedAt: -1 } });

        const [countResult, enrollments] = await Promise.all([
            Enrollment.aggregate([...pipeline, { $count: "total" }]),
            Enrollment.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
        ]);
        const total = countResult[0] ? countResult[0].total : 0;

        const data = enrollments.map((e) => {
            const mobileStatus = toMobileStatus(e.status);
            const item = {
                courseID: e.course._id,
                title: e.course.title,
                category: e.course.category,
                progress: e.progressPct,
                status: mobileStatus,
            };
            if (mobileStatus === "inProgress") item.lastActive = e.updatedAt;
            if (mobileStatus === "notStarted") item.estimated = e.course.durationMinutes;
            if (mobileStatus === "completed") item.completedOn = e.completionAt;
            return item;
        });

        res.status(200).json({
            success: true,
            data,
            pagination: { perPage: limit, pageNo: page, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /enrollments/my-courses/:courseId
// Mobile "Course Details" screen — chapters here are this course's Lessons;
// isCompleted/currentChapter come from the enrollment's completedLessonIds.
exports.getMyCourseDetails = async (req, res) => {
    try {
        const userId = req.user.id;
        const { courseId } = req.params;

        const [course, enrollment, lessons] = await Promise.all([
            Course.findById(courseId).lean(),
            Enrollment.findOne({ courseId, userId }).lean(),
            Lesson.find({ courseId }).sort({ sortOrder: 1 }).lean(),
        ]);

        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }
        if (!enrollment) {
            return res.status(404).json({ message: "You are not enrolled in this course" });
        }

        const completedLessonIds = new Set((enrollment.completedLessonIds || []).map(String));
        const chapters = lessons.map((lesson, index) => ({
            index,
            chapterID: lesson._id,
            title: lesson.title,
            isCompleted: completedLessonIds.has(String(lesson._id)),
        }));
        const currentChapter = chapters.find((c) => !c.isCompleted) || null;

        res.status(200).json({
            success: true,
            data: {
                courseID: course._id,
                title: course.title,
                category: course.category,
                description: course.description,
                totalChapters: chapters.length,
                completedChapters: chapters.filter((c) => c.isCompleted).length,
                progress: enrollment.progressPct,
                currentChapterId: currentChapter ? currentChapter.chapterID : null,
                chapters,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /enrollments/:id
// Employee completing lessons updates progress here; hitting 100% auto-completes it.
// An admin can also use this to change status directly (e.g. "waived").
// completedLessonId/completedBlockId each mark one more chapter/topic done
// (idempotent — the "mark complete" actions the mobile Course Details /
// Chapter Topics screens need to drive isCompleted).
exports.updateEnrollment = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, progressPct, dueDate, completedLessonId, completedBlockId } = req.body;

        const enrollment = await Enrollment.findById(id);
        if (!enrollment) {
            return res.status(404).json({ message: "Enrollment not found" });
        }

        if (completedLessonId) {
            const alreadyDone = enrollment.completedLessonIds.some(
                (lessonId) => String(lessonId) === String(completedLessonId)
            );
            if (!alreadyDone) enrollment.completedLessonIds.push(completedLessonId);
        }

        if (completedBlockId) {
            const alreadyDone = enrollment.completedBlockIds.some(
                (blockId) => String(blockId) === String(completedBlockId)
            );
            if (!alreadyDone) enrollment.completedBlockIds.push(completedBlockId);
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
