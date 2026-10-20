const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        default: null,
    },
    title: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['default', 'course', 'form', 'success', 'warning'],
        default: 'default',
    },
    buttonText: {
        type: String,
        default: null,
    },
    // what tapping the notification opens — redirectId's collection depends
    // on redirectTo, so it's deliberately untyped/unref'd (polymorphic).
    redirectTo: {
        type: String,
        enum: ['course', 'form', 'certificate', null],
        default: null,
    },
    redirectId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    // DB name is isRead (false = not yet seen); the API exposes the inverse
    // as isNew so "true" reads naturally as "this is new" on first fetch —
    // see notificationController.getNotifications.
    isRead: {
        type: Boolean,
        default: false,
    },
},
    { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
