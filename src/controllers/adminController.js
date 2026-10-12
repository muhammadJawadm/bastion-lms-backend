const mongoose = require("mongoose");
const Company = require("../models/Company");
const User = require("../models/User");
const Course = require("../models/Courses");
const Form = require("../models/Forms");

// Every function here is platform_admin only — it can see across every
// company, unlike everything else in the app which is scoped to req.user's
// own companyId. The role gate itself lives on the routes (requireRole).

const searchRegex = (search) => ({ $regex: search, $options: "i" });

// GET /admin/companies?search=&industry=&isActive=
exports.getAllCompanies = async (req, res) => {
    try {
        const { search, industry, isActive } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [
                { name: searchRegex(search) },
                { contactName: searchRegex(search) },
                { contactEmail: searchRegex(search) },
            ];
        }
        if (industry) filter.industry = industry;
        if (isActive !== undefined) filter.isActive = isActive === "true";

        const companies = await Company.find(filter).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: companies });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /admin/users?search=&role=&companyId=
exports.getAllUsers = async (req, res) => {
    try {
        const { search, role, companyId } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [{ name: searchRegex(search) }, { email: searchRegex(search) }];
        }
        if (role) filter.role = role;
        if (companyId) filter.companyId = companyId;

        const users = await User.find(filter).select("-password").sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /admin/courses?search=&status=&category=&companyId=
exports.getAllCourses = async (req, res) => {
    try {
        const { search, status, category, companyId } = req.query;
        const filter = {};

        if (search) filter.title = searchRegex(search);
        if (status) filter.status = status;
        if (category) filter.category = category;
        if (companyId) filter.companyId = companyId;

        const courses = await Course.find(filter).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: courses });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /admin/forms?search=&status=&companyId=
exports.getAllForms = async (req, res) => {
    try {
        const { search, status, companyId } = req.query;
        const filter = {};

        if (search) filter.title = searchRegex(search);
        if (status) filter.status = status;
        if (companyId) filter.companyId = companyId;

        const forms = await Form.find(filter).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: forms });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
