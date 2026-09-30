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

// Sent when an admin creates a mobile-side account (see addUser) — hands the
// user their login email/password so they can sign in and set their own
// password on first login.
const sendCredentialsEmail = async (email, password, name) => {
    await transporter.sendMail({
        from: process.env.EMAIL,
        to: email,
        subject: 'Your account has been created',
        html: `
            <h2>Welcome${name ? `, ${name}` : ''}!</h2>
            <p>An account has been created for you. Use these credentials to log in:</p>
            <p><b>Email:</b> ${email}<br/><b>Password:</b> ${password}</p>
            <p>You'll be asked to set your own password the first time you log in.</p>
        `,
    });
    console.log(`Credentials email sent to ${email}`);
};

module.exports = { sendEmail, sendCredentialsEmail };