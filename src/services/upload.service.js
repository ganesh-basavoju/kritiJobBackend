const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const path = require('path');

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer - The file buffer
 * @param {string} folder - The Cloudinary folder
 * @param {string} resourceType - 'auto' for images, 'raw' for PDFs/DOCX/docs
 * @param {string} originalFilename - Original filename to preserve extension (important for raw uploads)
 */
exports.uploadToCloudinary = (buffer, folder = 'uploads', resourceType = 'auto', originalFilename = null) => {
  return new Promise((resolve, reject) => {
    console.log(`[Upload Service] Starting upload to folder: "${folder}", resource_type: "${resourceType}", filename: "${originalFilename}", buffer size: ${buffer?.length || 0} bytes`);
    
    const options = {
      folder: folder,
      resource_type: resourceType,
    };

    // For raw files (PDFs, DOCX), include the extension in public_id
    // Cloudinary preserves the public_id as-is in the URL for raw uploads
    if (originalFilename && resourceType === 'raw') {
      const ext = path.extname(originalFilename); // e.g. ".pdf"
      const baseName = path.basename(originalFilename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      options.public_id = `${baseName}_${Date.now()}${ext}`;
    }
    
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          console.error('[Upload Service] Cloudinary upload error:', error);
          reject(error);
        } else if (result) {
          console.log('[Upload Service] Upload successful:', result.secure_url);
          resolve(result);
        } else {
          reject(new Error('Unknown upload error - no result or error returned'));
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};
