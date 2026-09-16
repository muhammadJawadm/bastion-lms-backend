const mongoose = require("mongoose");
const Company = require("../models/Company");

// GET /company/:companyId
// Loads Settings — one document backs all three tabs (Profile, Branding, Notifications).
exports.getCompanyProfile = async (req, res) => {
    const { companyId } = req.params;

    try {
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        res.status(200).json({
            success: true,
            data: company,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /company/:companyId/profile
// "COMPANY PROFILE" tab.
exports.updateCompanyProfile = async (req, res) => {
    const { companyId } = req.params;
    const { name, industry, contactName, contactEmail, contactPhone, city, state } = req.body;

    try {
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        if (name) company.name = name;
        if (industry) company.industry = industry;
        if (contactName) company.contactName = contactName;
        if (contactEmail) company.contactEmail = contactEmail;
        if (contactPhone) company.contactPhone = contactPhone;
        if (city) company.city = city;
        if (state) company.state = state;
        await company.save();

        res.status(200).json({
            success: true,
            message: "Company profile updated successfully",
            data: company,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /company/:companyId/branding
// "BRANDING" tab — Professional plan feature (plan-gating enforced by the frontend for now).
exports.updateBranding = async (req, res) => {
    const { companyId } = req.params;
    const { logoUrl, primaryColor, accentColor } = req.body;

    try {
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        if (logoUrl !== undefined) company.branding.logoUrl = logoUrl;
        if (primaryColor) company.branding.primaryColor = primaryColor;
        if (accentColor) company.branding.accentColor = accentColor;
        await company.save();

        res.status(200).json({
            success: true,
            message: "Branding updated successfully",
            data: company.branding,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /company/:companyId/notifications
// "NOTIFICATION SETTINGS" tab — each toggle is independent, send only what changed.
exports.updateNotificationPreferences = async (req, res) => {
    const { companyId } = req.params;
    const {
        trainingDueReminders,
        overdueTrainingAlerts,
        courseCompletionNotifications,
        certificateExpirationWarnings,
        newCourseAssignments,
        weeklyComplianceDigest,
    } = req.body;

    try {
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        const prefs = company.notificationPreferences;
        if (trainingDueReminders !== undefined) prefs.trainingDueReminders = trainingDueReminders;
        if (overdueTrainingAlerts !== undefined) prefs.overdueTrainingAlerts = overdueTrainingAlerts;
        if (courseCompletionNotifications !== undefined) prefs.courseCompletionNotifications = courseCompletionNotifications;
        if (certificateExpirationWarnings !== undefined) prefs.certificateExpirationWarnings = certificateExpirationWarnings;
        if (newCourseAssignments !== undefined) prefs.newCourseAssignments = newCourseAssignments;
        if (weeklyComplianceDigest !== undefined) prefs.weeklyComplianceDigest = weeklyComplianceDigest;
        await company.save();

        res.status(200).json({
            success: true,
            message: "Notification preferences updated successfully",
            data: company.notificationPreferences,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
