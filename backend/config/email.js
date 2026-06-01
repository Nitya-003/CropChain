const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.warn('⚠️ SMTP not configured. Emails will be logged to console instead of sent.');
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

const transporter = createTransporter();

const getFromAddress = () =>
  process.env.EMAIL_FROM || 'noreply@cropchain.com';

const sendEmail = async (to, subject, html) => {
  if (!transporter) {
    console.log(`[EMAIL][FALLBACK] To: ${to} | Subject: ${subject}`);
    return { success: false, fallback: true };
  }

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject,
      html,
    });
    console.log(`[EMAIL][SENT] To: ${to} | Subject: ${subject} | MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EMAIL][ERROR] Failed to send to ${to}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail, transporter };
