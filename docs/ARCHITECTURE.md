# AI Interview Assistant Architecture

## System Overview
- **Monorepo** powered by npm workspaces. `apps/web` delivers the React front end, `apps/api` exposes REST + realtime endpoints.
- **Two correlated experiences** operate on the same session data:
  1. **Interviewee portal** (invite-only URL) conducts the chat-style interview.
  2. **Interviewer dashboard** (authenticated) monitors sessions, reviews transcripts, and manages invites.
- **Gemini** provides question generation, answer scoring, and final summaries via a dedicated backend service module.
- **MongoDB** persists canonical records for candidates, sessions, and transcripts; `redux-persist` mirrors the active interview state locally so a refresh restores timers and progress instantly.

## Experience Flow
1. **Interviewer authentication**
   - Interviewer visits `/interviewer/login` and signs in (JWT-based session backed by MongoDB-stored credentials).
   - Authenticated interviewer can create new interview invites, monitor active sessions, and review historical results from `/interviewer/dashboard`.
2. **Invite generation**
   - POST `/api/interviews` returns a signed invite token and URL (`/invite/:token`).
   - Token grants temporary access to a single interview session with no additional login.
3. **Resume intake & validation**
   - Candidate uploads PDF (required) or DOCX (optional). Backend parses using `pdf-parse` / `mammoth`, extracting name, email, and phone.
   - Missing fields trigger a pre-interview chat where the bot collects the data before moving on.
4. **Interview execution**
   - Once the profile is complete, the client requests the Gemini question set: 2 easy (20 s), 2 medium (60 s), 2 hard (120 s).
   - Front end renders one question at a time with visible timers. When the timer elapses, the current answer (even empty) auto-submits.
   - Each submission hits `/api/interviews/:token/answers` which:
     - Logs the exchange.
     - Scores the answer via Gemini.
     - Broadcasts updates through Socket.IO so the interviewer dashboard reflects progress instantly.
5. **Completion & summary**
   - After the sixth answer, backend requests a holistic score + narrative summary from Gemini and stores it on the session.
   - Interviewer dashboard unlocks full transcript inspection, per-question scoring, and final verdict.
6. **Resume session (Welcome Back)**
   - If the candidate reloads mid-interview, `redux-persist` reloads timers, question index, answers-in-progress, and any outstanding profile prompts.
   - Welcome-back modal offers “Resume interview” (restores countdown) or “Start over” (resets local state and notifies backend).

## Frontend Architecture (`apps/web`)
- **Tech stack**: React 19, Vite 7, Ant Design components, Redux Toolkit, Redux Persist, React Router, React Query for API caching, Socket.IO client for realtime updates.
- **State slices**:
  - `auth`: interviewer JWT + role, persisted securely (with storage encryption wrapper).
  - `interview`: active candidate session (questions, timers, progress, chat transcript).
  - `ui`: modal visibility, loading states, error toasts.
- **Persistence**: `redux-persist` stores interview state in IndexedDB (via `localforage`) to survive refresh. Timers leverage a monotonic `deadline` timestamp recovered on resume to avoid drift.
- **Routing**:
  - `/` – marketing/landing + invite lookup.
  - `/invite/:token/*` – interviewee flow (resume upload, profile completion, interview chat, summary).
  - `/interviewer/login` – interviewer auth.
  - `/interviewer/dashboard` – candidate list with search/sort and detail drawer.
- **Modularity**: feature folders (`features/interview`, `features/dashboard`, etc.) isolate UI, hooks, services, and slice logic.
- **Error Handling**: toast notifications for invalid files, upload failures, Gemini issues (with retry/backoff) and friendly empty states.

## Backend Architecture (`apps/api`)
- **Express + MongoDB** with Mongoose models:
  - `User` (interviewer credentials).
  - `Candidate` (profile, resume metadata).
  - `InterviewSession` (status lifecycle, questions, answers, per-question scores, summary, invite token).
- **Key services**:
  - `resumeService`: handles file uploads (Multer), parses PDF via `pdf-parse` and DOCX via `mammoth`, performs regex extraction, returns structured data + detected gaps.
  - `geminiService`: wraps `@google/generative-ai` with prompt templates for question generation (batched), per-answer scoring (score 0–10 + rationale), and final summary.
  - `sessionService`: orchestrates question scheduling, score aggregation, final composite score.
  - `authService`: interviewer login (bcrypt password hashing) + JWT issuance/verification.
  - `realtimeHub`: Socket.IO namespace `interview/:id` for interviewer dashboards and candidate clients to receive updates.
- **REST API surface** (highlights):
  - `POST /api/auth/login` – interviewer login.
  - `POST /api/interviews` – create interview invite (auth).
  - `GET /api/interviews` – list candidates ordered by score (auth, supports search/sort query params).
  - `GET /api/interviews/:id` – fetch detailed transcript (auth).
  - `GET /api/invite/:token` – public session bootstrap for candidate.
  - `POST /api/invite/:token/resume` – resume upload + extraction.
  - `POST /api/invite/:token/profile` – fill missing fields.
  - `POST /api/invite/:token/start` – generate questions, transition to "in-progress".
  - `POST /api/invite/:token/answers` – submit answer (auto or manual) and receive Gemini score + next question metadata.
  - `POST /api/invite/:token/complete` – finalizes session, fetches summary.
- **Security**: invite tokens are signed (JWT) with short TTL; backend validates status before accepting answers. CORS locked to configured origins.

## Persistence & Sync
- **Client**: interview state is cached locally via Redux Persist so the chat instantly recovers after refresh. Storage keys are namespaced by session token to support multiple concurrent invites.
- **Server**: MongoDB stores the source of truth; Socket.IO events broadcast to keep interviewer dashboard synchronized even if the candidate disconnects temporarily.

## Timers & Auto-Submission
- Client calculates `deadline = now + duration` when a question starts and persists the timestamp. Countdown components recompute remaining time on resume. When `Date.now() >= deadline`, the client dispatches `submitAnswer` automatically (possibly empty). Backend also records the elapsed time for scoring context.

## Deployment & Environment
- **Local**: `docker-compose` launches MongoDB. API expects `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` in `.env`.
- **Production**: Deploy API to Render/Railway. Frontend builds with Vercel/Netlify. Configure CORS + HTTPS. Environment variables stored in platform secrets.

## Future Enhancements
- Email service to auto-send invite links.
- Interview template editor for custom stacks.
- Analytics dashboard for interviewer trends.
