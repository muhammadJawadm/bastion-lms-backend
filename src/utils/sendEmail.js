const nodeMailer = require('nodemailer');

const transporter = nodeMailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});

const sendEmail = async (email , otp) => {
    await transporter.sendMail({
        from: process.env.EMAIL,
        to: email,
        subject: 'OTP Verification',
       html: `
            <h2>Your OTP Code</h2>
            <p>Use this OTP to verify your account:</p>
            <h1 style="letter-spacing: 8px;">${otp}</h1>
            <p>This OTP expires in <b>5 minutes</b>.</p>
            <p>If you did not request this, ignore this email.</p>
        `,
    });
    console.log(`Email sent to ${email} with OTP: ${otp}`);
};

module.exports = sendEmail;