# AI Interview Assistant – Architecture

This document captures the current (living) architecture of the AI Interview Assistant monorepo. It is intentionally practical: focused on the real code paths, operational considerations, and points of safe extension.

---

## 1. High‑Level Topology

```
┌─────────────────────────── Monorepo (npm workspaces) ───────────────────────────┐
│                                                                                │
│  apps/web  (React 19 + Vite + Ant Design + Tailwind)                           │
│    ├─ Auth (JWT for interviewer)                                               │
│    ├─ Interviewee flow (resume → profile → timed Q&A → summary)                │
│    ├─ Interviewer dashboard (invites, monitoring, transcripts)                 │
│    └─ State: Redux Toolkit + redux‑persist + react-query + socket.io-client    │
│                                                                                │
│  apps/api  (Express 5 + Mongoose + Socket.IO + Gemini API)                     │
│    ├─ Routes: /api/auth, /api/interviews, /api/invite, /api/health             │
│    ├─ Services: geminiService, interviewEngine, resumeParser, mailer           │
│    ├─ Models: Interviewer, InterviewSession                                   │
│    └─ Realtime: session:{id} rooms (progress + scoring updates)                │
│                                                                                │
│  MongoDB (docker-compose)                                                      │
│  Uploaded resumes (apps/api/uploads, served statically)                        │
└────────────────────────────────────────────────────────────────────────────────┘
```

Two distinct personas share a single session domain model:
- Interviewee (unauthenticated, link + token)
- Interviewer (JWT-authenticated dashboard)

AI capabilities (question generation, answer scoring, summarisation) are implemented as pure functions wrapping Google Gemini models; the rest of the system treats them as deterministic services with controlled prompts and JSON outputs.

---

## 2. Core Domain Objects

### Interviewer
Attributes: name, email (unique), passwordHash, timestamps.
Usage: Authentication context for dashboard + ownership of interview sessions.

### InterviewSession
Key fields:
- inviteToken (unguessable UUID v4 – acts as public join secret)
- status: created → waiting-profile → ready → in-progress → completed (→ expired planned)
- candidate { name, email, phone, resume {storedName,…} }
- questions[] (generated once, immutable afterwards)
- answers[] (one per question; AI scored)
- chatTranscript[] (system, assistant, candidate events)
- currentQuestionIndex & currentQuestionDeadline (server-authoritative timer)
- finalScore / finalSummary

### Question / Answer semantics
- Question difficulty drives default timing + scoring expectations.
- Answer includes AI feedback & score; updating an answer overwrites prior attempt (idempotent per question).

---

## 3. Request + Realtime Lifecycle

1. Interviewer logs in (POST /api/auth/login) → JWT issued (7d expiry) → stored client-side → attached to axios Authorization header.
2. Create interview (POST /api/interviews) → InterviewSession persisted (status waiting-profile) → optional email dispatch → invite URL returned.
3. Candidate loads invite (GET /api/invite/:token) → bootstrap session + missingFields + plan skeleton (difficulty/time blueprint).
4. Candidate uploads resume (POST /api/invite/:token/resume) → server parses PDF/DOCX → updates candidate fields → may progress status.
5. Candidate fills missing profile fields (POST /api/invite/:token/profile) → when all REQUIRED_FIELDS satisfied → status ready.
6. Start interview (POST /api/invite/:token/start) → question set generated (if first start) → first deadline computed → transcript seeded.
7. Submit answer (POST /api/invite/:token/answers) → AI scoring + feedback → transcript & answers updated → next question index/deadline advanced (or finalize if last).
8. Completion triggers summarisation (Gemini) → finalScore + finalSummary persisted → Socket.IO broadcast to interviewer dashboard.

Realtime: interviewer dashboard joins session:{id}; each mutation triggers emitSessionUpdate(session:update) so UI views update without manual polling. (The invite side still uses light polling for resilience; can be future-optimised to also use sockets.)

---

## 4. Frontend (apps/web)

Stack: React 19, Vite 7, Ant Design 5, Tailwind CSS 4 (via @tailwindcss/vite), Redux Toolkit, redux-persist, react-query, socket.io-client.

State slices:
- auth: { token, interviewer } (persisted to localStorage)
- interview: per-token map { session, plan, deadline, extractedFields, welcomeBackSeen, lastVisitedAt }

Data layer patterns:
- react-query handles caching, revalidation, incremental updates
- axios instance auto-injects Authorization header (store subscription in store.js)
- socket.io used only on interviewer side for now; candidate view relies on API responses + local timers

Routing (React Router v7):
- / (landing) – currently static/minimal
- /invite/:token – orchestrates step logic (ResumeUploader → ProfileForm → InterviewChat → InterviewSummary)
- /interviewer/login – auth form
- /interviewer/dashboard – protected via <RequireAuth>

Timer UX: deadline timestamp kept; component derives remaining ms every 250ms; auto-submission when 0 triggers answer mutation if not yet sent.

