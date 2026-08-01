const nodemailer = require("nodemailer");
const logger = require("../utils/logger");
const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");

const createTransporter = () => {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    logger.warn(
      "SMTP not configured. Emails will be logged to console instead of sent.",
    );
    return null;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
};

const transporter = createTransporter();

const getFromAddress = () => process.env.EMAIL_FROM || "noreply@cropchain.com";

const compileTemplate = (templateName, context) => {
  try {
    const layoutPath = path.join(__dirname, "../templates/emails/layout.hbs");
    const templatePath = path.join(__dirname, `../templates/emails/${templateName}.hbs`);
    
    const layoutSource = fs.readFileSync(layoutPath, "utf-8");
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    
    const template = handlebars.compile(templateSource);
    const bodyHtml = template(context);
    
    const layout = handlebars.compile(layoutSource);
    return layout({ ...context, body: bodyHtml, currentYear: new Date().getFullYear() });
  } catch (error) {
    logger.error(`[EMAIL] Failed to compile template ${templateName}: ${error.message}`);
    throw error;
  }
};

const sendEmail = async (to, subject, html) => {
  if (!transporter) {
    logger.info(`[EMAIL][FALLBACK] To: ${to} | Subject: ${subject}`);
    return { success: false, fallback: true };
  }
  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject,
      html,
    });
    logger.info(
      `[EMAIL][SENT] To: ${to} | Subject: ${subject} | MessageId: ${info.messageId}`,
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`[EMAIL][ERROR] Failed to send to ${to}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail, transporter, compileTemplate };
