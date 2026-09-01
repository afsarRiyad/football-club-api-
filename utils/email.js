const nodemailer = require("nodemailer");

/**
 * Create email transporter.
 * Uses Ethereal in development, configured SMTP in production.
 */
const createTransporter = async () => {
  if (process.env.NODE_ENV === "development" || !process.env.SMTP_HOST) {
    // Use Ethereal test account in development
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  // Production SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send an email.
 * @param {object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = await createTransporter();

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || "FClub <noreply@fclub.com>",
    to,
    subject,
    text,
    html,
  });

  // Log preview URL in development
  if (process.env.NODE_ENV !== "production") {
    console.log(`📧 Email preview: ${nodemailer.getTestMessageUrl(info)}`);
  }

  return info;
};

/**
 * Send password reset email.
 */
const sendPasswordResetEmail = async (email, resetToken, resetURL) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e94560;">⚽ FClub Password Reset</h2>
      <p>You requested a password reset. Click the button below to reset your password:</p>
      <a href="${resetURL}" style="
        display: inline-block;
        background-color: #e94560;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 6px;
        margin: 16px 0;
      ">Reset Password</a>
      <p style="color: #666;">This link expires in 10 minutes.</p>
      <p style="color: #666;">If you didn't request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">FClub Football Club Management Platform</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: "FClub - Password Reset Request",
    text: `Password Reset\n\nClick the link to reset your password: ${resetURL}\n\nThis link expires in 10 minutes.`,
    html,
  });
};

/**
 * Send welcome email to new members.
 */
const sendWelcomeEmail = async (email, name) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e94560;">⚽ Welcome to FClub, ${name}!</h2>
      <p>Your account has been created successfully.</p>
      <p>You can now log in to access your dashboard, view match updates, and manage your profile.</p>
      <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/login" style="
        display: inline-block;
        background-color: #e94560;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 6px;
        margin: 16px 0;
      ">Log In</a>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">FClub Football Club Management Platform</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: "Welcome to FClub!",
    text: `Welcome to FClub, ${name}!\n\nYour account has been created successfully.`,
    html,
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
