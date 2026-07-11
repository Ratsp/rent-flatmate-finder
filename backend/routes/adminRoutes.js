const express = require('express');
const router = express.Router();
const { getUsers, toggleUser, getAllListings, forceDeleteListing, getAllInterests, getStats } = require('../controllers/adminController');
const { authenticate, requireRole } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(authenticate, requireRole(['admin']));

router.get('/users', getUsers);
router.patch('/users/:id', toggleUser);
router.get('/listings', getAllListings);
router.delete('/listings/:id', forceDeleteListing);
router.get('/interests', getAllInterests);
router.get('/stats', getStats);

module.exports = router;
