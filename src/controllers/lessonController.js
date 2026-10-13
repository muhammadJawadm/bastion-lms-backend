const mongoose = require("mongoose");
const Courses = require("../models/Courses");
const Lesson = require("../models/Lesson");
const Enrollment = require("../models/Enrollments");

// client_admin can only touch lessons in their own company's courses;
// platform_admin (read/delete-only, enforced at the route) has no company
// restriction. Returns true if the caller may proceed.
const canAccessCourse = (req, course) =>
    req.user.role !== 'client_admin' || String(course.companyId) === String(req.user.companyId);

// POST /courses/:courseId/lessons   (or courseId in body)
// The "Add Lesson" modal — only needs a title. Seeds one empty text page.
exports.createLesson = async (req, res) => {
    const courseId = req.params.courseId || req.body.courseId;
    const { moduleId, title } = req.body;

    if (!title || !courseId) {
        return res.status(400).json({ message: "Title and Course ID are required" });
    }

    try {
        const course = await Courses.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }
        if (!canAccessCourse(req, course)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        // put the new lesson at the end of the sidebar list
        const lessonCount = await Lesson.countDocuments({ courseId });

        const newLesson = new Lesson({
            courseId,
            moduleId: moduleId || null,
            title,
            isRequired: true,
            sortOrder: lessonCount,
            blocks: [
                {
                    type: "text",
                    data: { html: `<h1>${title}</h1>` },
                    sortOrder: 0,
                },
            ],
        });

        await newLesson.save();
        res.status(201).json({
            success: true,
            message: "Lesson created successfully",
            data: newLesson,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /lessons/:lessonId
// Loads one lesson — title, settings, and all its pages (blocks) — for the
// lesson editor screen, without pulling the whole course.
exports.getLessonById = async (req, res) => {
    const { lessonId } = req.params;

    try {
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).json({ message: "Lesson not found" });
        }
        const course = await Courses.findById(lesson.courseId);
        if (!course || !canAccessCourse(req, course)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        res.status(200).json({ success: true, data: lesson });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /lessons/:lessonId
// Lesson settings panel — title, the REQUIRED toggle, sortOrder, moduleId.
// (Page/content edits go through updateBlock below, not here.)
exports.updateLesson = async (req, res) => {
    const { lessonId } = req.params;
    const { title, isRequired, sortOrder, moduleId, durationMinutes } = req.body;

    try {
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).json({ message: "Lesson not found" });
        }
        const course = await Courses.findById(lesson.courseId);
        if (!course || !canAccessCourse(req, course)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        if (title) lesson.title = title;
        if (isRequired !== undefined) lesson.isRequired = isRequired;
        if (sortOrder !== undefined) lesson.sortOrder = sortOrder;
        if (moduleId !== undefined) lesson.moduleId = moduleId;
        if (durationMinutes) lesson.durationMinutes = durationMinutes;
        await lesson.save();

        res.status(200).json({
            success: true,
            message: "Lesson updated successfully",
            data: lesson,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /lessons/:lessonId  (client_admin own company, or platform_admin any)
exports.deleteLesson = async (req, res) => {
    const { lessonId } = req.params;

    try {
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).json({ message: "Lesson not found" });
        }
        const course = await Courses.findById(lesson.courseId);
        if (!course || !canAccessCourse(req, course)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        await Lesson.findByIdAndDelete(lessonId);
        res.status(200).json({ success: true, message: "Lesson deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /lessons/:lessonId/blocks
// "+ New Page" — the type comes from the "Add Content to Page" modal,
// data is whatever that type's editor produces (see block data shapes).
exports.addBlock = async (req, res) => {
    const { lessonId } = req.params;
    const { type, title, data } = req.body;

    if (!type) {
        return res.status(400).json({ message: "Block type is required" });
    }

    try {
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).json({ message: "Lesson not found" });
        }
        const course = await Courses.findById(lesson.courseId);
        if (!course || !canAccessCourse(req, course)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const block = {
            type,
            title,
            data: data || {},
            sortOrder: lesson.blocks.length,
        };
        lesson.blocks.push(block);
        await lesson.save();

        res.status(201).json({
            success: true,
            message: "Page added successfully",
            data: lesson.blocks[lesson.blocks.length - 1],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /lessons/:lessonId/blocks/reorder
// Drag-reordering the page tabs — body: { order: [blockId, blockId, ...] }
// in the new left-to-right order. Rewrites every block's sortOrder in one
// document save (no bulkWrite needed — it's all one embedded array).
exports.reorderBlocks = async (req, res) => {
    const { lessonId } = req.params;
    const { order } = req.body;

    if (!Array.isArray(order) || !order.length) {
        return res.status(400).json({ message: "order must be a non-empty array of block ids" });
    }

    try {
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).json({ message: "Lesson not found" });
        }
        const course = await Courses.findById(lesson.courseId);
        if (!course || !canAccessCourse(req, course)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        // every id in `order` must be a block that actually belongs to this lesson,
        // and every existing block must be accounted for — otherwise one could
        // vanish (a stale sortOrder) or a wrong lesson's block could be smuggled in.
        const existingIds = lesson.blocks.map((b) => String(b._id));
        const sameSet =
            order.length === existingIds.length &&
            existingIds.every((id) => order.includes(id));
        if (!sameSet) {
            return res.status(400).json({ message: "order must contain exactly this lesson's block ids" });
        }

        order.forEach((blockId, index) => {
            lesson.blocks.id(blockId).sortOrder = index;
        });

        await lesson.save();

        res.status(200).json({
            success: true,
            message: "Pages reordered successfully",
            data: lesson.blocks,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /lessons/:lessonId/blocks/:blockId
// Autosave from a page's editor — updates that one page's content.
exports.updateBlock = async (req, res) => {
    const { lessonId, blockId } = req.params;
    const { type, title, data } = req.body;

    try {
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).json({ message: "Lesson not found" });
        }
        const course = await Courses.findById(lesson.courseId);
        if (!course || !canAccessCourse(req, course)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const block = lesson.blocks.id(blockId);
        if (!block) {
            return res.status(404).json({ message: "Page not found" });
        }

        if (type) block.type = type;
        if (title !== undefined) block.title = title;
        if (data !== undefined) block.data = data;
        await lesson.save();

        res.status(200).json({
            success: true,
            message: "Page updated successfully",
            data: block,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /lessons/:lessonId/blocks/:blockId
exports.deleteBlock = async (req, res) => {
    const { lessonId, blockId } = req.params;

    try {
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).json({ message: "Lesson not found" });
        }
        const course = await Courses.findById(lesson.courseId);
        if (!course || !canAccessCourse(req, course)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const block = lesson.blocks.id(blockId);
        if (!block) {
            return res.status(404).json({ message: "Page not found" });
        }

        lesson.blocks.pull(blockId);
        // close the gap so sortOrder stays a dense 0..n-1 sequence
        lesson.blocks
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .forEach((b, index) => { b.sortOrder = index; });
        await lesson.save();

        res.status(200).json({ success: true, message: "Page deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /lessons/:lessonId/topics
// Mobile "Chapter Topics" screen — a chapter's topics are this lesson's
// blocks; isCompleted/currentTopicIndex come from the enrollment (for this
// lesson's course) completedBlockIds, same pattern as Course Details' chapters.
exports.getChapterTopics = async (req, res) => {
    const { lessonId } = req.params;

    try {
        const lesson = await Lesson.findById(lessonId).lean();
        if (!lesson) {
            return res.status(404).json({ message: "Lesson not found" });
        }

        const enrollment = await Enrollment.findOne({
            courseId: lesson.courseId,
            userId: req.user.id,
        }).lean();
        if (!enrollment) {
            return res.status(404).json({ message: "You are not enrolled in this chapter's course" });
        }

        const completedBlockIds = new Set((enrollment.completedBlockIds || []).map(String));
        const blocks = (lesson.blocks || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

        const topics = blocks.map((block, index) => ({
            index,
            topicID: block._id,
            title: block.title,
            type: block.type,
            isCompleted: completedBlockIds.has(String(block._id)),
        }));
        const currentTopic = topics.find((t) => !t.isCompleted);

        res.status(200).json({
            success: true,
            data: {
                currentTopicIndex: currentTopic ? currentTopic.index : null,
                topics,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
