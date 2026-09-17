const mongoose = require("mongoose");

const Otp = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, default: Date.now, required: true },
    verified: { type: Boolean, default: false }, // set true by verify-reset-otp; gates reset-password
});

module.exports = mongoose.model("Otp", Otp);
