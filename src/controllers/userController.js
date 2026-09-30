const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const bcrypt = require('bcryptjs');
const otpGenerator = require('otp-generator');
const Otp = require('../models/Otp');
const { sendEmail, sendCredentialsEmail } = require('../utils/sendEmail');
const jwt = require('../utils/jwt');

// POST /users/register
// Company admin signup — creates the Company (tenant) and its first
// client_admin user together, since employees never self-register
// (see addEmployee) and platform_admin accounts are seeded, not signed up.
// No token here on purpose — the account is unverified until the OTP is
// confirmed (see verifyOtp), and only /login ever hands out a token.
exports.registerUser = async (req, res) => {
    try {
        let { name, email, password, companyName } = req.body;
        if (!name || !email || !password || !companyName) {
            return res.status(400).json({ message: 'Name, email, password, and companyName are required' });
        }
        email = email.trim().toLowerCase();
        // Convert email to lowercase
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const company = await Company.create({ name: companyName });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'client_admin',
            companyId: company._id,
        });

        const otp = otpGenerator.generate(6, { digits: true, upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

        const otpEntry = new Otp({
            userId: user._id,
            otp: otp,
            expiresAt: expiresAt
        });

        await otpEntry.save();

        // Email delivery isn't configured in every environment — don't let a failed
        // send take down account creation itself.
        try {
            await sendEmail(email, otp);
        } catch (emailError) {
            console.error('OTP email failed to send:', emailError.message);
        }

        res.status(201).json({
            success: true,
            message: "User registered successfully. Please verify the OTP sent to your email before logging in.",
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                companyId: company._id,
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

// POST /users  (admin-side "Add User" — no restriction yet on which role can call this)
// Same shape as addEmployee, but always creates a plain "user" account.
exports.addUser = async (req, res) => {
    try {
        const { name, email, password, companyId, department, jobTitle, invitedBy } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email and password are required' });
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
            role: 'user',
            companyId,
            department,
            jobTitle,
            invitedBy,
            mustChangePassword: true,
            is_verified: true,
        });

        // Mobile user's only way to learn their password — don't let a failed
        // send take down account creation itself.
        try {
            await sendCredentialsEmail(normalizedEmail, password, name);
        } catch (emailError) {
            console.error('Credentials email failed to send:', emailError.message);
        }

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

// GET /users/employees?companyId=&search=&department=&role=&isActive=
// The Employees list page — company-scoped, defaults to role: employee
// (pass role=client_admin to see admins instead, or omit companyId's role
// filter entirely by passing role=all).
exports.getEmployees = async (req, res) => {
    try {
        const { companyId, search, department, role, isActive } = req.query;

        if (!companyId) {
            return res.status(400).json({ message: 'Company ID is required' });
        }

        const filter = { companyId };

        if (!role || role === 'employee') {
            filter.role = 'employee';
        } else if (role !== 'all') {
            filter.role = role;
        }
        if (department) filter.department = department;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { jobTitle: { $regex: search, $options: 'i' } },
            ];
        }

        const employees = await User.find(filter).select('-password').sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: employees });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Account-verification OTP — must succeed before /login will issue a token.
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }
        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
            return res.status(400).json({ message: 'User does not exist' });
        }

        const otpEntry = await Otp.findOne({ userId: user._id });
        if (!otpEntry) {
            return res.status(400).json({ message: 'OTP not found' });
        }

        if (otpEntry.expiresAt < new Date() || otpEntry.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }
        user.is_verified = true;
        await user.save();

        await Otp.deleteOne({ userId: user._id });

        res.status(200).json({
            success: true,
            message: "OTP verified successfully. You can now log in.",
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.resendOtp = async (req, res) => {
    try {
        let { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        email = email.trim().toLowerCase();

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User does not exist' });
        }

        if (user.is_verified) {
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

        try {
            await sendEmail(email, otp);
        } catch (emailError) {
            console.error('OTP email failed to send:', emailError.message);
        }

        res.status(200).json({
            success: true,
            message: "OTP resent successfully"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
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

        // Send OTP email — don't fail the request just because delivery isn't configured
        try {
            await sendEmail(email, otp);
        } catch (emailError) {
            console.error('Reset OTP email failed to send:', emailError.message);
        }

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

        // OTP is valid — mark it verified and keep it (not delete) so resetPassword
        // can confirm this step actually happened, without re-accepting the raw OTP.
        otpEntry.verified = true;
        await otpEntry.save();

        res.status(200).json({
            success: true,
            message: "OTP verified successfully. You can now reset your password.",
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

        // Must have actually completed verify-reset-otp — otherwise anyone who
        // knows the email could reset the password without ever knowing the OTP.
        if (!otpEntry.verified) {
            return res.status(400).json({ success: false, message: "Please verify OTP first before resetting password" });
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

        if (!user.is_verified) {
            return res.status(403).json({ message: 'Please verify your account with the OTP sent to your email before logging in' });
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
                mustChangePassword: user.mustChangePassword,
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
        user.mustChangePassword = false;
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
        // params.id for GET /users/:id, falls back to the token's own id for GET /users/profile
        const id = req.params.id || (req.user && req.user.id);
        if (!id) {
            return res.status(400).json({ message: 'User ID is required' });
        }
        // Own profile if there's no :id param at all (GET /profile), or the :id
        // requested is the same account the token belongs to.
        const isOwnProfile = !req.params.id || (req.user && String(req.user.id) === String(id));
        const user = await User.findById(id).select('-password'); // Exclude password from the response
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const response = {
            success: true,
            message: 'User retrieved successfully',
            data: user
        };
        // Only re-issue a token for the caller's own profile — handing back a
        // token for someone else's account (GET /users/:id) would let an admin
        // impersonate whichever user they look up.
        if (isOwnProfile) {
            response.token = jwt.generateToken(user._id, user.role);
        }
        res.status(200).json(response);
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