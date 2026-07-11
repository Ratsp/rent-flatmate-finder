const express = require('express');
const router = express.Router();
const { sendInterest, getInterests, respondToInterest, getMyInterests } = require('../controllers/interestController');
const { authenticate, requireRole } = require('../middleware/auth');

// Tenant routes
router.post('/', authenticate, requireRole(['tenant']), sendInterest);
router.get('/mine', authenticate, requireRole(['tenant']), getMyInterests);

// Owner routes
router.patch('/:id', authenticate, requireRole(['owner']), respondToInterest);

module.exports = router;
