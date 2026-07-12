<div align="center">

# 🏠 Rent & Flatmate Finder

### AI-powered room-listing & flatmate-matching platform — find your perfect room, ranked by an LLM compatibility engine and a data-driven trust layer.

![Node](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Postgres](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?logo=supabase&logoColor=white)
![Groq](https://img.shields.io/badge/LLM-Groq_Llama_3.3_70B-F55036)
![Socket.IO](https://img.shields.io/badge/Realtime-Socket.IO-010101?logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

**Author:** Ratnali Anil Pawar

</div>

---


## 🎬 Demo Video

Watch the complete walkthrough of the **Rent & Flatmate Finder** application, showcasing all major features for **Tenant**, **Owner**, and **Admin**.

🔗 **Demo Video:**  
📹 **[Watch Demo Video](https://drive.google.com/file/d/1Fdftey1kujwDFrCLuAbIOOWczZ77xXWg/view?usp=sharing)**

---


## 📑 Table of Contents

- [Summary](#-summary)
- [Deliverables](#-deliverables)
- [Key Highlights](#-key-highlights)
- [Problem Statement](#-problem-statement)
- [Architecture & Data Flow](#️-architecture--data-flow)
- [Data Model](#-data-model)
- [AI Compatibility Scoring](#-ai-compatibility-scoring)
- [Trust & Analytics Engine](#-trust--analytics-engine)
- [End-to-End Workflow](#-end-to-end-workflow)
- [Key Features & Enhancements](#-key-features--enhancements)
- [Technology Stack](#️-technology-stack)
- [Configuration](#️-configuration)
- [Quick Start Guide](#-quick-start-guide)
- [Test Credentials](#-test-credentials)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [User Roles](#-user-roles)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#-roadmap)

---

## 📖 Summary

**Rent & Flatmate Finder** connects people looking for rooms with people offering them — but it goes well beyond a plain listings board. **Owners** post rooms, **tenants** create "looking for a room" profiles, and an **LLM-powered compatibility engine** (Groq · Llama 3.3 70B) scores and ranks how well each tenant matches each listing based on budget, location, room type, and move-in timing.

Every match ships with a plain-English **"Why you match"** explanation, and every owner carries a **data-driven Trust Score** computed from how reliably and quickly they respond — so tenants spend less time guessing and more time talking to the right owners.

Tenants express interest → owners accept/decline → once accepted, both sides get **real-time chat**. Key events trigger **email notifications**, and a full **admin dashboard** with a **conversion funnel** oversees the whole platform.

The backend is built on **raw SQL (no ORM)** for full query control; the frontend is a clean, responsive React SPA.

---

## 📦 Deliverables

| # | Deliverable | Where |
|---|-------------|-------|
| 1 | Complete source code | this repository (`backend/` + `frontend/`) |
| 2 | README — setup, `.env.example`, API docs, DB schema, **LLM prompt + example I/O** | this file + [`backend/.env.example`](backend/.env.example) |
| 3 | Hosted application URL | _(deploy to Vercel/Render — see [Quick Start](#-quick-start-guide))_ |
| 4 | System design write-up (≤800 words) | **[`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md)** |

---

## ✨ Key Highlights

- 🧠 **AI compatibility scoring** — every tenant↔listing pair scored 0–100 by an LLM, with a **deterministic rule-based fallback** so scoring *never* fails.
- 💡 **"Why you match"** — each score carries specific, human-readable reasons so tenants decide in seconds, not minutes.
- 🏅 **Owner Trust Score** — a responsiveness reputation computed from *real behaviour* (response rate + reply speed), shown as a badge. Two-sided trust with zero manual reviews.
- 📊 **Admin conversion funnel** — live **conversion rate**, **ghost rate**, and **time-to-match** metrics, straight from the data.
- 💬 **Real-time chat** — Socket.IO messaging that unlocks only after an interest is accepted, with message persistence.
- 📧 **Email notifications** — high-score interest alerts + accept/decline updates (fire-and-forget, logged).
- 🔐 **Role-based access** — Tenant / Owner / Admin, enforced via JWT middleware on every route.
- 🛡️ **SQL-injection safe** — 100% parameterized raw SQL, no ORM.
- 🎨 **Clean, responsive UI** — minimal single-accent design, works on mobile and desktop.

---

## 🎯 Problem Statement

Finding a room to rent isn't just about price — it depends on whether a tenant's **location and budget expectations actually align** with what an owner is offering, and whether the owner will even **respond**. Traditional listing sites make renters manually scan dozens of irrelevant listings, chase owners who ghost them, and gamble on whether a stranger is trustworthy. Owners, meanwhile, get flooded with mismatched enquiries.

This platform solves that by:
1. Letting **owners** list rooms and **tenants** describe what they want.
2. Using an **LLM to score & explain compatibility**, so tenants see the *best-matching* rooms first (with reasons) and owners see the *best-matching* tenants first.
3. Surfacing a **data-driven trust signal** so tenants can prioritise owners who actually respond — and owners are rewarded for responding.
4. Gating **direct chat** behind a mutual accept step, keeping conversations relevant.

---

## 🏗️ Architecture & Data Flow

```
                          ┌──────────────────────────────┐
                          │   React SPA (Vite + Tailwind) │
                          │   localhost:5173              │
                          └───────────────┬──────────────┘
                                          │  REST /api (JWT)   +   Socket.IO
                                          ▼
        ┌─────────────────────────────────────────────────────────────────┐
        │                  Node.js + Express (localhost:5000)               │
        │                                                                   │
        │   Routes → Middleware (JWT + requireRole) → Controllers           │
        │                                                                   │
        │   ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐  │
        │   │ scoring    │  │ email        │  │ chatSocket │  │ upload   │  │
        │   │ service    │  │ service      │  │ (Socket.IO)│  │ service  │  │
        │   └─────┬──────┘  └──────┬───────┘  └─────┬──────┘  └────┬─────┘  │
        └─────────┼────────────────┼────────────────┼──────────────┼───────┘
                  │                │                │              │
                  ▼                ▼                ▼              ▼
          ┌──────────────┐  ┌────────────┐   ┌────────────────────────────┐
          │  Groq LLM    │  │  Resend    │   │  Supabase PostgreSQL       │
          │  (Llama 3.3) │  │  (email)   │   │  raw SQL via pg (no ORM)   │
          └──────────────┘  └────────────┘   │  7 tables + owner_trust    │
                                             │  analytics view            │
                                             └────────────────────────────┘
```

**Request path:** every protected route passes through JWT verification and a `requireRole` guard before hitting a controller. Controllers use a thin `query()` helper over a `pg` connection pool — **no ORM**, all parameterized.

---

## 🗄️ Data Model

**7 tables + 1 analytics view**, all defined in [`backend/db/schema.sql`](backend/db/schema.sql).

| Table | Purpose |
|-------|---------|
| `users` | Accounts with `role` (`tenant`/`owner`/`admin`), bcrypt password hash, `is_active` flag |
| `tenant_profiles` | A tenant's preferences: location, budget range, room type, move-in date |
| `listings` | Owner room posts: location, rent, dates, photos[], furnishing, `status` |
| `compatibility_scores` | Cached AI scores per `(tenant, listing)` + explanation + `source` (`llm`/`fallback`) |
| `interest_requests` | Tenant→listing interest with `status` and `responded_at` (powers trust + funnel) |
| `messages` | Chat messages, keyed to an accepted interest thread |
| `notification_log` | Audit trail of every email sent (`sent`/`failed`) |
| `owner_trust` *(view)* | **Live aggregate** of owner responsiveness — response rate & avg reply time |

> The `owner_trust` view recomputes on every read from `interest_requests` — no extra columns, no cron, no write amplification.

---

## 🧠 AI Compatibility Scoring

Each tenant–listing pair is scored **0–100** by **Groq's Llama 3.3 70B**, and cached.

```
Tenant browses / sends interest
        │
        ▼
Score cached for (tenant, listing)?  ──yes──►  return cached score + reasons
        │ no
        ▼
Call Groq LLM (5s timeout, JSON mode)
        │
   success? ──no──►  Rule-based fallback (budget + location + room type)
        │ yes
        ▼
Store in compatibility_scores (score, explanation, source)  ──►  return
```

- **Primary factors:** budget overlap + location match
- **Secondary factors:** room-type preference + move-in date proximity
- **💡 "Why you match":** every score returns a short, specific explanation, e.g.
  > *"Rent ₹12,000 fits your ₹8,000–₹15,000 budget · Located in your preferred area · Matches your preferred single room"*
- **Caching:** computed once per pair, stored in `compatibility_scores`, **auto-invalidated** when a profile or listing is edited.
- **Fallback:** if the LLM times out (5s) or returns malformed JSON, a deterministic rule-based score + reasons is used — the platform never breaks. Each score is tagged `source = 'llm' | 'fallback'`.

### LLM Prompt & Example I/O

**System prompt**
```
You are a compatibility scoring engine for a room rental platform.
You must respond with ONLY valid JSON, no markdown, no extra text.
Schema: { "score": <integer 0-100>, "explanation": "<max 2 sentences>" }
Score based primarily on budget overlap and location match; secondarily on
room type / furnishing preference alignment and move-in date proximity.
```

**User prompt** (values interpolated per request)
```
Room listing:
- Location: Andheri West, Mumbai
- Rent: ₹12000/month
- Room type: single
- Furnishing: furnished
- Available from: 2026-09-01

Tenant profile:
- Preferred location: Andheri West, Mumbai
- Budget range: ₹8000 - ₹15000
- Preferred room type: single
- Move-in date: 2026-09-14

Compute a compatibility score (0-100) based on budget and location match,
with room type and move-in date as secondary factors.
Return JSON: { "score": number, "explanation": string }
```

**Example model output** (`response_format: json_object`, temp 0.1)
```json
{
  "score": 90,
  "explanation": "The rent and location align well with the tenant's budget and preferred area, and the room type matches their preference, with a move-in only 13 days after availability."
}
```

**Example fallback output** (LLM unavailable — deterministic rules)
```json
{
  "score": 100,
  "explanation": "Rent ₹12,000 fits your ₹8,000–₹15,000 budget · Located in your preferred area · Matches your preferred single room",
  "source": "fallback"
}
```

The `{ score, explanation, source }` triple is persisted to `compatibility_scores` against the `(tenant_id, listing_id)` pair and reused on every subsequent read (never recomputed unless the profile or listing changes).

---

## 🏅 Trust & Analytics Engine

Two data-native features turn raw behaviour into trust and insight — no manual reviews, no new tables.

### Owner Trust Score (tenant-facing)

Computed live by the `owner_trust` view from real interest-response behaviour:

| Metric | Formula |
|--------|---------|
| **Response rate** | `responded_interests / total_interests` |
| **Avg reply time** | `avg(responded_at − created_at)` over answered interests |

Rendered as a badge on every listing (and on the owner's own dashboard):

| Badge | Condition |
|-------|-----------|
| 🏅 **Trusted owner** | response rate ≥ 90% **and** replies ≤ 6h |
| ✓ **Responsive** | response rate ≥ 70% |
| 🆕 **New owner** | no enquiries yet |

This gives tenants an objective signal of who actually replies, and gives owners a reputation they earn by responding — a positive flywheel that lifts platform-wide responsiveness.

### Admin Conversion Funnel

The admin dashboard surfaces three funnel metrics, computed live from `interest_requests`:

| Metric | Formula | Reads |
|--------|---------|-------|
| **Conversion rate** | `accepted / total interests` | how many enquiries become matches |
| **Ghost rate** | `pending / total interests` | how many enquiries owners never answered |
| **Time to match** | `avg(responded_at − created_at)` over accepted | how fast matches happen |

Together they are the measurement layer that proves the trust & matching features move the numbers.

---

## 🔄 End-to-End Workflow

```
 OWNER                         TENANT                          ADMIN
   │                             │                               │
   │ 1. Register / Login         │ 1. Register / Login           │ Login (seeded)
   │ 2. Create listing + photos  │ 2. Create preference profile  │
   │                             │ 3. Browse (AI-ranked +        │
   │                             │    "why you match" + trust) ◄─ LLM + owner_trust
   │                             │ 4. Send interest ───────────► │
   │ 5. Get email (if score>80)  │                               │
   │ 6. View interested tenants  │                               │ Monitor users,
   │    (ranked by score)        │                               │ listings, interests,
   │ 7. Accept / Decline ──────► │ 8. Get accept/decline email   │ funnel analytics
   │    (updates Trust Score)    │                               │
   │ 9. 💬 Chat unlocked ◄──────► │ 9. 💬 Chat unlocked           │
   │    (real-time Socket.IO)    │                               │
```

1. **Owner** posts a room (location, rent, dates, photos).
2. **Tenant** sets budget/location preferences.
3. Tenant **browses** — listings arrive ranked by AI score, each with match reasons and the owner's trust badge.
4. Tenant **sends interest**; if score > 80, the owner gets an instant email.
5. Owner reviews **interested tenants ranked by score**, then **accepts or declines** (tenant emailed either way). Each response feeds their Trust Score.
6. On accept, a **real-time chat room** opens for that tenant–listing pair.
7. **Admin** oversees all users, listings, interests, and the conversion funnel.

---

## 🚀 Key Features & Enhancements

### Core (per spec)
| Feature | Detail |
|---|---|
| **Auth** | JWT (24h) + bcrypt, role-based middleware (`tenant`/`owner`/`admin`) |
| **Listings** | Full CRUD, photo upload, mark-as-filled, filtered browse |
| **Tenant profiles** | Budget, location, room-type, move-in preferences |
| **AI scoring** | Groq LLM + deterministic fallback, cached per pair |
| **Interest flow** | Send / accept / decline with unique constraints |
| **Real-time chat** | Socket.IO, accepted-only, persisted to DB |
| **Email** | High-score interest + accept/decline notifications |
| **Admin** | Users, listings, interests, and dashboard stats |

### Enhancements added
- 🏅 **Owner Trust Score** — data-driven responsiveness badge from the `owner_trust` view. Tenants see **Trusted owner / Responsive / New owner**; owners see their own reputation. *(See [Trust & Analytics Engine](#-trust--analytics-engine).)*
- 💡 **"Why you match"** — specific, human-readable reasons on every score, on both the LLM and rule-based paths.
- 📊 **Admin conversion funnel** — live **conversion rate**, **ghost rate**, and **avg time-to-match**.
- ♻️ **Score cache invalidation** — editing a profile or listing clears stale scores so they recompute automatically.
- 📤 **Photo upload API** (`POST /api/uploads`) — multipart image upload returning URLs.
- 🗂️ **Admin interests view** (`GET /api/admin/interests`) — full oversight of all interest requests.
- 📈 **Owner listing insights** — per-listing interest + accepted counts.
- 🔔 **Toast notifications** & optimistic UI states in the frontend.
- 🧪 **`requests.http`** — a ready-to-run API test suite for VS Code REST Client.

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 (Vite) · TailwindCSS · React Router · Socket.IO client |
| **Backend** | Node.js · Express · Socket.IO |
| **Database** | Supabase PostgreSQL — **raw SQL via `pg` (no ORM)** |
| **Auth** | JWT (`jsonwebtoken`) + `bcrypt`, custom role middleware |
| **AI / LLM** | Groq API — Llama 3.3 70B (`llama-3.3-70b-versatile`), JSON mode |
| **Real-time** | Socket.IO (WebSocket) with JWT handshake |
| **Email** | Resend (falls back to console logging in dev) |
| **File storage** | Multer (local dev) — swappable for Supabase Storage |
| **Validation** | Zod (request schema validation) |
| **Hosting (target)** | Vercel (frontend) · Render (backend) · Supabase (DB) |

---

## ⚙️ Configuration

Create `backend/.env` (copy from `backend/.env.example`):

```env
# Database (Supabase Postgres connection string)
DATABASE_URL=postgresql://user:password@db.xxxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Authentication
JWT_SECRET=your_strong_random_jwt_secret

# LLM (Groq — free tier)
GROQ_API_KEY=your_groq_api_key

# Email (Resend — optional; logs to console if omitted)
RESEND_API_KEY=your_resend_api_key

# App config
FRONTEND_URL=http://localhost:5173
PORT=5000
```

| Variable | Required | Description |
|----------|:---:|------------|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for signing JWTs |
| `GROQ_API_KEY` | ✅ | Groq key for LLM scoring (fallback runs without it) |
| `RESEND_API_KEY` | ➖ | Email sending; omit to log emails to console |
| `FRONTEND_URL` | ✅ | Allowed CORS origin + email links |
| `PORT` | ➖ | Backend port (default `5000`) |

---

## ⚡ Quick Start Guide

### Prerequisites
- **Node.js 18+**
- A **Supabase** project (free tier) — for the Postgres database
- A **Groq API key** (free tier) — for LLM scoring

### Step 1 — Install
```bash
git clone <repo-url>
cd rent-flatmate-finder

cd backend  && npm install
cd ../frontend && npm install
```

### Step 2 — Configure
```bash
cd backend
cp .env.example .env
# edit .env with your DATABASE_URL, JWT_SECRET, GROQ_API_KEY
```

### Step 3 — Set up the database
```bash
cd backend
node db/runSchema.js      # creates all 7 tables + owner_trust view (⚠️ drops existing)
node db/createAdmin.js    # seeds admin@test.com / admin123
```
> Or paste [`backend/db/schema.sql`](backend/db/schema.sql) into the Supabase Dashboard → SQL Editor → Run.
> Already have a DB from before this feature? Just run [`backend/db/owner_trust.sql`](backend/db/owner_trust.sql) to add the view.

### Step 4 — Run (two terminals)
```bash
# Terminal 1 — backend API + Socket.IO
cd backend
npm run dev        # ➜ http://localhost:5000

# Terminal 2 — frontend
cd frontend
npm run dev        # ➜ http://localhost:5173
```

Open **http://localhost:5173**. The frontend proxies `/api` to the backend (see `frontend/vite.config.js`), so **no CORS setup is needed** in development.

> ⚠️ Run **only one** backend on port `5000`. A second one (e.g. a stray `node server.js`) will make `npm run dev` crash with `EADDRINUSE` — see [Troubleshooting](#-troubleshooting).

---

## 🔑 Test Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@test.com` | `admin123` |
| **Owner** | register in-app (role: Owner) | your choice (6+ chars) |
| **Tenant** | register in-app (role: Tenant) | your choice (6+ chars) |

> Admin accounts can't be self-registered — seed via `node db/createAdmin.js`.
> 💡 To test tenant↔owner chat live, open the two accounts in a **normal window + an Incognito window** (one logged-in user per browser).

---

## 📡 API Reference

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | Public | Register (tenant/owner) |
| `POST` | `/api/auth/login` | Public | Login → JWT |
| `GET` | `/api/auth/me` | Auth | Current user |
| `GET` | `/api/tenants/me` | Tenant | Get own profile |
| `PUT` | `/api/tenants/me` | Tenant | Create/update profile |
| `POST` | `/api/uploads` | Owner | Upload listing photos → URLs |
| `POST` | `/api/listings` | Owner | Create listing |
| `GET` | `/api/listings` | Tenant | Browse + filter + AI scores + owner trust |
| `GET` | `/api/listings/mine` | Owner | Own listings (+ interest counts + trust) |
| `GET` | `/api/listings/:id` | Auth | Single listing |
| `PUT` | `/api/listings/:id` | Owner | Edit listing |
| `DELETE` | `/api/listings/:id` | Owner | Delete listing |
| `PATCH` | `/api/listings/:id/fill` | Owner | Mark as filled |
| `GET` | `/api/listings/:id/interests` | Owner | Interested tenants (ranked) |
| `POST` | `/api/interests` | Tenant | Send interest |
| `GET` | `/api/interests/mine` | Tenant | Own interests + status |
| `PATCH` | `/api/interests/:id` | Owner | Accept / decline |
| `GET` | `/api/chat/rooms` | Auth | My chat rooms |
| `GET` | `/api/chat/:id/messages` | Auth | Chat history |
| `GET` | `/api/admin/users` | Admin | List/search users |
| `PATCH` | `/api/admin/users/:id` | Admin | Activate/deactivate user |
| `GET` | `/api/admin/listings` | Admin | List all listings |
| `DELETE` | `/api/admin/listings/:id` | Admin | Force-delete listing |
| `GET` | `/api/admin/interests` | Admin | View all interest requests |
| `GET` | `/api/admin/stats` | Admin | Platform stats **+ conversion funnel** |

**Socket.IO events:** `join_room` · `send_message` · `receive_message` · `typing` · `mark_read`

> 🧪 Import [`backend/requests.http`](backend/requests.http) into VS Code (REST Client extension) to run every endpoint with one click — tokens auto-chain between requests.

---

## 📁 Project Structure

```
rent-flatmate-finder/
├── README.md · PRD.md
├── backend/
│   ├── server.js                 # Express + HTTP + Socket.IO
│   ├── requests.http             # API test suite (REST Client)
│   ├── config/db.js              # PostgreSQL pool + query helper
│   ├── middleware/auth.js        # JWT verify + role guard
│   ├── controllers/              # auth · listing · tenant · interest · chat · admin · upload
│   ├── routes/                   # one router per resource
│   ├── services/                 # scoring (LLM+fallback) · email · chatSocket · upload
│   └── db/                       # schema.sql · owner_trust.sql · runSchema.js · createAdmin.js
└── frontend/
    ├── vite.config.js            # dev server + /api proxy
    └── src/
        ├── api/                  # client.js (REST) · socket.js (Socket.IO)
        ├── context/              # AuthContext · ToastContext
        ├── components/           # Navbar · Layout · ListingCard · Modal · ui (incl. TrustBadge)
        └── pages/                # Login · Register · Chat · tenant/ · owner/ · admin/
```

---

## 👥 User Roles

| Role | Capabilities |
|------|--------------|
| **Tenant** | Create profile · browse listings · view AI scores + "why you match" + owner trust · send interest · chat |
| **Owner** | Post/edit/delete listings · upload photos · view ranked interested tenants · accept/decline · see own Trust Score · chat |
| **Admin** | Manage all users & listings · view all interests · platform stats + conversion funnel · deactivate accounts |

---

## 🩺 Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `npm run dev` crashes: **`EADDRINUSE :::5000`** | Another process already holds port 5000 | Stop the other backend, or change `PORT` in `.env`. Only run one backend. |
| Login: **"Account has been deactivated. Contact admin."** | The user's `is_active` was set to `false` (e.g. Deactivated in Admin → Users) | Re-activate from **Admin → Users** (button toggles to **Activate**), or `UPDATE users SET is_active = TRUE WHERE email = '…'`. |
| Register says **"already registered"**, then login fails **401** | Email exists with a different password | Log in with the original password, or reset it, or register a new email. |
| Browse shows **"Not scored"** | Tenant has no profile yet | Create the tenant profile first — scores compute on the first browse after that. |
| Owner badge shows **"New owner"** | No interest requests received yet | Trust builds once the owner receives and answers enquiries. |
| Emails don't send | `RESEND_API_KEY` not set | Expected in dev — emails are logged to the backend console instead. |

---

## 🗺️ Roadmap

Data-informed features to deepen trust and reduce tenant time-to-match:

- 🔔 **Saved searches + instant match alerts** — notify a tenant when a new listing scores > 80 for them (retention hook).
- 🔁 **Reverse matching** — let owners browse a ranked feed of fitting tenants and invite them proactively.
- 🤝 **Mutual-interest fast-track** — if both sides show interest, skip approval and open chat instantly.
- ✅ **Verification tiers** — email → phone OTP → ID/KYC badges layered on top of the behavioural Trust Score.
- ⭐ **Post-deal reviews** — two-way ratings feeding the trust signal.
- 📉 **Cohort & funnel drilldowns** — time-to-first-interest, 7-day retention, drop-off by stage.

---

## 📄 License

MIT © Ratnali Anil Pawar
