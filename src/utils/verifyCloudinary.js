const fs = require('fs');

const cloudinary = require('cloudinary').v2; // Require directly

// Explicitly configure same instance that upload service will use (due to require cache)
cloudinary.config({
  cloud_name: 'dxbwlregw',
  api_key: '365284329919745',
  api_secret: 'Gh4zzWD3Dz6zjRa0n2sGHW5N3LU'
});

const { uploadToCloudinary } = require('../services/upload.service');

const verifyUpload = async () => {
    try {
        console.log('Testing Cloudinary Upload with manual credentials...');
        const buffer = Buffer.from('This is a test resume document content.', 'utf-8');
        const result = await uploadToCloudinary(buffer, 'test_uploads');
        console.log('Upload Successful!');
        console.log('Document URL:', result.secure_url);
    } catch (error) {
        console.error('Upload Failed:', error);
    }
};

verifyUpload();
