const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Local Storage Configuration ─────────────────────────────────
// For development: store photos locally
// For production: swap with Supabase Storage upload

const uploadDir = path.join(__dirname, '..', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `listing-${uniqueSuffix}${ext}`);
  }
});

// File filter: only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5                    // Max 5 photos per upload
  }
});

/**
 * Get the public URL for an uploaded file.
 * In development, returns a local path. In production, would return Supabase Storage URL.
 */
const getFileUrl = (filename) => {
  const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${baseUrl}/uploads/${filename}`;
};

/**
 * Process uploaded files and return array of URLs.
 */
const processUploadedFiles = (files) => {
  if (!files || files.length === 0) return [];
  return files.map(file => getFileUrl(file.filename));
};

/**
 * Delete uploaded files from local storage.
 */
const deleteFiles = (filePaths) => {
  for (const filePath of filePaths) {
    try {
      // Extract filename from URL
      const filename = filePath.split('/uploads/').pop();
      if (filename) {
        const fullPath = path.join(uploadDir, filename);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    } catch (err) {
      console.error('File delete error:', err.message);
    }
  }
};

module.exports = { upload, processUploadedFiles, deleteFiles, uploadDir };
