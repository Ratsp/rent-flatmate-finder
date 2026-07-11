<div align="center">

# 🏠 Rent & Flatmate Finder

### AI-powered room-listing & flatmate-matching platform — find your perfect room, ranked by an LLM compatibility engine.

![Node](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Postgres](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?logo=supabase&logoColor=white)
![Groq](https://img.shields.io/badge/LLM-Groq_Llama_3.3_70B-F55036)
![Socket.IO](https://img.shields.io/badge/Realtime-Socket.IO-010101?logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

**Owner:** Ratnali Anil Pawar

</div>

---

## 📖 Summary

**Rent & Flatmate Finder** connects people looking for rooms with people offering them — but it goes beyond a plain listings board. **Owners** post rooms, **tenants** create "looking for a room" profiles, and an **LLM-powered compatibility engine** (Groq · Llama 3.3 70B) scores and ranks how well each tenant matches each listing based on budget, location, room type, and move-in timing.

Tenants express interest → owners accept/decline → once accepted, both sides get **real-time chat**. Key events (high-compatibility interest, accept/decline) trigger **email notifications**. A full **admin dashboard** oversees the whole platform.

The backend is built on **raw SQL (no ORM)** for full query control, and the frontend is a clean, responsive React SPA.

---

## 🎬 Demo Video

> 📹 **[Watch the demo »](#)** &nbsp;·&nbsp; _(add your video link here)_

<div align="center">

| Tenant browsing with AI scores | Owner managing interests | Real-time chat |
|:---:|:---:|:---:|
| _screenshot_ | _screenshot_ | _screenshot_ |

</div>

---

## ✨ Key Highlights

- 🧠 **AI compatibility scoring** — every tenant↔listing pair scored 0–100 by an LLM, with a **deterministic rule-based fallback** so scoring *never* fails.
- ⚡ **Smart caching** — scores computed once and cached; auto-invalidated when a profile or listing is edited.
- 💬 **Real-time chat** — Socket.IO messaging that unlocks only after an interest is accepted, with message persistence.
- 📧 **Email notifications** — high-score interest alerts + accept/decline updates (fire-and-forget, logged).
- 🔐 **Role-based access** — Tenant / Owner / Admin, enforced via JWT middleware on every route.
- 🛡️ **SQL-injection safe** — 100% parameterized raw SQL, no ORM.
- 🎨 **Clean, responsive UI** — minimal single-accent design, works on mobile and desktop.

---

## 🎯 Problem Statement

Finding a room to rent isn't just about price — it depends on whether a tenant's **location and budget expectations actually align** with what an owner is offering. Traditional listing sites make renters manually scan dozens of irrelevant listings, and owners get flooded with mismatched enquiries.

This platform solves that by:
1. Letting **owners** list rooms and **tenants** describe what they want.
2. Using an **LLM to score compatibility**, so tenants see the *best-matching* rooms first and owners see the *best-matching* tenants first.
3. Gating **direct chat** behind a mutual accept step, keeping conversations relevant.

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
          └──────────────┘  └────────────┘   └────────────────────────────┘
```

**Database tables:** `users` · `tenant_profiles` · `listings` · `compatibility_scores` · `interest_requests` · `messages` · `notification_log`

**Compatibility scoring flow:**
```
Tenant browses / sends interest
        │
        ▼
Score cached for (tenant, listing)?  ──yes──►  return cached score
        │ no
        ▼
Call Groq LLM (5s timeout, JSON mode)
        │
   success? ──no──►  Rule-based fallback (budget + location + room type)
        │ yes
        ▼
Store in compatibility_scores (source = 'llm' | 'fallback')  ──►  return score
```

---

## 🔄 End-to-End Workflow

```
 OWNER                         TENANT                          ADMIN
   │                             │                               │
   │ 1. Register / Login         │ 1. Register / Login           │ Login (seeded)
   │ 2. Create listing + photos  │ 2. Create preference profile  │
   │                             │ 3. Browse (AI-ranked) ◄────── LLM scores
   │                             │ 4. Send interest ───────────► │
   │ 5. Get email (if score>80)  │                               │
   │ 6. View interested tenants  │                               │ Monitor users,
   │    (ranked by score)        │                               │ listings,
   │ 7. Accept / Decline ──────► │ 8. Get accept/decline email   │ interests,
   │                             │                               │ platform stats
   │ 9. 💬 Chat unlocked ◄──────► │ 9. 💬 Chat unlocked           │
   │    (real-time Socket.IO)    │                               │
```

1. **Owner** posts a room (location, rent, dates, photos).
2. **Tenant** sets budget/location preferences.
3. Tenant **browses** — listings arrive ranked by AI compatibility score.
4. Tenant **sends interest**; if score > 80, the owner gets an instant email.
5. Owner reviews **interested tenants ranked by score**, then **accepts or declines** (tenant emailed either way).
6. On accept, a **real-time chat room** opens for that tenant–listing pair.
7. **Admin** oversees all users, listings, interests, and platform stats.

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
- ♻️ **Score cache invalidation** — editing a profile or listing clears stale scores so they recompute automatically.
- 📤 **Photo upload API** (`POST /api/uploads`) — multipart image upload returning URLs.
- 🗂️ **Admin interests view** (`GET /api/admin/interests`) — full oversight of all interest requests.
- 📊 **Owner listing insights** — per-listing interest + accepted counts.
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
node db/runSchema.js      # creates all 7 tables (⚠️ drops existing ones)
node db/createAdmin.js    # seeds admin@test.com / admin123
```
> Or paste `backend/db/schema.sql` into the Supabase Dashboard → SQL Editor → Run.

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
| `GET` | `/api/listings` | Tenant | Browse + filter + AI scores |
| `GET` | `/api/listings/mine` | Owner | Own listings (+ interest counts) |
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
| `GET` | `/api/admin/stats` | Admin | Platform dashboard stats |

**Socket.IO events:** `join_room` · `send_message` · `receive_message` · `typing` · `mark_read`

> 🧪 Import `backend/requests.http` into VS Code (REST Client extension) to run every endpoint with one click — tokens auto-chain between requests.

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
│   └── db/                       # schema.sql · runSchema.js · createAdmin.js
└── frontend/
    ├── vite.config.js            # dev server + /api proxy
    └── src/
        ├── api/                  # client.js (REST) · socket.js (Socket.IO)
        ├── context/              # AuthContext · ToastContext
        ├── components/           # Navbar · Layout · ListingCard · Modal · ui
        └── pages/                # Login · Register · Chat · tenant/ · owner/ · admin/
```

---

## 🧠 AI Compatibility Scoring

The platform scores each tenant–listing pair **0–100** using **Groq's Llama 3.3 70B**:

- **Primary factors:** budget overlap + location match
- **Secondary factors:** room-type preference + move-in date proximity
- **Caching:** computed once per pair, stored in `compatibility_scores`, auto-invalidated on profile/listing edits
- **Fallback:** if the LLM times out (5s) or returns malformed JSON, a deterministic rule-based score is used — the platform never breaks. Each score is tagged `source = 'llm' | 'fallback'`.

---

## 👥 User Roles

| Role | Capabilities |
|------|--------------|
| **Tenant** | Create profile · browse listings · view AI scores · send interest · chat |
| **Owner** | Post/edit/delete listings · upload photos · view ranked interested tenants · accept/decline · chat |
| **Admin** | Manage all users & listings · view all interests · platform stats · deactivate accounts |

---

## 📄 License

MIT © Ratnali Anil Pawar
