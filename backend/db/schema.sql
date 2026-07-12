-- =============================================
-- Rent & Flatmate Finder — Database Schema
-- Supabase PostgreSQL (Raw SQL, No ORM)
-- =============================================

-- Drop tables if they exist (for clean re-runs)
DROP TABLE IF EXISTS notification_log CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS interest_requests CASCADE;
DROP TABLE IF EXISTS compatibility_scores CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS tenant_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ========== USERS ==========
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(120) NOT NULL,
    email           VARCHAR(160) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(10) NOT NULL CHECK (role IN ('tenant','owner','admin')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ========== TENANT PROFILES ==========
CREATE TABLE tenant_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferred_location  VARCHAR(160) NOT NULL,
    budget_min          NUMERIC(10,2) NOT NULL,
    budget_max          NUMERIC(10,2) NOT NULL,
    room_type_pref      VARCHAR(30),
    move_in_date        DATE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

CREATE INDEX idx_tenant_profiles_user ON tenant_profiles(user_id);

-- ========== ROOM LISTINGS ==========
CREATE TABLE listings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location            VARCHAR(160) NOT NULL,
    rent                NUMERIC(10,2) NOT NULL,
    available_from      DATE NOT NULL,
    room_type           VARCHAR(30) NOT NULL,
    furnishing_status   VARCHAR(20) NOT NULL,
    photos              TEXT[] DEFAULT '{}',
    description         TEXT DEFAULT '',
    status              VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','filled')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listings_owner ON listings(owner_id);
CREATE INDEX idx_listings_location ON listings USING GIN (to_tsvector('english', location));
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_rent ON listings(rent);

-- ========== COMPATIBILITY SCORES (cached) ==========
CREATE TABLE compatibility_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    score           SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
    explanation     TEXT NOT NULL,
    source          VARCHAR(10) NOT NULL CHECK (source IN ('llm','fallback')),
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, listing_id)
);

CREATE INDEX idx_compat_tenant ON compatibility_scores(tenant_id);
CREATE INDEX idx_compat_listing ON compatibility_scores(listing_id);
CREATE INDEX idx_compat_score ON compatibility_scores(score DESC);

-- ========== INTEREST REQUESTS ==========
CREATE TABLE interest_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    status          VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at    TIMESTAMPTZ,
    UNIQUE(tenant_id, listing_id)
);

CREATE INDEX idx_interest_listing ON interest_requests(listing_id);
CREATE INDEX idx_interest_tenant ON interest_requests(tenant_id);
CREATE INDEX idx_interest_status ON interest_requests(status);

-- ========== CHAT MESSAGES ==========
CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interest_request_id UUID NOT NULL REFERENCES interest_requests(id) ON DELETE CASCADE,
    sender_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content             TEXT NOT NULL,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at             TIMESTAMPTZ
);

CREATE INDEX idx_messages_thread ON messages(interest_request_id, sent_at);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- ========== NOTIFICATION LOG ==========
CREATE TABLE notification_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(40) NOT NULL,
    email_to        VARCHAR(160) NOT NULL,
    status          VARCHAR(10) NOT NULL CHECK (status IN ('sent','failed')),
    error_message   TEXT,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_user ON notification_log(user_id);
CREATE INDEX idx_notification_type ON notification_log(type);

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
