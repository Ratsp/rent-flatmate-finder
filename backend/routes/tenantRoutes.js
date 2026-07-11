const express = require('express');
const router = express.Router();
const { getProfile, upsertProfile } = require('../controllers/tenantController');
const { authenticate, requireRole } = require('../middleware/auth');

// All tenant routes require authentication + tenant role
router.get('/me', authenticate, requireRole(['tenant']), getProfile);
router.put('/me', authenticate, requireRole(['tenant']), upsertProfile);

module.exports = router;
