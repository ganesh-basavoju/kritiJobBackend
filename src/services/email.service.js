const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const sendEmail = async (options) => {
  // Create transporter
  // For dev, capturing using Ethereal or just logging if credentials missing
  let transporter;
  
  if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD
        }
      });
  } else {
      // Log for development if no SMTP
      logger.warn('SMTP credentials not found. Email not sent. Check environment variables.');
      return;
  }

  const message = {
    from: `${process.env.FROM_NAME || 'JobPortal'} <${process.env.FROM_EMAIL || 'noreply@jobportal.com'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html // Optional HTML support
  };

  const info = await transporter.sendMail(message);

  logger.info(`Message sent: ${info.messageId}`);
};

module.exports = sendEmail;
