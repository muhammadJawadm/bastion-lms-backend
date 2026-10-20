const Notification = require("../models/Notification");
const User = require("../models/User");

// Internal helper — other controllers call this to raise a notification
// (course assigned, form assigned, certificate issued, safety flag, etc.).
// Not a route. Checks the recipient's own notificationSettings first and
// silently skips if they've turned that category off; never throws, so a
// notification failure can't take down the action that triggered it.
const SETTINGS_KEY_FOR_TYPE = {
    course: 'courseAssignmentAlert',
    form: 'formAssignmentAlert',
    completion: 'completionNotification',
    safety: 'safetyTaskAlert',
    deadline: 'deadlineReminder',
};

exports.createNotificationIfEnabled = async ({ userId, settingCategory, title, type, buttonText, redirectTo, redirectId, companyId }) => {
    try {
        const settingKey = SETTINGS_KEY_FOR_TYPE[settingCategory];
        if (settingKey) {
            const user = await User.findById(userId).select('notificationSettings');
            if (!user) return null;
            const enabled = user.notificationSettings ? user.notificationSettings[settingKey] : true;
            if (enabled === false) return null;
        }

        return await Notification.create({
            userId,
            companyId: companyId || null,
            title,
            type: type || 'default',
            buttonText: buttonText || null,
            redirectTo: redirectTo || null,
            redirectId: redirectId || null,
        });
    } catch (error) {
        console.error('Failed to create notification:', error.message);
        return null;
    }
};

// GET /notifications?perPage=&pageNo=
// Fetching the list marks every notification returned as read — that's
// what makes isNew flip from true to false between the first fetch and
// later ones (the badge count comes from counting isNew:true beforehand).
exports.getNotifications = async (req, res) => {
    try {
        const limit = parseInt(req.query.perPage, 10) || 20;
        const page = parseInt(req.query.pageNo, 10) || 1;
        const skip = (page - 1) * limit;

        const filter = { userId: req.user.id };

        const [total, notifications] = await Promise.all([
            Notification.countDocuments(filter),
            Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        ]);

        const data = notifications.map((n) => ({
            notificationID: n._id,
            createdAt: n.createdAt,
            title: n.title,
            isNew: !n.isRead,
            type: n.type,
            buttonText: n.buttonText,
            redirectTo: n.redirectTo,
            redirectId: n.redirectId,
        }));

        const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n._id);
        if (unreadIds.length) {
            await Notification.updateMany({ _id: { $in: unreadIds } }, { $set: { isRead: true } });
        }

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

// GET /notifications/settings
exports.getNotificationSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('notificationSettings');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ success: true, data: user.notificationSettings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /notifications/settings — each toggle is independent, send only what changed
exports.updateNotificationSettings = async (req, res) => {
    try {
        const {
            courseAssignmentAlert,
            deadlineReminder,
            completionNotification,
            safetyTaskAlert,
            formAssignmentAlert,
        } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const settings = user.notificationSettings;
        if (courseAssignmentAlert !== undefined) settings.courseAssignmentAlert = courseAssignmentAlert;
        if (deadlineReminder !== undefined) settings.deadlineReminder = deadlineReminder;
        if (completionNotification !== undefined) settings.completionNotification = completionNotification;
        if (safetyTaskAlert !== undefined) settings.safetyTaskAlert = safetyTaskAlert;
        if (formAssignmentAlert !== undefined) settings.formAssignmentAlert = formAssignmentAlert;
        await user.save();

        res.status(200).json({ success: true, message: "Notification settings updated successfully", data: user.notificationSettings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
