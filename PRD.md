# PRD: Rent & Flatmate Finder Platform

**Version:** 1.0
**Owner:** Ratnali Anil Pawar
**Purpose:** Hackathon / portfolio-grade product requirements document for an AI-powered room-listing and flatmate-matching platform.

---

## 1. Problem Statement & Objective

Finding a room to rent isn't just about price — it depends on whether a tenant's location and budget expectations actually align with what an owner is offering. This platform lets **owners** list rooms and **tenants** create "looking for a room" profiles. An **LLM-powered compatibility engine** scores and ranks matches, tenants can express interest, owners can accept/decline, and once accepted, both sides get **real-time chat**. Key events (high-compatibility interest, accept/decline) trigger **email notifications**.

---

## 2. Tech Stack (100% Free-Tier, Production-Realistic)

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React (Vite) + TailwindCSS** | Fast dev, free to host, no heavy UI lib needed |
| Backend | **Node.js + Express** (or FastAPI if Python preferred — see note) | Lightweight REST + WebSocket support, huge free-tier hosting support |
| Database | **Supabase PostgreSQL** (free tier, 500MB) | Managed Postgres, built-in Auth (optional), free, generous limits |
| DB Access | **Raw SQL via `pg` (node-postgres)** — **no ORM** | Full control over queries, matches requirement, easier to reason about performance |
| Realtime Chat | **Socket.IO (WebSocket)** self-hosted on backend, OR **Supabase Realtime** (Postgres logical replication) | Socket.IO chosen for explicit control + message persistence in our own `messages` table |
| Auth | **JWT (jsonwebtoken + bcrypt)**, custom role-based middleware | Free, no vendor lock-in, simple to reason about for tenant/owner/admin roles |
| LLM | **Groq API (Llama 3.1 / 3.3 70B, `llama-3.3-70b-versatile`)** | Free tier, extremely fast inference (LPU), strict JSON mode supported |
| Email | **Resend (free tier: 3,000 emails/month)** or **Nodemailer + Gmail SMTP (free)** | Resend preferred for reliability + simple API; Gmail SMTP as zero-cost fallback |
| File/Photo storage | **Supabase Storage** (free 1GB bucket) | Same project as DB, simple signed-URL access |
| Hosting — Frontend | **Vercel** (free) | Auto-deploy from GitHub, zero-config for Vite/React |
| Hosting — Backend | **Render** (free web service) | Free tier supports WebSocket, persistent Node process |
| Hosting — DB | **Supabase** (already covers this) | N/A |

> **Note on backend language:** Node/Express is recommended because Socket.IO + Express is the most battle-tested free combo for realtime + REST in one process on Render's free tier. FastAPI + `websockets` is an equally valid alternative if Python is preferred; schema and API contract below stay identical either way.

### 2.1 Package List (Node backend)
```
express, pg, jsonwebtoken, bcrypt, socket.io, dotenv, cors,
multer (photo upload to Supabase Storage), resend (or nodemailer),
groq-sdk (or plain fetch to Groq's OpenAI-compatible endpoint), zod (input validation)
```

---

## 3. User Roles

| Role | Capabilities |
|---|---|
| **Tenant** | Register/login, create/edit "looking for room" profile, browse & filter listings, view compatibility score, send interest requests, chat after acceptance |
| **Owner** | Register/login, post/edit/delete room listings, view interested tenants ranked by compatibility score, accept/decline interest, chat after acceptance, mark listing as filled |
| **Admin** | View/manage all users, listings, interest requests; deactivate/ban users; view basic platform activity (counts, recent signups, recent matches) |

Role stored in `users.role` (`tenant | owner | admin`); enforced via JWT middleware (`requireRole(['owner'])` etc.).

---

## 4. Functional Requirements

### 4.1 Auth
- Register (email, password, name, role) → bcrypt hash password → issue JWT (access token, 24h expiry)
- Login → verify hash → issue JWT
- Middleware validates JWT + role on every protected route

