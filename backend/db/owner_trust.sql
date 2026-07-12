-- ========== OWNER TRUST (data-driven responsiveness signal) ==========
-- Aggregates real interest-response behaviour per owner. Powers the
-- tenant-facing "Trusted owner / Responsive" badge and the owner's own
-- reputation summary. Recomputed live on every read (cheap; indexed joins).
CREATE OR REPLACE VIEW owner_trust AS
SELECT
    l.owner_id,
    COUNT(ir.id)                                                              AS total_interests,
    COUNT(ir.id) FILTER (WHERE ir.status <> 'pending')                        AS responded_interests,
    COUNT(ir.id) FILTER (WHERE ir.status = 'accepted')                        AS accepted_interests,
    CASE WHEN COUNT(ir.id) > 0
         THEN ROUND(100.0 * COUNT(ir.id) FILTER (WHERE ir.status <> 'pending') / COUNT(ir.id))
    END::int                                                                  AS response_rate,
    ROUND(
        AVG(EXTRACT(EPOCH FROM (ir.responded_at - ir.created_at)) / 3600.0)
        FILTER (WHERE ir.responded_at IS NOT NULL)
    , 1)                                                                      AS avg_response_hours
FROM listings l
LEFT JOIN interest_requests ir ON ir.listing_id = l.id
GROUP BY l.owner_id;
