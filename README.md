# AI Interview Assistant

An end‑to‑end platform that conducts timed, AI‑assisted technical interviews. Interviewers generate secure invites; candidates upload a resume, confirm details, and complete a timed sequence of questions. Each answer is AI‑scored (0‑10) with feedback; a final AI summary and overall score are produced for interviewer review.

## Key Features

| Domain | Capability |
|--------|-----------|
| Interview Creation | Secure invite token + optional auto email (SMTP) |
| Candidate Intake | Resume upload (PDF/DOC/DOCX) + field extraction |
| Timed Interview | 6 questions (2 easy, 2 medium, 2 hard) with per‑question countdown |
| AI Scoring | Immediate 0‑10 score + feedback using Gemini |
| AI Summary | Final aggregated score + concise recommendation |
| Realtime | Interviewer dashboard live updates via Socket.IO |
| Persistence | Local resume/session state retained across refresh |
| Security | JWT (interviewer) + unguessable invite tokens + file validation |


## Tech Stack

Frontend: React 19, Vite 7, Ant Design 5, Tailwind 4, Redux Toolkit, react-query, socket.io-client.
Backend: Express 5, Mongoose 8, Socket.IO 4, Zod, Multer, pdf-parse, mammoth, Nodemailer, Google Gemini API.
Tooling: npm workspaces, docker-compose (Mongo), ESLint, Prettier.

## Repository Layout
```
apps/
  api/   # Express API + services + models
  web/   # React app (interviewer + interviewee)
docs/ARCHITECTURE.md
docker-compose.yml
```

## Quick Start
```bash
docker compose up -d               # Start Mongo
npm install                        # Install deps
cp apps/api/.env.example apps/api/.env
# Edit .env: DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, CLIENT_URL
npm run -w apps/api seed           # (optional) seed interviewer user
npm run dev                        # Run API + Web concurrently
```
Open: Web http://localhost:5173  |  API health http://localhost:3000/api/health

Seed credentials: alice@example.com / Password123!

## Environment Variables (apps/api/.env)
| Var | Required | Notes |
|-----|----------|-------|
| DATABASE_URL | yes | Mongo connection string |
| JWT_SECRET | prod yes | Falls back to dev-secret if missing (dev only) |
| GEMINI_API_KEY | yes | Enables AI generation & scoring |
| CLIENT_URL | yes | Comma-separated origins (first used in invite URL) |
| PORT | no | Default 3000 |
| GEMINI_MODEL | no | Override model name |
| SMTP_HOST / SMTP_PORT | optional | Enable email invites |
| SMTP_USER / SMTP_PASSWORD | optional | Auth creds |
| MAIL_FROM | optional | From address (required if SMTP used) |

## Core API Routes
Interviewer:
- POST /api/auth/login
- GET  /api/interviews
- POST /api/interviews
- GET  /api/interviews/:id

Invite lifecycle:
- GET  /api/invite/:token
- POST /api/invite/:token/resume
- POST /api/invite/:token/profile
- POST /api/invite/:token/start
- POST /api/invite/:token/answers
- POST /api/invite/:token/complete

Utility:
- GET /api/health
Static resumes: /uploads/:storedName

## Realtime
Socket.IO joins room `session:{sessionId}`; server emits `session:update` with the full session snapshot after each mutation.

## Development Scripts
| Command | Purpose |
|---------|---------|
| npm run dev | Run web + api concurrently |
| npm run -w apps/api dev | API only (nodemon) |
| npm run -w apps/web dev | Frontend only |
| npm run -w apps/web build | Build production web bundle |
| npm run -w apps/api seed | Seed default interviewer |

## Roadmap (Excerpt)
- Configurable question plans / custom banks
- Session expiration + cleanup job
- Export (PDF / CSV) of transcript & summary
- Rate limiting + brute force protection
- Multi-model fallback (OpenAI / Anthropic)
- Analytics dashboard (trends, difficulty heatmaps)
- Candidate-side realtime socket channel

## Contributing
Issues & PRs welcome. Please keep `ARCHITECTURE.md` aligned when altering data models or flows.

## License
Currently unlicensed (all rights reserved).

Document status: UPDATED 2025-09-28.

