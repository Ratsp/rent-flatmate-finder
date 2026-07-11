const { z } = require('zod');
const { query } = require('../config/db');

// ── Validation Schema ───────────────────────────────────────────

const profileSchema = z.object({
  preferred_location: z.string().min(2, 'Location is required').max(160),
  budget_min: z.number().positive('Budget min must be positive'),
  budget_max: z.number().positive('Budget max must be positive'),
  room_type_pref: z.string().max(30).optional().nullable(),
  move_in_date: z.string().optional().nullable() // ISO date string
}).refine(data => data.budget_max >= data.budget_min, {
  message: 'Budget max must be >= budget min',
  path: ['budget_max']
});

// ── Controllers ─────────────────────────────────────────────────

/**
 * GET /api/tenants/me
 * Get authenticated tenant's profile.
 */
const getProfile = async (req, res) => {
  try {
    const result = await query(
      `SELECT tp.*, u.name, u.email
       FROM tenant_profiles tp
       JOIN users u ON u.id = tp.user_id
       WHERE tp.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Profile not found. Create one using PUT /api/tenants/me' 
      });
    }

    res.json({ profile: result.rows[0] });

  } catch (err) {
    console.error('GetProfile error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /api/tenants/me
 * Create or update tenant profile (upsert).
 */
const upsertProfile = async (req, res) => {
  try {
    // Validate input
    const validation = profileSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = validation.error.issues.map(i => i.message);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const { preferred_location, budget_min, budget_max, room_type_pref, move_in_date } = validation.data;

    // Upsert (INSERT ... ON CONFLICT UPDATE)
    const result = await query(
      `INSERT INTO tenant_profiles (user_id, preferred_location, budget_min, budget_max, room_type_pref, move_in_date, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         preferred_location = EXCLUDED.preferred_location,
         budget_min = EXCLUDED.budget_min,
         budget_max = EXCLUDED.budget_max,
         room_type_pref = EXCLUDED.room_type_pref,
         move_in_date = EXCLUDED.move_in_date,
         updated_at = now()
       RETURNING *`,
      [req.user.id, preferred_location, budget_min, budget_max, room_type_pref || null, move_in_date || null]
    );

    // Invalidate cached compatibility scores — profile changed, scores must be recomputed (PRD §5.1)
    await query('DELETE FROM compatibility_scores WHERE tenant_id = $1', [req.user.id]);

    res.json({
      message: 'Profile saved successfully',
      profile: result.rows[0]
    });

  } catch (err) {
    console.error('UpsertProfile error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getProfile, upsertProfile };
