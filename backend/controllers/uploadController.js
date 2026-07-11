const { processUploadedFiles } = require('../services/uploadService');

/**
 * POST /api/uploads
 * Owner uploads listing photos (multipart, field name "photos", max 5).
 * Returns an array of URLs to pass into POST/PUT /api/listings `photos`.
 */
const uploadPhotos = (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  const urls = processUploadedFiles(req.files);
  res.status(201).json({ message: 'Upload successful', urls });
};

module.exports = { uploadPhotos };
