const { z } = require('zod');
const { query } = require('../config/db');
const { batchComputeScores } = require('../services/scoringService');

// ── Validation Schema ───────────────────────────────────────────

const listingSchema = z.object({
  location: z.string().min(2, 'Location is required').max(160),
  rent: z.number().positive('Rent must be positive'),
  available_from: z.string().min(1, 'Available from date is required'), // ISO date
  room_type: z.enum(['single', 'shared', '1BHK', '2BHK', '3BHK', 'studio'], {
    message: 'Room type must be: single, shared, 1BHK, 2BHK, 3BHK, or studio'
  }),
  furnishing_status: z.enum(['furnished', 'semi-furnished', 'unfurnished'], {
    message: 'Furnishing must be: furnished, semi-furnished, or unfurnished'
  }),
  description: z.string().max(2000).optional().default(''),
  photos: z.array(z.string().url()).optional().default([])
});

const updateListingSchema = listingSchema.partial(); // All fields optional for updates

// ── Controllers ─────────────────────────────────────────────────

/**
 * POST /api/listings
 * Owner creates a new room listing.
 */
const createListing = async (req, res) => {
  try {
    const validation = listingSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = validation.error.issues.map(i => i.message);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const { location, rent, available_from, room_type, furnishing_status, description, photos } = validation.data;

    const result = await query(
      `INSERT INTO listings (owner_id, location, rent, available_from, room_type, furnishing_status, description, photos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.user.id, location, rent, available_from, room_type, furnishing_status, description, photos]
    );

    res.status(201).json({
      message: 'Listing created successfully',
      listing: result.rows[0]
    });

  } catch (err) {
    console.error('CreateListing error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /api/listings/:id
 * Owner edits their own listing.
 */
const updateListing = async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const existing = await query(
      'SELECT owner_id FROM listings WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (existing.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own listings' });
    }

    const validation = updateListingSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = validation.error.issues.map(i => i.message);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const data = validation.data;

    // Build dynamic SET clause for partial updates
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    const fields = ['location', 'rent', 'available_from', 'room_type', 'furnishing_status', 'description', 'photos'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(data[field]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    setClauses.push(`updated_at = now()`);
    values.push(id);

    const result = await query(
      `UPDATE listings SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    // Invalidate cached compatibility scores — listing changed, scores must be recomputed (PRD §5.1)
    await query('DELETE FROM compatibility_scores WHERE listing_id = $1', [id]);

    res.json({
      message: 'Listing updated successfully',
      listing: result.rows[0]
    });

  } catch (err) {
    console.error('UpdateListing error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/listings/:id
 * Owner deletes their own listing.
 */
const deleteListing = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM listings WHERE id = $1 AND owner_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found or not yours' });
    }

    res.json({ message: 'Listing deleted successfully' });

  } catch (err) {
    console.error('DeleteListing error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/listings/:id/fill
 * Owner marks listing as filled (no longer available).
 */
const markFilled = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE listings SET status = 'filled', updated_at = now()
       WHERE id = $1 AND owner_id = $2
       RETURNING id, status`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found or not yours' });
    }

    res.json({ message: 'Listing marked as filled', listing: result.rows[0] });

  } catch (err) {
    console.error('MarkFilled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/listings
 * Tenant browses listings with optional filters.
 * Query params: ?location=&budget_min=&budget_max=&room_type=
 * If authenticated as a tenant, results include compatibility_score (from cache).
 */
const getListings = async (req, res) => {
  try {
    const { location, budget_min, budget_max, room_type, page = 1, limit = 20 } = req.query;
    
    const conditions = ["l.status = 'active'"];
    const filterValues = []; // Only filter param values (for count query)
    let paramIndex = 1;

    // Location filter (case-insensitive substring match)
    if (location) {
      conditions.push(`l.location ILIKE $${paramIndex}`);
      filterValues.push(`%${location}%`);
      paramIndex++;
    }

    // Budget range filters
    if (budget_min) {
      conditions.push(`l.rent >= $${paramIndex}`);
      filterValues.push(parseFloat(budget_min));
      paramIndex++;
    }
    if (budget_max) {
      conditions.push(`l.rent <= $${paramIndex}`);
      filterValues.push(parseFloat(budget_max));
      paramIndex++;
    }

    // Room type filter
    if (room_type) {
      conditions.push(`l.room_type = $${paramIndex}`);
      filterValues.push(room_type);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build main query values starting with filter values
    const mainValues = [...filterValues];

    // If tenant is authenticated, join with compatibility_scores
    let scoreJoin = '';
    let scoreSelect = '';
    let orderBy = 'ORDER BY l.created_at DESC';

    if (req.user && req.user.role === 'tenant') {
      scoreJoin = `LEFT JOIN compatibility_scores cs ON cs.listing_id = l.id AND cs.tenant_id = $${paramIndex}`;
      mainValues.push(req.user.id);
      paramIndex++;
      scoreSelect = ', cs.score AS compatibility_score, cs.explanation AS score_explanation, cs.source AS score_source';
      orderBy = 'ORDER BY cs.score DESC NULLS LAST, l.created_at DESC';
    }

    // Add pagination params
    mainValues.push(parseInt(limit));
    const limitIndex = paramIndex;
    paramIndex++;
    mainValues.push(offset);
    const offsetIndex = paramIndex;

    // Get listings with owner name
    const result = await query(
      `SELECT l.*, u.name AS owner_name ${scoreSelect}
       FROM listings l
       JOIN users u ON u.id = l.owner_id
       ${scoreJoin}
       ${whereClause}
       ${orderBy}
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      mainValues
    );

    // If tenant: batch compute scores for listings that don't have them yet
    let listings = result.rows;
    if (req.user && req.user.role === 'tenant') {
      const unscoredIds = listings
        .filter(l => l.compatibility_score === null)
        .map(l => l.id);

      if (unscoredIds.length > 0) {
        // Compute missing scores
        await batchComputeScores(req.user.id, unscoredIds);

        // Re-query to get the freshly computed scores
        const refreshed = await query(
          `SELECT l.*, u.name AS owner_name ${scoreSelect}
           FROM listings l
           JOIN users u ON u.id = l.owner_id
           ${scoreJoin}
           ${whereClause}
           ${orderBy}
           LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
          mainValues
        );
        listings = refreshed.rows;
      }
    }

    // Get total count for pagination (only uses filter params)
    const countResult = await query(
      `SELECT COUNT(*) FROM listings l ${whereClause}`,
      filterValues
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('GetListings error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/listings/mine
 * Owner gets their own listings.
 */
const getOwnerListings = async (req, res) => {
  try {
    const result = await query(
      `SELECT l.*,
              (SELECT COUNT(*) FROM interest_requests ir WHERE ir.listing_id = l.id) AS interest_count,
              (SELECT COUNT(*) FROM interest_requests ir WHERE ir.listing_id = l.id AND ir.status = 'accepted') AS accepted_count
       FROM listings l
       WHERE l.owner_id = $1
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );

    res.json({ listings: result.rows });

  } catch (err) {
    console.error('GetOwnerListings error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/listings/:id
 * Get a single listing by ID. 
 * If authenticated as tenant, includes compatibility score.
 */
const getListingById = async (req, res) => {
  try {
    const { id } = req.params;

    let scoreJoin = '';
    let scoreSelect = '';
    const values = [id];

    if (req.user && req.user.role === 'tenant') {
      scoreJoin = 'LEFT JOIN compatibility_scores cs ON cs.listing_id = l.id AND cs.tenant_id = $2';
      scoreSelect = ', cs.score AS compatibility_score, cs.explanation AS score_explanation, cs.source AS score_source';
      values.push(req.user.id);
    }

    const result = await query(
      `SELECT l.*, u.name AS owner_name, u.email AS owner_email ${scoreSelect}
       FROM listings l
       JOIN users u ON u.id = l.owner_id
       ${scoreJoin}
       WHERE l.id = $1`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json({ listing: result.rows[0] });

  } catch (err) {
    console.error('GetListingById error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { createListing, updateListing, deleteListing, markFilled, getListings, getOwnerListings, getListingById };
