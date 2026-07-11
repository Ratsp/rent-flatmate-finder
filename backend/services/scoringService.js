const Groq = require('groq-sdk');
const { query } = require('../config/db');

// ── Groq Client ─────────────────────────────────────────────────

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── LLM Scoring (Groq Llama 3.3 70B) ───────────────────────────

/**
 * Compute compatibility score via Groq LLM.
 * Returns { score, explanation, source: 'llm' }
 */
const llmScore = async (tenantProfile, listing) => {
  const systemPrompt = `You are a compatibility scoring engine for a room rental platform.
You must respond with ONLY valid JSON, no markdown, no extra text.
Schema: { "score": <integer 0-100>, "explanation": "<max 2 sentences>" }
Score based primarily on budget overlap and location match; secondarily on
room type / furnishing preference alignment and move-in date proximity.`;

  const userPrompt = `Room listing:
- Location: ${listing.location}
- Rent: ₹${listing.rent}/month
- Room type: ${listing.room_type}
- Furnishing: ${listing.furnishing_status}
- Available from: ${listing.available_from}

Tenant profile:
- Preferred location: ${tenantProfile.preferred_location}
- Budget range: ₹${tenantProfile.budget_min} - ₹${tenantProfile.budget_max}
- Preferred room type: ${tenantProfile.room_type_pref || 'Any'}
- Move-in date: ${tenantProfile.move_in_date || 'Flexible'}

Compute a compatibility score (0-100) based on budget and location match,
with room type and move-in date as secondary factors.
Return JSON: { "score": number, "explanation": string }`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    }, { signal: controller.signal });

    clearTimeout(timeout);

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty LLM response');

    const parsed = JSON.parse(content);

    // Validate schema
    if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 100) {
      throw new Error(`Invalid score: ${parsed.score}`);
    }
    if (typeof parsed.explanation !== 'string') {
      throw new Error('Missing explanation');
    }

    return {
      score: Math.round(parsed.score),
      explanation: parsed.explanation.substring(0, 500),
      source: 'llm'
    };

  } catch (err) {
    clearTimeout(timeout);
    console.warn('⚠️  LLM scoring failed:', err.message);
    throw err; // Let caller use fallback
  }
};

// ── Fallback Rule-Based Scoring ─────────────────────────────────

/**
 * Deterministic scoring when LLM is unavailable.
 * PRD §5.4 — always returns a score, never fails.
 */
const fallbackScore = (tenantProfile, listing) => {
  let base_score = 0;

  const rent = parseFloat(listing.rent);
  const budgetMin = parseFloat(tenantProfile.budget_min);
  const budgetMax = parseFloat(tenantProfile.budget_max);

  // Budget match (up to 50 points)
  if (rent <= budgetMax && rent >= budgetMin) {
    base_score += 50;
  } else if (rent <= budgetMax * 1.1) {
    base_score += 30;
  } else {
    base_score += Math.max(0, 20 - ((rent - budgetMax) / budgetMax) * 20);
  }

  // Location match (up to 35 points) - case-insensitive substring match
  const tenantLoc = (tenantProfile.preferred_location || '').toLowerCase();
  const listingLoc = (listing.location || '').toLowerCase();
  if (tenantLoc && listingLoc && (tenantLoc.includes(listingLoc) || listingLoc.includes(tenantLoc))) {
    base_score += 35;
  } else {
    base_score += 10; // Partial credit
  }

  // Room type / furnishing match (up to 15 points)
  if (tenantProfile.room_type_pref && tenantProfile.room_type_pref === listing.room_type) {
    base_score += 15;
  } else {
    base_score += 5;
  }

  const score = Math.min(100, Math.round(base_score));
  return {
    score,
    explanation: 'Score computed using rule-based fallback (budget + location match).',
    source: 'fallback'
  };
};

// ── Score Computation + Caching ─────────────────────────────────

/**
 * Get or compute a compatibility score for a (tenant, listing) pair.
 * Checks cache first; computes (LLM → fallback) and stores if missing.
 */
const getOrComputeScore = async (tenantId, listingId) => {
  // Check cache
  const cached = await query(
    `SELECT score, explanation, source, computed_at
     FROM compatibility_scores
     WHERE tenant_id = $1 AND listing_id = $2`,
    [tenantId, listingId]
  );

  if (cached.rows.length > 0) {
    return cached.rows[0];
  }

  // Get tenant profile and listing data
  const [tenantResult, listingResult] = await Promise.all([
    query('SELECT * FROM tenant_profiles WHERE user_id = $1', [tenantId]),
    query('SELECT * FROM listings WHERE id = $1', [listingId])
  ]);

  if (tenantResult.rows.length === 0 || listingResult.rows.length === 0) {
    return { score: 0, explanation: 'Incomplete data — profile or listing missing.', source: 'fallback' };
  }

  const tenantProfile = tenantResult.rows[0];
  const listing = listingResult.rows[0];

  // Try LLM, fallback to rules
  let result;
  try {
    result = await llmScore(tenantProfile, listing);
  } catch {
    result = fallbackScore(tenantProfile, listing);
  }

  // Cache the score
  try {
    await query(
      `INSERT INTO compatibility_scores (tenant_id, listing_id, score, explanation, source)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, listing_id)
       DO UPDATE SET score = EXCLUDED.score, explanation = EXCLUDED.explanation,
                     source = EXCLUDED.source, computed_at = now()`,
      [tenantId, listingId, result.score, result.explanation, result.source]
    );
  } catch (err) {
    console.error('Score cache write error:', err.message);
  }

  return result;
};

/**
 * Batch compute scores for multiple listings (for browse results).
 * Only computes for listings that don't have cached scores.
 */
const batchComputeScores = async (tenantId, listingIds) => {
  if (!listingIds || listingIds.length === 0) return;

  // Find which listings already have scores
  const existing = await query(
    `SELECT listing_id FROM compatibility_scores
     WHERE tenant_id = $1 AND listing_id = ANY($2)`,
    [tenantId, listingIds]
  );

  const existingIds = new Set(existing.rows.map(r => r.listing_id));
  const missingIds = listingIds.filter(id => !existingIds.has(id));

  if (missingIds.length === 0) return;

  console.log(`🧠 Computing ${missingIds.length} compatibility scores...`);

  // Compute scores in parallel (max 5 concurrent to avoid rate limits)
  const batchSize = 5;
  for (let i = 0; i < missingIds.length; i += batchSize) {
    const batch = missingIds.slice(i, i + batchSize);
    await Promise.all(
      batch.map(listingId => getOrComputeScore(tenantId, listingId))
    );
  }
};

module.exports = { getOrComputeScore, batchComputeScores, fallbackScore };
