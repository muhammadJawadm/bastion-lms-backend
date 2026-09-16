const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const {
    registerUser,
    loginUser,
    verifyOtp,
    resendOtp,
    forgotPassword,
    verifyResetOTP,
    resetPassword,
    addEmployee,
    getUser,
    updateUser,
    changePassword,
    deleteUser,
} = require('../controllers/userController');

// Public — no account yet / proving identity
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);

// Protected — specific paths before the "/:id" catch-all, or they'd never be reached
router.get('/profile', verifyToken, getUser);
router.post('/employees', verifyToken, addEmployee);
router.patch('/:id/change-password', verifyToken, changePassword);
router.get('/:id', verifyToken, getUser);
router.patch('/:id', verifyToken, updateUser);
router.delete('/:id', verifyToken, deleteUser);

module.exports = router;