### 4.2 Owner Flow
1. Post listing: location (text + optional lat/lng), rent, available_from, room_type (single/shared/1BHK etc.), furnishing_status (furnished/semi/unfurnished), photos (upload to Supabase Storage, store URLs array)
2. Edit / delete own listings
3. View list of tenants who expressed interest on each listing, **sorted by stored compatibility_score DESC**
4. Accept / decline an interest request → triggers tenant email notification
5. Mark listing `status = 'filled'` → hidden from tenant search

### 4.3 Tenant Flow
1. Create profile: preferred_location, budget_min, budget_max, move_in_date, optional preferences (room_type, furnishing)
2. Browse listings with filters: location (ILIKE/text match), budget range, room_type
3. Listings returned **ranked by compatibility_score** for that tenant (computed once per tenant-listing pair, cached in DB)
4. Send "interest" on a listing → creates `interest_requests` row (`status = 'pending'`)
   - If `compatibility_score > 80` → email sent to owner immediately
5. On owner accept/decline → tenant gets email
6. Once accepted → chat room unlocked for that tenant-listing pair

### 4.4 Admin Flow
- List/search all users, disable a user account
- List all listings (including filled), force-delete if needed
- Dashboard: total users, total listings, total interest requests, total matches (accepted), avg compatibility score

---

## 5. AI Compatibility Engine

### 5.1 Design Principle
**Score is computed once per (tenant, listing) pair — the moment a tenant views/filters that listing for the first time OR sends interest — and is cached in the `compatibility_scores` table.** It is never recomputed on every page load; subsequent requests read from DB. Recompute only if the tenant's profile or the listing details are edited (invalidate via `updated_at` comparison).

### 5.2 Trigger Points for Scoring
- When a tenant's filtered browse results include a listing without an existing score row → score computed **lazily, in batch, on that request** and stored
- When tenant sends an interest request (guaranteed to exist before request is created)

### 5.3 LLM Prompt (Groq, `llama-3.3-70b-versatile`, JSON mode)

**System prompt:**
```
You are a compatibility scoring engine for a room rental platform.
You must respond with ONLY valid JSON, no markdown, no extra text.
Schema: { "score": <integer 0-100>, "explanation": "<max 2 sentences>" }
Score based primarily on budget overlap and location match; secondarily on
room type / furnishing preference alignment and move-in date proximity.
```

**User prompt (templated):**
```
Room listing:
- Location: {listing.location}
- Rent: ₹{listing.rent}/month
- Room type: {listing.room_type}
- Furnishing: {listing.furnishing_status}
- Available from: {listing.available_from}

Tenant profile:
- Preferred location: {tenant.preferred_location}
- Budget range: ₹{tenant.budget_min} - ₹{tenant.budget_max}
- Preferred room type: {tenant.room_type_pref}
- Move-in date: {tenant.move_in_date}

Compute a compatibility score (0-100) based on budget and location match,
with room type and move-in date as secondary factors.
Return JSON: { "score": number, "explanation": string }
```

**Example Output:**
```json
{
  "score": 87,
  "explanation": "Rent is well within the tenant's budget and the location matches closely; move-in dates align within two weeks."
}
```

### 5.4 Fallback Rule-Based Scoring (LLM unavailable / timeout / malformed JSON)

Deterministic scoring so the platform never breaks:

```
base_score = 0

# Budget match (up to 50 points)
if listing.rent <= tenant.budget_max and listing.rent >= tenant.budget_min:
    base_score += 50
elif listing.rent <= tenant.budget_max * 1.1:   # within 10% over budget
    base_score += 30
else:
    base_score += max(0, 20 - (listing.rent - tenant.budget_max) / tenant.budget_max * 20)

# Location match (up to 35 points) - simple case-insensitive substring match
if tenant.preferred_location.lower() in listing.location.lower() or
   listing.location.lower() in tenant.preferred_location.lower():
    base_score += 35
else:
    base_score += 10   # partial credit, different area

# Room type / furnishing match (up to 15 points)
if tenant.room_type_pref == listing.room_type:
    base_score += 15
else:
    base_score += 5

score = min(100, round(base_score))
explanation = "Score computed using rule-based fallback (budget + location match)."
```

