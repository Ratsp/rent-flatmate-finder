const express = require('express');
const router = express.Router();
const { upload } = require('../services/uploadService');
const { uploadPhotos } = require('../controllers/uploadController');
const { authenticate, requireRole } = require('../middleware/auth');

// Owner uploads listing photos → returns URL array
router.post('/', authenticate, requireRole(['owner']), upload.array('photos', 5), uploadPhotos);

module.exports = router;
