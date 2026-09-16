const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const otpGenerator = require('otp-generator');
const Otp = require('../models/Otp');
const sendEmail = require('../utils/sendEmail');
const jwt = require('../utils/jwt');
exports.registerUser = async (req, res) => {
    try {
        let { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }
        email = email.trim().toLowerCase();
        // Convert email to lowercase
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashedPassword });

        const otp = otpGenerator.generate(6, { digits: true, upperCase: false, lowerCase: false, specialChars: false });

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

        const otpEntry = new Otp({
            userId: user._id,
            otp: otp,
            expiresAt: expiresAt
        });

        await otpEntry.save();

        await sendEmail(email, otp);

        const token = jwt.generateToken(user._id, user.role);

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /users  (company admin only, once you wire auth — see note below)
// Admin-side "Add Employee" — no OTP, the admin is vetting the account directly.
exports.addEmployee = async (req, res) => {
    try {
        const { name, email, password, role, companyId, department, jobTitle, invitedBy } = req.body;

        if (!name || !email || !password || !role || !companyId) {
            return res.status(400).json({ message: 'Name, email, password, role and companyId are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'A user with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            role,
            companyId,
            department,
            jobTitle,
            invitedBy,
            mustChangePassword: true, // employee must set their own password on first login
            is_verified: true,        // admin already vetted this account, skip OTP
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                companyId: newUser.companyId,
                department: newUser.department,
                jobTitle: newUser.jobTitle,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.verifyOtp = async (req, res) => {
   const { email, otp } = req.body;
   if (!email || !otp) {
       return res.status(400).json({ message: 'Email and OTP are required' });
   }
   const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ message: 'User does not exist' });
    }

    const otpEntry = await Otp.findOne({ userId: user._id });
    if (!otpEntry) {
        return res.status(400).json({ message: 'OTP not found' });
    }

    if(otpEntry.expiresAt < new Date()|| otpEntry.otp !== otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
    }
    user.is_verified = true;
    await user.save();

    await Otp.deleteOne({ userId: user._id });

    res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
};

exports.resendOtp = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }
    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ message: 'User does not exist' });
    }
    
    if(user.is_verified) {
        return res.status(400).json({ message: 'User is already verified' });
    }
    await Otp.deleteMany({ userId: user._id });

    const otp = otpGenerator.generate(6, { digits: true, upperCase: false, lowerCase: false, specialChars: false });

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

    const otpEntry = new Otp({
        userId: user._id,
        otp: otp,
        expiresAt: expiresAt
    });

    await otpEntry.save();

    await sendEmail(email, otp);

    res.status(200).json({
        success: true,
        message: "OTP resent successfully"
    });
};

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Delete any existing OTP for this user
        await Otp.deleteMany({ userId: user._id });

        // Generate new OTP
        const otp = otpGenerator.generate(6, { digits: true, upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
        const expiresAt = new Date(Date.now() + 300000); // 5 minutes

        // Save OTP
        const otpEntry = new Otp({ userId: user._id, otp, expiresAt });
        await otpEntry.save();

        // Send OTP email
        await sendEmail(email, otp);

        res.status(200).json({ success: true, message: "OTP sent to your email" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Verify Reset OTP
exports.verifyResetOTP = async (req, res) => {
    const { email, otp } = req.body;
    try {
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Find OTP
        const otpEntry = await Otp.findOne({ userId: user._id });
        if (!otpEntry) {
            return res.status(404).json({ success: false, message: "OTP not found or expired" });
        }

        // Verify OTP
        if (otpEntry.otp !== otp || otpEntry.expiresAt < Date.now()) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }

        // OTP is valid - don't delete, keep it for password reset
        res.status(200).json({
            success: true,
            message: "OTP verified successfully. You can now reset your password.",
            resetToken: user._id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    const { email, password, confirmPassword } = req.body;
    try {
        // Validate password match
        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Check if OTP exists and is still valid (user must have verified OTP in step 2)
        const otpEntry = await Otp.findOne({ userId: user._id });
        if (!otpEntry) {
            return res.status(400).json({ success: false, message: "Please verify OTP first before resetting password" });
        }

        // Check OTP hasn't expired
        if (otpEntry.expiresAt < Date.now()) {
            await Otp.deleteOne({ userId: user._id });
            return res.status(400).json({ success: false, message: "OTP expired. Please request a new one." });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update password
        user.password = hashedPassword;
        await user.save();

        // Delete OTP (cleanup - only deleted once here)
        await Otp.deleteOne({ userId: user._id });

        res.status(200).json({ success: true, message: "Password reset successfully. You can now login with your new password." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if(!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User does not exist' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        const token = jwt.generateToken(user._id, user.role);
        user.lastLoginAt = new Date();
        await user.save();

        res.status(200).json({
            success: true,
            message: "User logged in successfully",
            token,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                companyId: user.companyId,
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const id = req.params.id;
        const user = await User.findByIdAndUpdate(id, req.body, { new: true });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: user
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const id = req.params.id;
        const { currentPassword,newPassword, confirmPassword } = req.body;
        if(!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ message: 'Current password, new password, and confirm password are required' });
        }
        if(newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New password and confirm password do not match' });
        }
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.updatedAt = new Date();
        await user.save();
        res.status(200).json({
            success: true,
            message: 'Password changed successfully',
            data: user
        });
    } catch (error) {    
        res.status(500).json({ message: error.message });
    }
};

exports.getUser = async (req, res) => {
    try {
        const id = req.params.id;
        const user = await User.findById(id).select('-password'); // Exclude password from the response
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({
            success: true,
            message: 'User retrieved successfully',
            data: user
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        if(!req.user||!req.user.id)
        {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ message: 'User ID is required' });
        }
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({
            success: true,
            message: 'User deleted successfully',
            data: user
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};