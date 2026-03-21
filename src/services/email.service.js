const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const sendEmail = async (options) => {
  // Create transporter
  // For dev, capturing using Ethereal or just logging if credentials missing
  let transporter;
  
  const hasSmtpConfig = Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_EMAIL &&
    process.env.SMTP_PASSWORD
  );

  if (hasSmtpConfig) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD
        }
      });
  } else {
      const message = 'SMTP configuration missing (SMTP_HOST, SMTP_EMAIL, SMTP_PASSWORD).';
      if (process.env.NODE_ENV === 'production') {
        throw new Error(message);
      }

      logger.warn(`${message} Email not sent in non-production environment.`);
      return { sent: false, skipped: true };
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
  return { sent: true, messageId: info.messageId };
};

module.exports = sendEmail;
