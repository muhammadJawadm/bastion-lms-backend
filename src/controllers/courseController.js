const mongoose = require("mongoose");
const Course = require("../models/Courses");


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
        const { courseId,title, description,status, durationMinutes, issuesCertificate, certificateTitle, passScore } = req.body;
        
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