### 5.5 Failure Handling Strategy
1. Call Groq API with a **5-second timeout**
2. Wrap in try/catch; validate response is parseable JSON matching schema (`score` is integer 0–100, `explanation` is string)
3. On **any** failure (timeout, non-200, malformed JSON, network error) → run fallback function above
4. Store result in `compatibility_scores` with a `source` column (`'llm'` or `'fallback'`) so the UI/admin can see which pairs used fallback
5. Log failures (simple console/error table) for monitoring — no user-facing error, always return a score

---

## 6. Database Schema (Supabase PostgreSQL — Raw SQL, No ORM)

```sql
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

-- ========== ROOM LISTINGS ==========
CREATE TABLE listings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location            VARCHAR(160) NOT NULL,
    rent                NUMERIC(10,2) NOT NULL,
    available_from      DATE NOT NULL,
    room_type           VARCHAR(30) NOT NULL,          -- single / shared / 1BHK / 2BHK...
    furnishing_status   VARCHAR(20) NOT NULL,           -- furnished / semi / unfurnished
    photos              TEXT[] DEFAULT '{}',            -- array of Supabase Storage URLs
    status              VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','filled')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listings_location ON listings USING GIN (to_tsvector('english', location));
CREATE INDEX idx_listings_status ON listings(status);

-- ========== COMPATIBILITY SCORES (cached, not recomputed per request) ==========
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

-- ========== NOTIFICATION LOG (for admin visibility / debugging) ==========
CREATE TABLE notification_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(40) NOT NULL,   -- 'high_score_interest' | 'interest_accepted' | 'interest_declined'
    email_to        VARCHAR(160) NOT NULL,
    status          VARCHAR(10) NOT NULL CHECK (status IN ('sent','failed')),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Key relations:**
`users (1) → (1) tenant_profiles` | `users (1) → (N) listings` (owner) | `(tenant, listing) → (1) compatibility_scores` | `(tenant, listing) → (1) interest_requests` | `interest_requests (1) → (N) messages`

Chat is scoped to an `interest_request_id` — this naturally enforces "chat only unlocks after acceptance" since the frontend/backend checks `interest_requests.status = 'accepted'` before opening the socket room.

---

## 7. API Design (REST)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register user (tenant/owner) |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/tenants/me` | Tenant | Get own profile |
| PUT | `/api/tenants/me` | Tenant | Create/update profile |
| POST | `/api/listings` | Owner | Create listing (multipart, photos) |
| PUT | `/api/listings/:id` | Owner | Edit own listing |
| DELETE | `/api/listings/:id` | Owner | Delete own listing |
| PATCH | `/api/listings/:id/fill` | Owner | Mark listing as filled |
| GET | `/api/listings` | Tenant | Browse + filter (`?location=&budget_min=&budget_max=&room_type=`), returns ranked by compatibility_score |
| GET | `/api/listings/:id/interests` | Owner | View interested tenants ranked by score |
| POST | `/api/interests` | Tenant | Send interest (`listing_id`) → triggers scoring if missing, then email if score > 80 |
| PATCH | `/api/interests/:id` | Owner | Accept/decline (`status`) → triggers tenant email |
| GET | `/api/chat/:interestRequestId/messages` | Tenant/Owner | Fetch chat history |
| GET | `/api/admin/users` | Admin | List/manage users |
| GET | `/api/admin/listings` | Admin | List/manage listings |
| GET | `/api/admin/stats` | Admin | Platform activity dashboard |

