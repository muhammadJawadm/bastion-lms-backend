const mongoose = require("mongoose");
const Enrollment = require("../models/Enrollments");
const Course = require("../models/Courses");
const Lesson = require("../models/Lesson");
const { issueCertificateIfEligible } = require("./certificateController");

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

// GET /enrollments?companyId=&courseId=&userId=&status=&search=&perPage=&pageNo=
// The admin-facing list — Dashboard/Employees/Assignments/MyTraining all read
// from this. Returns the raw 5-value status (assigned/in_progress/overdue/
// completed/waived), unlike the mobile 3-value mapping on /enrollments/my-courses.
exports.getEnrollments = async (req, res) => {
    try {
        let companyId = req.query.companyId;
        if (req.user.role === 'client_admin') companyId = req.user.companyId;
        if (!companyId && req.user.role !== 'platform_admin') {
            return res.status(400).json({ message: "Company ID is required" });
        }

        const { courseId, userId, status, search } = req.query;
        const limit = parseInt(req.query.perPage, 10) || 50;
        const page = parseInt(req.query.pageNo, 10) || 1;
        const skip = (page - 1) * limit;

        const match = {};
        if (companyId) match.companyId = new mongoose.Types.ObjectId(companyId);
        if (courseId) match.courseId = new mongoose.Types.ObjectId(courseId);
        if (userId) match.userId = new mongoose.Types.ObjectId(userId);
        if (status) match.status = status;

        const pipeline = [
            { $match: match },
            { $lookup: { from: "courses", localField: "courseId", foreignField: "_id", as: "course" } },
            { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
            { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        ];
        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { "course.title": { $regex: search, $options: "i" } },
                        { "user.name": { $regex: search, $options: "i" } },
                        { "user.email": { $regex: search, $options: "i" } },
                    ],
                },
            });
        }
        pipeline.push({ $sort: { updatedAt: -1 } });

        const [countResult, enrollments] = await Promise.all([
            Enrollment.aggregate([...pipeline, { $count: "total" }]),
            Enrollment.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
        ]);
        const total = countResult[0] ? countResult[0].total : 0;

        const data = enrollments.map((e) => ({
            _id: e._id,
            courseId: e.courseId,
            courseTitle: e.course ? e.course.title : null,
            userId: e.userId,
            userName: e.user ? e.user.name : null,
            userEmail: e.user ? e.user.email : null,
            companyId: e.companyId,
            status: e.status,
            progressPct: e.progressPct,
            dueDate: e.dueDate,
            completionAt: e.completionAt,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
        }));

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

// POST /enrollments
// Admin assigns a course to an employee.
exports.createEnrollment = async (req, res) => {
    try {
        const { courseId, userId, dueDate } = req.body;
        // route is client_admin-only — always their own company
        const companyId = req.user.companyId;

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

        if (req.user.role === 'user' && String(enrollment.userId) !== String(req.user.id)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (req.user.role === 'client_admin' && String(enrollment.companyId) !== String(req.user.companyId)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        // platform_admin can view any enrollment

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
                enrollmentId: e._id,
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
                timeSpent: enrollment.timeSpentMinutes || 0,
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
// A Company Admin can also use this to change status directly (e.g. "waived").
// completedLessonId/completedBlockId each mark one more chapter/topic done
// (idempotent — the "mark complete" actions the mobile Course Details /
// Chapter Topics screens need to drive isCompleted).
// platform_admin is view-only (+ delete) across the app, so it never reaches
// here — this endpoint is client_admin (any field, own company) or the
// enrollment's own user (progress/completion fields only).
exports.updateEnrollment = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, progressPct, dueDate, completedLessonId, completedBlockId, addTimeSpentMinutes } = req.body;

        const enrollment = await Enrollment.findById(id);
        if (!enrollment) {
            return res.status(404).json({ message: "Enrollment not found" });
        }
        const wasAlreadyCompleted = enrollment.status === "completed";

        if (req.user.role === 'user') {
            if (String(enrollment.userId) !== String(req.user.id)) {
                return res.status(403).json({ message: "Forbidden" });
            }
            if (status !== undefined || dueDate !== undefined) {
                return res.status(403).json({ message: "Only progressPct, completedLessonId, completedBlockId and addTimeSpentMinutes can be set by the enrolled user" });
            }
        } else if (req.user.role === 'client_admin') {
            if (String(enrollment.companyId) !== String(req.user.companyId)) {
                return res.status(403).json({ message: "Forbidden" });
            }
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

        // a delta to add, not an absolute value — each study session reports
        // how many minutes it covered, and they accumulate across sessions.
        if (addTimeSpentMinutes !== undefined) {
            if (typeof addTimeSpentMinutes !== 'number' || addTimeSpentMinutes < 0) {
                return res.status(400).json({ message: "addTimeSpentMinutes must be a non-negative number" });
            }
            enrollment.timeSpentMinutes = (enrollment.timeSpentMinutes || 0) + addTimeSpentMinutes;
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

        // Newly completed (not already) — issue a certificate if the course grants one.
        if (!wasAlreadyCompleted && enrollment.status === "completed") {
            const course = await Course.findById(enrollment.courseId).lean();
            await issueCertificateIfEligible(enrollment, course);
        }

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
        const existing = await Enrollment.findById(id);
        if (!existing) {
            return res.status(404).json({ message: "Enrollment not found" });
        }
        if (req.user.role === 'client_admin' && String(existing.companyId) !== String(req.user.companyId)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const enrollment = await Enrollment.findByIdAndDelete(id);

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