---

## 5. Backend (apps/api)

Stack: Express 5, Mongoose 8, Socket.IO 4, JSON Web Tokens, Multer, pdf-parse, mammoth.

Key modules:
- app.js – middleware (CORS from CLIENT_URL, JSON parsing, logging, static /uploads)
- realtime.js – Socket.IO server + helpers
- controllers/*.js – route-level orchestration (validation via Zod)
- services/geminiService.js – safe model fallback, JSON extraction, prompt templates
- services/interviewEngine.js – question plan constants, state machine transitions, scoring & summarisation delegates
- services/resumeParser.js – heuristic extraction of name/email/phone
- services/mailer.js – optional; gracefully no-ops if SMTP not configured

Validation & Errors: All input validated with Zod; central error handler normalises 400 (validation), 401 (auth), 404, 500 responses; includes stack in non-production.

---

## 6. Data Persistence & Caching

Server of record: MongoDB (single replica – local docker). Collections: interviewers, interviewsessions.

Client persistence: redux-persist uses localStorage (auth) + IndexedDB (interview slice via localforage) to survive refresh & offline blips.

Resume files: Stored on local disk (apps/api/uploads). Filenames are randomised (timestamp + RNG). Served at /uploads/<storedName>. Future production deployment should offload to object storage (S3, GCS) and enforce signed URL access if privacy requirements increase.

---

## 7. Security Considerations

Implemented:
- JWT auth (7d) for interviewer routes; bearer token parsing + user existence check
- Invite token is a UUID v4 (unguessable) – relies on entropy; no PII embedded
- CORS origin allowlist via CLIENT_URL (comma-separated) for both REST and Socket.IO
- Limited file types (PDF/DOC/DOCX) + size cap (8MB) enforced by Multer
- Zod validation for all mutating candidate & interviewer inputs

Not yet implemented / TODO:
- Interview session expiration / revocation routine (status 'expired' path unused)
- Rate limiting (login brute force, invite enumeration)
- Audit logging for answer edits / resend attempts
- Sanitisation for potential HTML in AI responses (currently plain text prompts keep this low risk)
- Model output toxicity / safety filtering

Configuration secrets required:
- DATABASE_URL (Mongo connection string)
- JWT_SECRET (signing for interviewer tokens; defaults to dev-secret if absent – DO NOT use in prod)
- GEMINI_API_KEY (Google GenAI key)
- CLIENT_URL (comma-separated origins, first used for invite link base)
- Optional: SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / MAIL_FROM for email

---

## 8. Timing & Answer Progression

Authoritative timer: server stamps currentQuestionDeadline; client-side countdown is cosmetic. Auto-submit path still performs a normal POST; backend decides next state. DurationMs is captured (bounded) for future analytics / fairness adjustments.

Edge cases handled:
- Duplicate answer submission for same question overwrites previous record
- Missing answer (blank or timed out) still scored (AI receives empty string)
- Starting interview twice returns current state idempotently

---

## 9. Deployment Notes

Local dev:
1. docker compose up -d (Mongo)
2. Copy apps/api/.env.example → .env and fill variables
3. npm install (root)
4. npm run dev (runs dev:api + dev:web concurrently)
5. (Optional) seed interviewer: npm run -w apps/api seed

Production hardening checklist:
- Replace local disk resume storage with S3/GCS bucket (signed URLs)
- Add HTTPS termination & secure cookies if session cookies introduced
- Add structured logging (pino / Winston) + log correlation IDs
- Implement metrics (Prometheus or hosted) for question latency & AI error rates
- Add circuit breaker / retries for Gemini API

---

## 10. Extension Points

Where to add features safely:
- Additional question strategies: extend QUESTION_PLAN or make it configurable per session (add schema fields + interviewer UI form)
- Alternate scoring model: implement new scoreAnswerWithAi variant behind a strategy flag
- Export formats: add /api/interviews/:id/export.[pdf|csv] endpoint consuming serializeSession(session)
- Expiration job: cron-like process marking sessions 'expired' based on createdAt age

---

## 11. Known Gaps / Future Enhancements
- Real-time channel for interviewee (currently only interviewer uses Socket.IO – candidate could subscribe for lower latency deadlines)
- Graceful resume re-parsing (re-upload flow) with diffing
- Accessibility audit (focus management in timed chat UI)
- Internationalisation / locale-specific date & time formatting
- Structured analytics dashboard (scores by difficulty, average completion time)

---

## 12. Glossary
- Session: An InterviewSession document plus its in-flight runtime state
- Plan: Ordered difficulty/time blueprint (QUESTION_PLAN)
- Deadline: Absolute ISO timestamp when current question auto-submits
- Transcript: Chronological chat-like record (system, assistant, candidate entries)

---

Document status: UPDATED {{DATE}} – amend when backend contracts or data model change.

