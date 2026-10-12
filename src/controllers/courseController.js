const mongoose = require("mongoose");
const Course = require("../models/Courses");
const Lesson = require("../models/Lesson");
const Enrollment = require("../models/Enrollments");


exports.createCourse = async (req, res) => {
    try {
        const { title, description, companyId , coverImageUrl, createdBy } = req.body;
        if(!title || !companyId){
            return res.status(400).json({ message: "Title and Company ID are required" });
        }

        const newCourse = new Course({
            title,
            description,
            companyId,
            coverImageUrl,
            createdBy,
            status: "draft",
            modules: [],
        });

        await newCourse.save();
        res.status(201).json({ 
            success: true,
            message: "Course created successfully",
            data: newCourse
         });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.createCourseSetting  = async (req, res) => {
    try {
        const { courseId,title, description,status, durationMinutes, issuesCertificate, certificateTitle, passScore, coverImageUrl } = req.body;

        if(!courseId){
            return res.status(400).json({ message: "Course ID is required" });
        }

        const course = await Course.findById(courseId);
        if(!course){
            return res.status(404).json({ message: "Course not found" });
        }
        if(title) course.title = title;
        if(description) course.description = description;
        if(status) course.status = status;
        if(durationMinutes) course.durationMinutes = durationMinutes;
        if(issuesCertificate !== undefined) course.issuesCertificate = issuesCertificate;
        if(certificateTitle) course.certificateTitle = certificateTitle;
        if(passScore) course.passScore = passScore;
        if(coverImageUrl !== undefined) course.coverImageUrl = coverImageUrl;
        await course.save();
        res.status(201).json({ 
            success: true,
            message: "Course settings updated successfully",
            data: course
         });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
}

// GET /courses?companyId=&search=&status=&category=
// The Courses list page — company-scoped. (companyId: null library courses
// are excluded here on purpose — see getCourseLibrary for those.)
// Each course comes back with lessonCount/enrollmentCount pre-computed so the
// frontend doesn't need a follow-up call per card.
exports.getCourses = async (req, res) => {
    try {
        const { companyId, search, status, category } = req.query;

        if (!companyId) {
            return res.status(400).json({ message: "Company ID is required" });
        }

        const filter = { companyId };
        if (status) filter.status = status;
        if (category) filter.category = category;
        if (search) filter.title = { $regex: search, $options: "i" };

        const courses = await Course.find(filter).sort({ updatedAt: -1 }).lean();
        const courseIds = courses.map((c) => c._id);

        const [lessonCounts, enrollmentCounts] = await Promise.all([
            Lesson.aggregate([
                { $match: { courseId: { $in: courseIds } } },
                { $group: { _id: "$courseId", count: { $sum: 1 } } },
            ]),
            Enrollment.aggregate([
                { $match: { courseId: { $in: courseIds } } },
                { $group: { _id: "$courseId", count: { $sum: 1 } } },
            ]),
        ]);

        const lessonCountByCourse = {};
        lessonCounts.forEach((l) => { lessonCountByCourse[String(l._id)] = l.count; });
        const enrollmentCountByCourse = {};
        enrollmentCounts.forEach((e) => { enrollmentCountByCourse[String(e._id)] = e.count; });

        const data = courses.map((course) => ({
            ...course,
            lessonCount: lessonCountByCourse[String(course._id)] || 0,
            enrollmentCount: enrollmentCountByCourse[String(course._id)] || 0,
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /courses/:courseId
// Mobile "course detail" screen — the course plus every lesson and every
// page (block) inside each lesson, all in one call.
exports.getCourseDetails = async (req, res) => {
    try {
        const { courseId } = req.params;

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        const lessons = await Lesson.find({ courseId }).sort({ sortOrder: 1 });

        res.status(200).json({
            success: true,
            data: {
                ...course.toObject(),
                lessons,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /courses/library?companyId=...
// The Course Library screen — every companyId:null course, flagged with
// "added" so the frontend can show ADDED vs ADD TO COMPANY per card.
exports.getCourseLibrary = async (req, res) => {
    try {
        const { companyId } = req.query;

        const libraryCourses = await Course.find({ companyId: null }).lean();

        let addedSourceIds = [];
        if (companyId) {
            const myCopies = await Course.find({
                companyId,
                sourceLibraryCourseId: { $ne: null },
            }).select('sourceLibraryCourseId').lean();
            addedSourceIds = myCopies.map((c) => String(c.sourceLibraryCourseId));
        }

        const data = libraryCourses.map((course) => ({
            ...course,
            added: addedSourceIds.includes(String(course._id)),
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /courses/library/:id/add-to-company
// "ADD TO COMPANY" — deep-copies the library course (and its lessons/pages)
// into the requesting company as a brand-new, independently editable course.
exports.addToCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { companyId, createdBy } = req.body;

        if (!companyId) {
            return res.status(400).json({ message: "Company ID is required" });
        }

        const libraryCourse = await Course.findOne({ _id: id, companyId: null }).lean();
        if (!libraryCourse) {
            return res.status(404).json({ message: "Library course not found" });
        }

        const existing = await Course.findOne({ companyId, sourceLibraryCourseId: libraryCourse._id });
        if (existing) {
            return res.status(400).json({
                message: "This course has already been added to your company",
                data: existing,
            });
        }

        const newCourse = new Course({
            title: libraryCourse.title,
            description: libraryCourse.description,
            category: libraryCourse.category,
            durationMinutes: libraryCourse.durationMinutes,
            certificateTitle: libraryCourse.certificateTitle,
            coverImageUrl: libraryCourse.coverImageUrl,
            passScore: libraryCourse.passScore,
            issuesCertificate: libraryCourse.issuesCertificate,
            modules: (libraryCourse.modules || []).map((m) => ({
                title: m.title,
                description: m.description,
                sortOrder: m.sortOrder,
            })),
            companyId,
            createdBy,
            status: "draft",
            sourceLibraryCourseId: libraryCourse._id,
        });
        await newCourse.save();

        const libraryLessons = await Lesson.find({ courseId: libraryCourse._id }).lean();
        if (libraryLessons.length) {
            const copiedLessons = libraryLessons.map((lesson) => ({
                courseId: newCourse._id,
                moduleId: null, // old module ids no longer apply — modules were just regenerated above
                title: lesson.title,
                isRequired: lesson.isRequired,
                sortOrder: lesson.sortOrder,
                blocks: (lesson.blocks || []).map((b) => ({
                    type: b.type,
                    data: b.data,
                    sortOrder: b.sortOrder,
                })),
                chapters: (lesson.chapters || []).map((c) => ({
                    title: c.title,
                    sortOrder: c.sortOrder,
                })),
            }));
            await Lesson.insertMany(copiedLessons);
        }

        res.status(201).json({
            success: true,
            message: "Course added to your company successfully",
            data: newCourse,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