**WebSocket events (Socket.IO):**
- `join_room` (`interest_request_id`) — server verifies `status = 'accepted'` and user is a participant before allowing join
- `send_message` → persists to `messages` table → broadcasts `receive_message` to room
- `typing` (optional, ephemeral, not persisted)

---

## 8. Real-Time Chat Implementation

1. Client connects to Socket.IO server with JWT (sent as auth handshake payload)
2. Server middleware verifies JWT, attaches `user_id` to socket
3. Client emits `join_room` with `interest_request_id`
4. Server queries `interest_requests` to confirm `status = 'accepted'` and `user_id` matches either the tenant or the listing's owner — else reject join
5. Client emits `send_message` → server inserts into `messages` table (raw SQL `INSERT ... RETURNING *`) → emits `receive_message` to all sockets in that room
6. On reconnect, client calls REST `GET /api/chat/:id/messages` to hydrate history, then joins the socket room for live updates

---

## 9. Notification Flow (Email)

| Event | Trigger | Recipient | Channel |
|---|---|---|---|
| High-compatibility interest | `POST /api/interests` succeeds AND `compatibility_scores.score > 80` | Owner | Resend/Nodemailer |
| Interest accepted | `PATCH /api/interests/:id` with `status='accepted'` | Tenant | Resend/Nodemailer |
| Interest declined | `PATCH /api/interests/:id` with `status='declined'` | Tenant | Resend/Nodemailer |

- All email sends wrapped in try/catch; failures logged to `notification_log` with `status='failed'` but never block the underlying API response (fire-and-forget with logging, not a blocking dependency)
- Email templates: simple HTML, includes listing summary, score (if applicable), and a link back to the app

---

## 10. Non-Functional Requirements

- **Security:** bcrypt password hashing (cost factor 10+), JWT expiry + refresh not required for MVP (24h token acceptable), parameterized SQL queries only (no string concatenation — prevents SQL injection since we're not using an ORM)
- **Performance:** Compatibility scores cached, never recomputed per request; DB indexes on `location`, `status`, foreign keys
- **Reliability:** LLM fallback guarantees scoring always succeeds; email failures never break core flows
- **Scalability (for a hackathon-scale app):** Stateless REST API (horizontally scalable on Render); Socket.IO sticky sessions acceptable at this scale (single instance)

---

## 11. Deliverables Checklist

1. ✅ Zip of complete source code (`/frontend`, `/backend`, `/db/schema.sql`)
2. ✅ `README.md` — setup guide, `.env.example`, API docs, DB schema, LLM prompt with example I/O (this PRD feeds directly into it)
3. ✅ Hosted app — Frontend on Vercel, Backend on Render, DB on Supabase
4. ✅ System design write-up (≤800 words) — separate `SYSTEM_DESIGN.md` covering: compatibility scoring design & caching, LLM integration + fallback, chat implementation, notification flow

---

## 12. Suggested Build Order (Hackathon Timeline)

| Phase | Tasks |
|---|---|
| 1. Foundation | Supabase project + run `schema.sql`; Express skeleton; JWT auth (register/login) |
| 2. Core CRUD | Listings CRUD (owner); tenant profile CRUD; browse + filter endpoint |
| 3. AI Scoring | Groq integration + prompt; fallback function; `compatibility_scores` caching logic |
| 4. Interest Flow | Interest request create/accept/decline; email notifications (Resend) |
| 5. Realtime Chat | Socket.IO server + room-join guard; message persistence; frontend chat UI |
| 6. Admin + Polish | Admin dashboard endpoints; filters/sorting on frontend; photo upload via Supabase Storage |
| 7. Deploy + Docs | Deploy Vercel + Render; write README + system design doc; final QA pass |

---

## 13. Environment Variables (`.env.example` preview)

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_key
RESEND_API_KEY=your_resend_key
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_key
FRONTEND_URL=https://your-app.vercel.app
PORT=5000
```
