const { z } = require('zod');
const { query } = require('../config/db');
const { getOrComputeScore } = require('../services/scoringService');
const { notifyHighScoreInterest, notifyInterestAccepted, notifyInterestDeclined } = require('../services/emailService');

// ── Validation ──────────────────────────────────────────────────

const sendInterestSchema = z.object({
  listing_id: z.string().uuid('Invalid listing ID')
});

const respondSchema = z.object({
  status: z.enum(['accepted', 'declined'], { message: 'Status must be accepted or declined' })
});

// ── Controllers ─────────────────────────────────────────────────

/**
 * POST /api/interests
 * Tenant sends an interest request on a listing.
 * Triggers AI scoring if not cached, and email if score > 80.
 */
const sendInterest = async (req, res) => {
  try {
    const validation = sendInterestSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = validation.error.issues.map(i => i.message);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const { listing_id } = validation.data;
    const tenant_id = req.user.id;

    // Check listing exists and is active
    const listing = await query(
      'SELECT l.*, u.name AS owner_name, u.email AS owner_email FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.id = $1',
      [listing_id]
    );
    if (listing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.rows[0].status !== 'active') {
      return res.status(400).json({ error: 'This listing is no longer available' });
    }

    // Check if already sent interest
    const existing = await query(
      'SELECT id, status FROM interest_requests WHERE tenant_id = $1 AND listing_id = $2',
      [tenant_id, listing_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        error: 'You already expressed interest in this listing',
        interest: existing.rows[0]
      });
    }

    // Ensure compatibility score exists (compute if not)
    const scoreResult = await getOrComputeScore(tenant_id, listing_id);

    // Create interest request
    const result = await query(
      `INSERT INTO interest_requests (tenant_id, listing_id)
       VALUES ($1, $2)
       RETURNING *`,
      [tenant_id, listing_id]
    );

    const interest = result.rows[0];

    // If score > 80, send email notification to owner (fire-and-forget)
    if (scoreResult.score > 80) {
      const tenant = await query('SELECT name, email FROM users WHERE id = $1', [tenant_id]);
      
      notifyHighScoreInterest({
        owner: { id: listing.rows[0].owner_id, name: listing.rows[0].owner_name, email: listing.rows[0].owner_email },
        tenant: { name: tenant.rows[0].name, email: tenant.rows[0].email },
        listing: listing.rows[0],
        score: scoreResult.score
      }).catch(err => console.error('Email notification error:', err.message));
    }

    res.status(201).json({
      message: 'Interest sent successfully',
      interest,
      compatibility_score: scoreResult
    });

  } catch (err) {
    console.error('SendInterest error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/listings/:id/interests
 * Owner views interested tenants for their listing, ranked by compatibility score.
 */
const getInterests = async (req, res) => {
  try {
    const { id } = req.params; // listing_id

    // Verify ownership
    const listing = await query(
      'SELECT owner_id FROM listings WHERE id = $1',
      [id]
    );
    if (listing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only view interests for your own listings' });
    }

    // Get all interest requests with tenant info and compatibility scores
    const result = await query(
      `SELECT ir.*, 
              u.name AS tenant_name, u.email AS tenant_email,
              tp.preferred_location, tp.budget_min, tp.budget_max, tp.room_type_pref, tp.move_in_date,
              cs.score AS compatibility_score, cs.explanation AS score_explanation, cs.source AS score_source
       FROM interest_requests ir
       JOIN users u ON u.id = ir.tenant_id
       LEFT JOIN tenant_profiles tp ON tp.user_id = ir.tenant_id
       LEFT JOIN compatibility_scores cs ON cs.tenant_id = ir.tenant_id AND cs.listing_id = ir.listing_id
       WHERE ir.listing_id = $1
       ORDER BY cs.score DESC NULLS LAST, ir.created_at DESC`,
      [id]
    );

    res.json({ interests: result.rows });

  } catch (err) {
    console.error('GetInterests error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/interests/:id
 * Owner accepts or declines an interest request.
 * Triggers email notification to tenant.
 */
const respondToInterest = async (req, res) => {
  try {
    const { id } = req.params; // interest_request_id

    const validation = respondSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = validation.error.issues.map(i => i.message);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const { status } = validation.data;

    // Get interest request with listing ownership check
    const interest = await query(
      `SELECT ir.*, l.owner_id, l.location, l.rent, l.room_type
       FROM interest_requests ir
       JOIN listings l ON l.id = ir.listing_id
       WHERE ir.id = $1`,
      [id]
    );

    if (interest.rows.length === 0) {
      return res.status(404).json({ error: 'Interest request not found' });
    }

    const ir = interest.rows[0];

    if (ir.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the listing owner can respond to interests' });
    }

    if (ir.status !== 'pending') {
      return res.status(400).json({ error: `Interest already ${ir.status}` });
    }

    // Update status
    const result = await query(
      `UPDATE interest_requests SET status = $1, responded_at = now()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    // Send email notification to tenant (fire-and-forget)
    const tenant = await query('SELECT id, name, email FROM users WHERE id = $1', [ir.tenant_id]);
    const owner = await query('SELECT name FROM users WHERE id = $1', [req.user.id]);

    const emailData = {
      tenant: tenant.rows[0],
      owner: { name: owner.rows[0].name },
      listing: { location: ir.location, rent: ir.rent, room_type: ir.room_type }
    };

    if (status === 'accepted') {
      notifyInterestAccepted(emailData).catch(err => console.error('Email error:', err.message));
    } else {
      notifyInterestDeclined(emailData).catch(err => console.error('Email error:', err.message));
    }

    res.json({
      message: `Interest ${status}`,
      interest: result.rows[0]
    });

  } catch (err) {
    console.error('RespondToInterest error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/interests/mine
 * Tenant views their own interest requests with listing details and status.
 */
const getMyInterests = async (req, res) => {
  try {
    const result = await query(
      `SELECT ir.*,
              l.location, l.rent, l.room_type, l.furnishing_status, l.photos, l.status AS listing_status,
              u.name AS owner_name,
              cs.score AS compatibility_score, cs.explanation AS score_explanation
       FROM interest_requests ir
       JOIN listings l ON l.id = ir.listing_id
       JOIN users u ON u.id = l.owner_id
       LEFT JOIN compatibility_scores cs ON cs.tenant_id = ir.tenant_id AND cs.listing_id = ir.listing_id
       WHERE ir.tenant_id = $1
       ORDER BY ir.created_at DESC`,
      [req.user.id]
    );

    res.json({ interests: result.rows });

  } catch (err) {
    console.error('GetMyInterests error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { sendInterest, getInterests, respondToInterest, getMyInterests };
