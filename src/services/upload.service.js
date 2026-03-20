const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const path = require('path');

const buildSignedRawDownloadUrl = (publicIdWithOptionalExt) => {
  if (!publicIdWithOptionalExt || typeof publicIdWithOptionalExt !== 'string') {
    return null;
  }

  const cleanPublicId = decodeURIComponent(publicIdWithOptionalExt).replace(/^\/+/, '');
  if (!cleanPublicId) {
    return null;
  }

  const ext = path.extname(cleanPublicId).replace('.', '').toLowerCase();
  const publicIdWithoutExt = ext
    ? cleanPublicId.slice(0, -(ext.length + 1))
    : cleanPublicId;

  // Try with extension inside public_id first (common for raw uploads where public_id was set with .pdf/.docx).
  // If not available in a specific environment, consumers can regenerate using the no-ext form below.
  return cloudinary.utils.private_download_url(cleanPublicId, undefined, {
    resource_type: 'raw',
    type: 'upload',
    secure: true,
    attachment: false,
  }) || cloudinary.utils.private_download_url(publicIdWithoutExt, ext || undefined, {
    resource_type: 'raw',
    type: 'upload',
    secure: true,
    attachment: false,
  });
};

exports.getAccessibleRawUrl = (urlOrPublicId) => {
  if (!urlOrPublicId || typeof urlOrPublicId !== 'string') {
    return urlOrPublicId;
  }

  // Already a signed API URL: extract public_id and re-sign to recover from previously malformed URLs.
  if (urlOrPublicId.includes('api.cloudinary.com')) {
    const publicIdParamMatch = urlOrPublicId.match(/[?&]public_id=([^&]+)/);
    if (publicIdParamMatch && publicIdParamMatch[1]) {
      const signedUrl = buildSignedRawDownloadUrl(publicIdParamMatch[1]);
      return signedUrl || urlOrPublicId;
    }
    return urlOrPublicId;
  }

  // Convert res.cloudinary raw URLs to signed API download URLs.
  const rawUploadMatch = urlOrPublicId.match(/\/raw\/upload\/v\d+\/(.+?)(\?.*)?$/);
  if (rawUploadMatch && rawUploadMatch[1]) {
    const signedUrl = buildSignedRawDownloadUrl(decodeURIComponent(rawUploadMatch[1]));
    return signedUrl || urlOrPublicId;
  }

  // Fallback: treat input as public_id directly.
  const signedUrl = buildSignedRawDownloadUrl(urlOrPublicId);
  return signedUrl || urlOrPublicId;
};

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
      type: 'upload',
    };

    // For raw files (PDFs, DOCX), include the extension in public_id
    // Cloudinary preserves the public_id as-is in the URL for raw uploads
    if (originalFilename && resourceType === 'raw') {
      const ext = path.extname(originalFilename); // e.g. ".pdf"
      const baseName = path.basename(originalFilename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      options.public_id = `${baseName}_${Date.now()}${ext}`;

      // Ensure resumes are publicly accessible (some Cloudinary environments default raw files to restricted ACLs)
      options.access_mode = 'public';
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
