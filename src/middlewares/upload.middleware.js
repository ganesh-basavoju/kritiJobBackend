const multer = require('multer');
const path = require('path');

// Configure storage (Memory storage for Cloudinary streaming, Disk for local dev if needed)
// Using Memory Storage to stream directly to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'resume') {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOCX are allowed for resumes.'), false);
    }
  } else if (file.fieldname === 'avatar' || file.fieldname === 'logo') {
    if (file.mimetype.startsWith('image')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
  } else {
    cb(null, true);
  }
};

const limits = {
  fileSize: 5 * 1024 * 1024 // 5MB Limit
};

const upload = multer({
  storage,
  fileFilter,
  limits
});

module.exports = upload;
