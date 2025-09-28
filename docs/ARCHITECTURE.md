# AI Interview Assistant Architecture

## 1. Topology Overview
- **Monorepo** managed with npm workspaces. The root `package.json` wires shared scripts while `apps/web` hosts the Vite/React client and `apps/api` exposes REST + realtime services.
- **Dual user experiences** share the same interview session model:
  - **Interviewee portal** (`/invite/:token`) walks a candidate through resume upload, profile verification, timed questions, and the AI-generated summary.
  - **Interviewer dashboard** (`/interviewer/**`) is a JWT-protected workspace for generating invites, tracking live sessions, and reviewing transcripts.
- **AI assistance** is powered by Google Gemini via a dedicated backend service that generates question sets, scores answers, and drafts final summaries.
- **MongoDB** is the system of record for candidates, interview sessions, transcripts, and invite metadata. Client-side state is mirrored via `redux-persist` so an interview can survive refreshes without losing timers.

## 2. End-to-End Flow
1. **Authenticate interviewer**
   - `/interviewer/login` posts to `POST /api/auth/login`.
   - On success a JWT is persisted (via `redux-persist` + `localStorage`) and injected into Axios headers for subsequent API calls.
2. **Create invite**
   - Dashboard action calls `POST /api/interviews`. The API mints an invite token, stores it on an `InterviewSession`, and (optionally) triggers email via `mailer.js`.
   - The response includes a shareable URL (`/invite/:token`).
3. **Candidate bootstrap**
   - Visiting the link hits `GET /api/invite/:token`. The API returns session metadata, any missing profile fields, and the current countdown deadline if the interview is in progress.
4. **Resume intake & profile completion**
   - `POST /api/invite/:token/resume` uploads PDF/DOCX using Multer. `resumeParser.js` extracts candidate name/email/phone, saves the file under `apps/api/uploads/`, and updates the session.
   - Remaining gaps are collected through `POST /api/invite/:token/profile` before questions begin.
5. **Timed interview**
   - `POST /api/invite/:token/start` delegates to `interviewEngine.prepareQuestionsForSession`, generating a six-question plan (2 easy @ 20 s, 2 medium @ 60 s, 2 hard @ 120 s).
   - For each answer the client calls `POST /api/invite/:token/answers`. `interviewEngine.evaluateAnswer` records the response, requests Gemini scoring, appends assistant feedback to the transcript, advances timers, and emits `session:update` over Socket.IO.
   - If the local countdown reaches zero, the UI auto-submits the (possibly empty) answer so the backend remains authoritative.
6. **Completion**
   - After the final question the API aggregates scores, calls `summarizeWithAi`, persists the final verdict, and returns it to both participants.
   - `/api/invite/:token/complete` is available for explicit completion hooks, but normal flow concludes automatically once all questions are answered.
7. **Session resiliency**
   - The interviewee client persists state per-token inside IndexedDB (via `localforage`). Reloading rehydrates the session, deadlines, and extracted resume fields. A welcome-back modal confirms timers resume only when the candidate is ready.

## 3. Frontend (`apps/web`)
- **Runtime**: React 19 + Vite 7 with the `@tailwindcss/vite` plugin. Styling combines Tailwind CSS v4 utility classes for layout/spacing and Ant Design 5 components for complex widgets.
- **State management**:
  - `auth` slice (`features/auth/authSlice.js`): interviewer credentials + JWT. Persisted to `localStorage` and mirrored into Axios headers.
  - `interview` slice (`features/interviewee/interviewSlice.js`): keyed by invite token, tracks session payload, plan, countdown deadline, extracted resume fields, and welcome-back flags. Persisted to IndexedDB via `localforage`.
- **Data fetching**: `@tanstack/react-query` powers API caching, background refetch, and optimistic UI for invite creation and answer submission.
- **Realtime updates**: `socket.io-client` joins `session:{id}` rooms so interviewer dashboards receive progress in near-real time.
- **Routing** (React Router v7):
  - `/` — landing page with invite lookup and CTAs.
  - `/invite/:token/*` — nested router for resume upload, profile form, chat, and summary.
  - `/interviewer/login` & `/interviewer/dashboard` — protected routes guarded by `<RequireAuth>`.
