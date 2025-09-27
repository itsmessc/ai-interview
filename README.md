# ForgeJS

In 2025, starting a new project shouldn't be a chore. ForgeJS is the universal command-line tool that eliminates hours of tedious setup by asking you simple questions and then building a production-ready, full-stack application tailored to your exact specifications.

It's the npx create-... command you wish you always had.

## The Problem: The "Setup Tax"

Every great idea starts with `git init`, followed by a "setup tax"—a frustrating ritual of installing dependencies, wrestling with config files, and stitching together a frontend, backend, and database.

- Frontend-only starters are too rigid. What if you want React with Tailwind CSS and Vitest, not their default testing library?
- Backend setup is a maze of choosing a framework, an ORM, and writing boilerplate for a database connection.
- Full-stack integration means manually creating a monorepo, configuring workspaces, and ensuring your frontend and backend can communicate.

This friction kills momentum and wastes your most valuable resource: the creative energy you have at the start of a project.

## The Solution: Your Personal Stack Architect

ForgeJS replaces this manual toil with a fast, interactive conversation. You run one command, answer a few questions, and ForgeJS acts as your expert architect, forging a complete, modern, and cohesive application stack in under two minutes.

It handles everything:

- Choice of Architecture: simple frontend, standalone backend, or a powerful full-stack monorepo.
- Best-in-Class Tooling: React/Vue/Svelte (via Vite), Node.js (Express or Fastify), Prisma, TypeScript, ESLint, Prettier, Tailwind, and more.
- Batteries-Included Development: For full-stack projects, it can generate a `docker-compose.yml` so you can spin up your database with a single command: `docker-compose up`.

## CSS Options

Choose from CSS, SCSS, SASS (indented), Less, or Tailwind CSS.

## The Vision: Instantaneous Innovation

By making project setup a trivial, near-instant process, we empower developers to:

- Experiment freely without multi-hour setup.
- Enforce best practices and consistency for teams.
- Focus on features instead of boilerplate.

Ultimately, ForgeJS aims to be the definitive starting point for any JavaScript project.


## Getting Started

- cd .
- npm run dev

Apps:
- apps/web: Vite dev server
- apps/api: Node API server

### Database

- Start DB (Docker Compose):

  - docker compose up -d

- Env file:

  - .env and .env.example are pre-filled with PORT, NODE_ENV, and DATABASE_URL.

- Mongoose seed:
  - npm run seed

