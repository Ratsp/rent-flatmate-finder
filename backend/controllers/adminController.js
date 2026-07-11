const { query } = require('../config/db');

// ── Controllers ─────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * List all users with optional search/filter.
 * Query params: ?search=&role=&page=&limit=
 */
const getUsers = async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      conditions.push(`u.role = $${paramIndex}`);
      values.push(role);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at
       FROM users u
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, parseInt(limit), offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      values
    );

    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('Admin getUsers error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/admin/users/:id
 * Toggle user active status (activate/deactivate).
 */
const toggleUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    // Prevent admin from deactivating themselves
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const result = await query(
      `UPDATE users SET is_active = $1 WHERE id = $2
       RETURNING id, name, email, role, is_active`,
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: `User ${is_active ? 'activated' : 'deactivated'}`,
      user: result.rows[0]
    });

  } catch (err) {
    console.error('Admin toggleUser error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/admin/listings
 * List all listings (including filled), with owner info.
 */
const getAllListings = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`l.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (search) {
      conditions.push(`l.location ILIKE $${paramIndex}`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(
      `SELECT l.*, u.name AS owner_name, u.email AS owner_email,
              (SELECT COUNT(*) FROM interest_requests ir WHERE ir.listing_id = l.id) AS interest_count
       FROM listings l
       JOIN users u ON u.id = l.owner_id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, parseInt(limit), offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM listings l ${whereClause}`,
      values
    );

    res.json({
      listings: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('Admin getAllListings error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/admin/listings/:id
 * Force-delete any listing.
 */
const forceDeleteListing = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM listings WHERE id = $1 RETURNING id, location',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json({ message: 'Listing deleted', listing: result.rows[0] });

  } catch (err) {
    console.error('Admin forceDeleteListing error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/admin/interests
 * List all interest requests with tenant, listing, owner, and score.
 * Query params: ?status=&page=&limit=
 */
const getAllInterests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`ir.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(
      `SELECT ir.id, ir.status, ir.created_at, ir.responded_at,
              t.name AS tenant_name, t.email AS tenant_email,
              o.name AS owner_name, o.email AS owner_email,
              l.id AS listing_id, l.location, l.rent, l.room_type,
              cs.score AS compatibility_score
       FROM interest_requests ir
       JOIN users t ON t.id = ir.tenant_id
       JOIN listings l ON l.id = ir.listing_id
       JOIN users o ON o.id = l.owner_id
       LEFT JOIN compatibility_scores cs ON cs.tenant_id = ir.tenant_id AND cs.listing_id = ir.listing_id
       ${whereClause}
       ORDER BY ir.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, parseInt(limit), offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM interest_requests ir ${whereClause}`,
      values
    );

    res.json({
      interests: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('Admin getAllInterests error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/admin/stats
 * Platform activity dashboard stats.
 */
const getStats = async (req, res) => {
  try {
    const [users, listings, interests, matches, avgScore, recentUsers, recentListings] = await Promise.all([
      query('SELECT COUNT(*) AS total, role FROM users GROUP BY role'),
      query("SELECT COUNT(*) AS total, status FROM listings GROUP BY status"),
      query('SELECT COUNT(*) AS total FROM interest_requests'),
      query("SELECT COUNT(*) AS total FROM interest_requests WHERE status = 'accepted'"),
      query('SELECT ROUND(AVG(score), 1) AS avg_score FROM compatibility_scores'),
      query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5'),
      query('SELECT id, location, rent, room_type, status, created_at FROM listings ORDER BY created_at DESC LIMIT 5')
    ]);

    // Transform role counts
    const userCounts = {};
    users.rows.forEach(r => { userCounts[r.role] = parseInt(r.total); });

    const listingCounts = {};
    listings.rows.forEach(r => { listingCounts[r.status] = parseInt(r.total); });

    res.json({
      stats: {
        users: {
          total: Object.values(userCounts).reduce((a, b) => a + b, 0),
          ...userCounts
        },
        listings: {
          total: Object.values(listingCounts).reduce((a, b) => a + b, 0),
          ...listingCounts
        },
        interest_requests: parseInt(interests.rows[0].total),
        accepted_matches: parseInt(matches.rows[0].total),
        avg_compatibility_score: parseFloat(avgScore.rows[0].avg_score) || 0
      },
      recent: {
        users: recentUsers.rows,
        listings: recentListings.rows
      }
    });

  } catch (err) {
    console.error('Admin getStats error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getUsers, toggleUser, getAllListings, forceDeleteListing, getAllInterests, getStats };