- **Styling conventions**: Tailwind drives layout (gradients, spacing, responsive grids) while Ant Design theming is applied via a central `ConfigProvider`. No legacy `.css` modules remain; global base styles live in `src/index.css` alongside the Tailwind import.

## 4. Backend (`apps/api`)
- **Express stack**: `src/app.js` wires middleware (CORS, body parsing, logging) and static hosting for uploaded resumes. Routers live under `src/routes`.
- **Data models** (`src/models`):
  - `Interviewer` (also exported as `User` for legacy imports) — interviewer accounts with bcrypt-hashed passwords.
  - `InterviewSession` — embeds candidate contact data + resume metadata, invite token, lifecycle status (`created`, `waiting-profile`, `ready`, `in-progress`, `completed`, `expired`), question plan, answers, AI feedback, and chat transcript.
- **Controllers** orchestrate domain logic:
  - `authController` — login, seeding checks.
  - `interviewController` — list/create/fetch interviews for dashboard queries (protected by `authenticate` middleware).
  - `inviteController` — candidate-facing lifecycle (bootstrap, resume upload, profile update, start, answer submission, completion).
- **Services** (`src/services`):
  - `resumeParser.js` — Multer integration, PDF/DOCX parsing via `pdf-parse` and `mammoth`, plus heuristics to pull name/email/phone.
  - `geminiService.js` — thin wrapper around `@google/generative-ai` with prompt templates for question generation, answer scoring, and final summary recommendations.
  - `interviewEngine.js` — central session state machine (question scheduling, deadline management, scoring aggregation, summarisation, Socket.IO emission).
  - `mailer.js` — optional email dispatch (currently a stub/no-op unless SMTP is configured).
- **Realtime layer**: `src/realtime.js` spins up Socket.IO alongside the HTTP server. Clients join `session:{id}` rooms, and `emitSessionUpdate` pushes incremental state after each mutation.
- **REST surface** (selected routes):
  - `POST /api/auth/login`
  - `GET /api/interviews`, `POST /api/interviews`, `GET /api/interviews/:id`
  - `GET /api/invite/:token`
  - `POST /api/invite/:token/{resume|profile|start|answers|complete}`
  - `GET /api/health`
- **Security**: Invite tokens are signed JWTs with short TTL and status checks. Authenticated routes require the `Authorization: Bearer` header, enforced by `middleware/authenticate.js`. CORS origins derive from `CLIENT_URL` env (comma-separated list).

## 5. Data Persistence & Synchronisation
- **Client**: `redux-persist` + `localforage` store interview sessions per token. Upon reload the UI rehydrates timers using the server-provided deadline and suppresses auto-submission until the candidate resumes.
- **Server**: MongoDB (via Mongoose) persists the source of truth. Every write to an interview session optionally broadcasts over Socket.IO so dashboards remain in sync without polling.

## 6. Timer & Auto-Submit Mechanics
- When a question starts, the backend stamps `currentQuestionDeadline` and returns it. The client keeps the timestamp (not a running counter) and recomputes the remaining seconds each render.
- If the deadline passes locally, the UI auto-submits an empty answer to avoid drift. The backend still validates ordering and records the actual elapsed duration for AI scoring context.

## 7. Deployment & Local Development
- **Local**: `docker-compose.yml` provides MongoDB. Run `npm install` once at the repo root, then `npm run dev` (monorepo script) to start API + web concurrently. API expects `.env` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `CLIENT_URL`, and optional `SMTP_*` vars.
- **Production**: Common setup is API on Render/Railway/Fly.io and the Vite build on Netlify/Vercel. Remember to expose `/uploads` for resume downloads, configure HTTPS/CORS, and provide the same environment variables.

## 8. Forward-Looking Enhancements
- Harden the mailer with a real provider (SendGrid/Postmark) and template management.
- Allow interviewers to customise question plans or upload their own banks.
- Add analytics (conversion funnel, average score trends, AI feedback quality) to the dashboard.
- Explore transcript export to PDF/CSV for downstream ATS workflows.
