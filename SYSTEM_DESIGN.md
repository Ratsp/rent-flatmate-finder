# System Design Write-up — Rent & Flatmate Finder

*Covers compatibility scoring design, LLM integration & fallback, chat implementation, and notification flow. (~780 words)*

## Overview

The system is a three-tier application: a React (Vite) SPA, a Node/Express API with an attached Socket.IO server, and a Supabase PostgreSQL database accessed through raw, parameterized SQL (no ORM) for full query control. Authentication is JWT-based; every protected route passes through a token-verification middleware and a `requireRole` guard enforcing the `tenant` / `owner` / `admin` boundary. The core data model is seven tables — `users`, `tenant_profiles`, `listings`, `compatibility_scores`, `interest_requests`, `messages`, `notification_log` — plus one analytics view, `owner_trust`.

## Compatibility Scoring Design

Scores are computed **per `(tenant, listing)` pair** and cached, never recomputed on the read path. When a tenant browses, the listings query `LEFT JOIN`s `compatibility_scores`; any listing lacking a cached score is scored in a bounded, concurrency-limited batch (5 at a time to respect LLM rate limits), then re-queried so results return already ranked by `score DESC`. This keeps browse fast and cost-bounded: a given pair costs one LLM call in its lifetime.

Caching is deliberately invalidated when the inputs change. Editing a listing or a tenant profile issues a `DELETE FROM compatibility_scores` for the affected rows, so the next browse recomputes fresh scores. This gives correctness without a recompute-everything job.

Each stored record is `{ score (0–100), explanation, source }`, where `source ∈ {llm, fallback}`. Persisting the explanation means the "why you match" text shown to tenants — and the score ranking shown to owners — is stable and auditable rather than regenerated each visit.

## LLM Integration & Fallback

Scoring uses Groq's `llama-3.3-70b-versatile` in JSON mode (`response_format: json_object`, temperature 0.1 for determinism). The prompt supplies the listing and tenant profile and instructs the model to weight budget overlap and location match primarily, with room type and move-in proximity secondary, returning strictly `{ score, explanation }`.

Robustness is layered. The call runs behind a 5-second `AbortController` timeout. The response is JSON-parsed and schema-validated — `score` must be a number in `[0,100]`; `explanation` must be a string — and any failure (timeout, network error, empty content, malformed JSON, out-of-range score) throws. The caller catches every such failure and transparently switches to a **deterministic rule-based fallback**: budget fit contributes up to 50 points (full marks in-range, partial just over), location match up to 35 (case-insensitive substring), room-type match up to 15. Crucially, the fallback also produces a specific, human-readable explanation ("Rent ₹12,000 fits your ₹8,000–₹15,000 budget · Located in your preferred area…"), so a degraded LLM never degrades the user experience to a blank or generic message. The result is tagged `source: 'fallback'`, making LLM-vs-rules attribution visible in the data. The platform therefore always returns a score — the LLM improves quality but is never a hard dependency.

## Chat Implementation

Real-time chat is built on Socket.IO over WebSocket, sharing the same HTTP server as the REST API. The socket handshake authenticates via the JWT passed in `auth.token`, so socket identity is the same trusted `user.id` as the REST layer. Rooms are scoped per interest thread (`chat_<interest_request_id>`). On `join_room`, the server authorizes the user against the interest — only the participating tenant and the listing's owner may join, and only if the interest is `accepted` — enforcing the "chat unlocks after acceptance" rule at the socket level, not just the UI.

On `send_message`, the message is first **persisted** (`INSERT INTO messages`) and then broadcast to the room via `receive_message`, so history and live delivery are consistent and no message exists in the UI without a database row. History is served over REST (`GET /api/chat/:id/messages`) so a reconnecting client hydrates past messages, then streams new ones — the standard "load history, subscribe live" pattern.

## Notification Flow

Email is event-driven and fire-and-forget: notifications are dispatched with `.catch()` logging and never block or fail the originating request. Two events trigger mail. When a tenant sends interest, the pair's compatibility score is ensured (computed if missing) and, if it exceeds 80, `notifyHighScoreInterest` emails the owner — surfacing strong matches proactively. When an owner responds, `notifyInterestAccepted` or `notifyInterestDeclined` emails the tenant. Delivery uses Resend, but the service degrades gracefully: with no `RESEND_API_KEY` it logs the email to the console (ideal for local dev), and every attempt — success or failure — is recorded in `notification_log` for auditability.

## Trust & Analytics Layer

Beyond spec, the `owner_trust` view derives a responsiveness reputation (response rate, average reply time) purely from `interest_requests` timestamps, surfaced as a tenant-facing trust badge and an admin conversion funnel (conversion rate, ghost rate, time-to-match). Because it is a view, it adds trust and analytics with zero write-path cost.
