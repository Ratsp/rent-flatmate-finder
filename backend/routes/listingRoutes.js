const express = require('express');
const router = express.Router();
const { 
  createListing, updateListing, deleteListing, markFilled, 
  getListings, getOwnerListings, getListingById 
} = require('../controllers/listingController');
const { getInterests } = require('../controllers/interestController');
const { authenticate, requireRole } = require('../middleware/auth');

// ── Owner Routes (require auth + owner role) ────────────────────
router.post('/', authenticate, requireRole(['owner']), createListing);
router.get('/mine', authenticate, requireRole(['owner']), getOwnerListings);
router.put('/:id', authenticate, requireRole(['owner']), updateListing);
router.delete('/:id', authenticate, requireRole(['owner']), deleteListing);
router.patch('/:id/fill', authenticate, requireRole(['owner']), markFilled);
router.get('/:id/interests', authenticate, requireRole(['owner']), getInterests);

// ── Tenant/Public Routes ────────────────────────────────────────
// Browse listings (authenticated tenant gets scores, unauthenticated gets basic list)
router.get('/', authenticate, getListings);

// Get single listing (authenticated to include score if tenant)
router.get('/:id', authenticate, getListingById);

module.exports = router;
