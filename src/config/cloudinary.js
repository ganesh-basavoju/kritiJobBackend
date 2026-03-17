const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Diagnostic: verify credentials are loaded
console.log('[Cloudinary] Config loaded - cloud_name:', process.env.CLOUDINARY_CLOUD_NAME || 'MISSING', ', api_key:', process.env.CLOUDINARY_API_KEY ? '***set***' : 'MISSING');

module.exports = cloudinary;
